import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Payment } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { formatNaira } from '../common/money.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { extendedPaidUntil } from '../plan/plan.js';
import { planPriceKobo } from '../settings/settings.js';
import { SettingsService } from '../settings/settings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SquadService } from './squad.service.js';

const MIN_TOPUP = 10_000n; // ₦100
const MAX_TOPUP = 10_000_000n; // ₦100,000

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly squad: SquadService,
    private readonly ledger: LedgerService,
    private readonly messaging: MessagingService,
    private readonly settings: SettingsService,
  ) {}

  private reference(prefix: string) {
    return `NX-${prefix}-${randomBytes(6).toString('hex').toUpperCase()}`;
  }

  /** `origin` is the address the phone used to reach us (see RequestOrigin), so it can come back. */
  private callbackUrl(origin: string, reference: string) {
    return `${origin}/payments/return?ref=${reference}`;
  }

  private async payerEmail(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.email) throw new BadRequestException('Add an email address to your profile before paying. Squad sends your receipt there.');
    return user.email;
  }

  async startTopup(origin: string, parentId: string, studentId: string, amountKobo: bigint) {
    if (amountKobo < MIN_TOPUP || amountKobo > MAX_TOPUP) throw new BadRequestException('Top up between ₦100 and ₦100,000.');
    const link = await this.prisma.guardianship.findFirst({ where: { parentId, studentId, confirmedAt: { not: null } }, include: { student: true } });
    if (!link) throw new ForbiddenException('You can only top up your own children.');
    const wallet = await this.prisma.$transaction((tx) => this.ledger.userWallet(tx, link.student.userId, 'STUDENT_SPEND'));

    const reference = this.reference('TOP');
    await this.prisma.payment.create({
      data: { reference, payerId: parentId, schoolId: link.student.schoolId, purpose: 'WALLET_TOPUP', amountKobo, metadata: { walletId: wallet.id, studentId } },
    });
    const checkoutUrl = await this.squad.initiate({ amountKobo, email: await this.payerEmail(parentId), reference, callbackUrl: this.callbackUrl(origin, reference) });
    return { reference, checkoutUrl };
  }

  /** Pays a school fee invoice: the whole balance, or part of it (at least ₦1,000). */
  async startFeePayment(origin: string, parentId: string, invoiceId: string, amountKobo?: bigint) {
    const inv = await this.prisma.feeInvoice.findUnique({ where: { id: invoiceId } });
    const link = inv && (await this.prisma.guardianship.findFirst({ where: { parentId, studentId: inv.studentId, confirmedAt: { not: null } } }));
    if (!inv || !link) throw new NotFoundException('Invoice not found.');
    if (inv.status === 'VOID') throw new BadRequestException('This invoice was cancelled by the school.');
    const outstanding = inv.totalKobo - inv.paidKobo;
    if (outstanding <= 0n) throw new BadRequestException('This invoice is already paid.');
    const amount = amountKobo ?? outstanding;
    if (amount > outstanding) throw new BadRequestException(`You only owe ${formatNaira(outstanding)}.`);
    if (amount < outstanding && amount < 100_000n) throw new BadRequestException('Pay at least ₦1,000, or the full balance.');

    const reference = this.reference('FEE');
    await this.prisma.payment.create({
      data: { reference, payerId: parentId, schoolId: inv.schoolId, purpose: 'SCHOOL_FEE', amountKobo: amount, metadata: { invoiceId: inv.id, studentId: inv.studentId } },
    });
    const checkoutUrl = await this.squad.initiate({ amountKobo: amount, email: await this.payerEmail(parentId), reference, callbackUrl: this.callbackUrl(origin, reference) });
    return { reference, checkoutUrl };
  }

  async startSessionPayment(origin: string, parentId: string, sessionId: string) {
    const session = await this.prisma.tutorSession.findUnique({ where: { id: sessionId }, include: { booking: true } });
    if (!session || session.booking.parentId !== parentId) throw new NotFoundException('Lesson not found.');
    if (session.escrowStatus !== 'UNPAID') throw new BadRequestException(session.escrowStatus === 'FREE' ? 'This trial lesson is free.' : 'This lesson is already paid.');

    const reference = this.reference('LSN');
    await this.prisma.payment.create({
      data: { reference, payerId: parentId, purpose: 'TUTOR_SESSION', amountKobo: session.totalKobo, metadata: { sessionId } },
    });
    const checkoutUrl = await this.squad.initiate({ amountKobo: session.totalKobo, email: await this.payerEmail(parentId), reference, callbackUrl: this.callbackUrl(origin, reference) });
    return { reference, checkoutUrl };
  }

  /** The parent's BrainBox plan for all their children. The price and days are fixed on the payment, so a later settings change can't alter it. */
  async startSubscription(origin: string, parentId: string) {
    const s = await this.settings.get();
    const amountKobo = planPriceKobo(s);
    const reference = this.reference('SUB');
    await this.prisma.payment.create({
      data: { reference, payerId: parentId, purpose: 'SUBSCRIPTION', amountKobo, metadata: { plan: 'MONTHLY', days: String(s.planDays) } },
    });
    const checkoutUrl = await this.squad.initiate({ amountKobo, email: await this.payerEmail(parentId), reference, callbackUrl: this.callbackUrl(origin, reference) });
    return { reference, checkoutUrl };
  }

  /** Asks Squad about a payment and, if it succeeded, applies it exactly once. */
  async verify(reference: string, userId?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { reference } });
    if (!payment || (userId && payment.payerId !== userId)) throw new NotFoundException('Payment not found.');
    if (payment.status !== 'PENDING') return { reference, status: payment.status };

    const result = await this.squad.verify(reference, payment.amountKobo);
    if (!result.success) {
      if (result.status === 'failed') {
        await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
        return { reference, status: 'FAILED' as const };
      }
      return { reference, status: 'PENDING' as const };
    }
    await this.apply(payment, result.raw);
    return { reference, status: 'SUCCESS' as const };
  }

  private async apply(payment: Payment, raw: unknown) {
    await this.prisma.$transaction(async (tx) => {
      // Claim the payment: only one caller (webhook or app) can move it out of PENDING.
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'SUCCESS', paidAt: new Date(), rawWebhook: raw as object },
      });
      if (claimed.count === 0) return;
      const meta = payment.metadata as Record<string, string>;

      if (payment.purpose === 'WALLET_TOPUP') {
        await this.ledger.post(tx, {
          walletId: meta.walletId,
          amountKobo: payment.amountKobo,
          type: 'TOPUP',
          stream: 'OTHER',
          description: `Top-up ${formatNaira(payment.amountKobo)}`,
          paymentId: payment.id,
          actorId: payment.payerId,
          idempotencyKey: `payment:${payment.id}`,
        });
      } else if (payment.purpose === 'TUTOR_SESSION') {
        const escrow = await this.ledger.platformWallet(tx, 'ESCROW');
        await this.ledger.post(tx, {
          walletId: escrow.id,
          amountKobo: payment.amountKobo,
          type: 'ESCROW_HOLD',
          stream: 'TUTORING',
          description: 'Lesson paid, held until the lesson happens',
          paymentId: payment.id,
          tutorSessionId: meta.sessionId,
          actorId: payment.payerId,
          idempotencyKey: `payment:${payment.id}`,
        });
        await tx.tutorSession.update({ where: { id: meta.sessionId }, data: { escrowStatus: 'HELD', paymentId: payment.id } });
      } else if (payment.purpose === 'SCHOOL_FEE') {
        // The money has arrived, so never reject it. If two checkouts overlapped, apply what's owed and flag the rest.
        const inv = await tx.feeInvoice.findUniqueOrThrow({ where: { id: meta.invoiceId } });
        const owed = inv.status === 'VOID' ? 0n : inv.totalKobo - inv.paidKobo;
        const applied = payment.amountKobo < owed ? payment.amountKobo : owed;
        if (applied > 0n) {
          await this.ledger.payInvoice(tx, { invoiceId: inv.id, amountKobo: applied, paymentId: payment.id, actorId: payment.payerId, description: `School fees ${formatNaira(applied)}` });
        }
        if (applied < payment.amountKobo) {
          this.logger.error(`OVERPAYMENT: payment ${payment.reference} paid ${formatNaira(payment.amountKobo - applied)} more than invoice ${inv.id} owed. Refund it from Overwatch/Squad.`);
          await tx.auditLog.create({ data: { action: 'fee.overpaid', entityType: 'Payment', entityId: payment.id, schoolId: inv.schoolId, meta: { excessKobo: String(payment.amountKobo - applied) } } });
        }
      } else if (payment.purpose === 'SUBSCRIPTION') {
        const platform = await this.ledger.platformWallet(tx, 'PLATFORM_REVENUE');
        await this.ledger.post(tx, {
          walletId: platform.id,
          amountKobo: payment.amountKobo,
          type: 'PURCHASE',
          stream: 'SUBSCRIPTION',
          description: `BrainBox plan, ${meta.days ?? '30'} days`,
          paymentId: payment.id,
          actorId: payment.payerId,
          idempotencyKey: `payment:${payment.id}`,
        });
        // Lock the parent row so two payments clearing at once each add their own days.
        const [parent] = await tx.$queryRaw<{ trialEndsAt: Date | null; paidUntil: Date | null }[]>`SELECT "trialEndsAt", "paidUntil" FROM "User" WHERE id = ${payment.payerId} FOR UPDATE`;
        await tx.user.update({ where: { id: payment.payerId }, data: { paidUntil: extendedPaidUntil(parent, Number(meta.days ?? 30)) } });
      }
    });
    this.logger.log(`Payment ${payment.reference} applied (${payment.purpose})`);
    const what = { WALLET_TOPUP: 'Wallet top-up', TUTOR_SESSION: 'Lesson payment', SCHOOL_FEE: 'School fees', SUBSCRIPTION: 'Subscription' }[payment.purpose];
    this.messaging.notify([payment.payerId], 'payments', { title: 'Payment received', body: `${what} of ${formatNaira(payment.amountKobo)} went through.`, url: payment.purpose === 'SUBSCRIPTION' ? '/parent/plan' : '/parent/wallet' });
  }

  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined, body: { Event?: string; TransactionRef?: string }) {
    if (!rawBody || !this.squad.isValidSignature(rawBody, signature)) {
      this.logger.warn('Rejected Squad webhook with a bad signature');
      return { ok: false };
    }
    if (body.Event === 'charge_successful' && body.TransactionRef) {
      await this.verify(body.TransactionRef).catch((e) => this.logger.error(`Webhook verify failed: ${e}`));
    }
    return { ok: true };
  }
}
