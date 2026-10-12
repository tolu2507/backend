import { BadRequestException, Injectable } from '@nestjs/common';
import type { LedgerEntryType, Prisma, RevenueStream, WalletType } from '@prisma/client';

import { lagosDay, lagosMidnightInstant } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

type PostInput = {
  walletId: string;
  amountKobo: bigint; // + credit, − debit
  type: LedgerEntryType;
  stream: RevenueStream;
  description: string;
  schoolId?: string | null;
  paymentId?: string;
  tutorSessionId?: string;
  actorId?: string;
  idempotencyKey?: string;
};

/**
 * The only code allowed to move money. Every movement is a LedgerEntry, and the wallet
 * balance changes in the same transaction with a conditional update, so two simultaneous
 * debits can never take a wallet below zero.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Wallets owned by a user or school. Platform wallets (no owner) come from `platformWallet`. */
  async userWallet(tx: Tx, userId: string, type: WalletType) {
    return tx.wallet.upsert({ where: { userId_type: { userId, type } }, update: {}, create: { userId, type } });
  }

  /** What Nexus owes a school: fees parents paid through the app, waiting for payout. */
  async schoolWallet(tx: Tx, schoolId: string) {
    return tx.wallet.upsert({ where: { schoolId_type: { schoolId, type: 'SCHOOL_REVENUE' } }, update: {}, create: { schoolId, type: 'SCHOOL_REVENUE' } });
  }

  /**
   * Applies money to a fee invoice. Online payments (paymentId set) are credited to the school's
   * wallet because Nexus collected them; cash/transfer the school took directly only updates the invoice.
   */
  async payInvoice(tx: Tx, input: { invoiceId: string; amountKobo: bigint; paymentId?: string; actorId: string; description: string }) {
    const inv = await tx.feeInvoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
    if (inv.status === 'VOID') throw new BadRequestException('This invoice was cancelled.');
    const outstanding = inv.totalKobo - inv.paidKobo;
    if (input.amountKobo <= 0n || input.amountKobo > outstanding) throw new BadRequestException(`Enter an amount up to the ₦${(Number(outstanding) / 100).toLocaleString()} still owed.`);
    const paid = inv.paidKobo + input.amountKobo;
    // Conditional update so two payments at once can't both count against the same balance.
    const updated = await tx.feeInvoice.updateMany({
      where: { id: inv.id, paidKobo: inv.paidKobo },
      data: { paidKobo: paid, status: paid >= inv.totalKobo ? 'PAID' : 'PART_PAID' },
    });
    if (updated.count === 0) throw new BadRequestException('This invoice just changed. Refresh and try again.');
    if (input.paymentId) {
      const wallet = await this.schoolWallet(tx, inv.schoolId);
      await this.post(tx, {
        walletId: wallet.id,
        amountKobo: input.amountKobo,
        type: 'FEE_PAYMENT',
        stream: 'SCHOOL_FEES',
        description: input.description,
        schoolId: inv.schoolId,
        paymentId: input.paymentId,
        actorId: input.actorId,
        idempotencyKey: `fee:${input.paymentId}`,
      });
    }
    return { paidKobo: paid, status: paid >= inv.totalKobo ? 'PAID' : 'PART_PAID' };
  }

  /** Tuck-shop money spent from a child's wallet today (Lagos time), after refunds. Checked against the parent's daily limit. */
  async tuckShopSpentToday(tx: Tx | PrismaService, walletId: string) {
    const sum = await tx.ledgerEntry.aggregate({
      where: { walletId, stream: 'TUCK_SHOP', type: { in: ['PURCHASE', 'REFUND'] }, createdAt: { gte: lagosMidnightInstant(lagosDay()) } },
      _sum: { amountKobo: true },
    });
    return -(sum._sum.amountKobo ?? 0n);
  }

  /** The single ESCROW / PLATFORM_REVENUE wallet. Created by the seed; created here if missing. */
  async platformWallet(tx: Tx, type: 'ESCROW' | 'PLATFORM_REVENUE') {
    const found = await tx.wallet.findFirst({ where: { type, userId: null, schoolId: null } });
    return found ?? tx.wallet.create({ data: { type } });
  }

  async post(tx: Tx, input: PostInput) {
    if (input.idempotencyKey) {
      const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return existing;
    }
    const updated =
      input.amountKobo < 0n
        ? await tx.wallet.updateMany({
            where: { id: input.walletId, isFrozen: false, balanceKobo: { gte: -input.amountKobo } },
            data: { balanceKobo: { increment: input.amountKobo } },
          })
        : await tx.wallet.updateMany({ where: { id: input.walletId }, data: { balanceKobo: { increment: input.amountKobo } } });
    if (updated.count === 0) throw new BadRequestException('Not enough money in the wallet.');

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: input.walletId } });
    return tx.ledgerEntry.create({
      data: {
        walletId: input.walletId,
        amountKobo: input.amountKobo,
        balanceAfter: wallet.balanceKobo,
        type: input.type,
        stream: input.stream,
        description: input.description,
        schoolId: input.schoolId ?? undefined,
        paymentId: input.paymentId,
        tutorSessionId: input.tutorSessionId,
        actorId: input.actorId,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  /**
   * Lesson happened: move the session's money out of escrow. The tutor gets their fee,
   * Nexus keeps the service charge. Safe to call twice — the second call does nothing.
   */
  async releaseEscrow(sessionId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.tutorSession.updateMany({
        where: { id: sessionId, escrowStatus: 'HELD' },
        data: { escrowStatus: 'RELEASED' },
      });
      if (claimed.count === 0) return false;

      const session = await tx.tutorSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: { booking: { include: { tutor: true } } },
      });
      const escrow = await this.platformWallet(tx, 'ESCROW');
      const tutorWallet = await this.userWallet(tx, session.booking.tutor.userId, 'TUTOR_EARNINGS');
      const platform = await this.platformWallet(tx, 'PLATFORM_REVENUE');
      const base = { stream: 'TUTORING' as const, tutorSessionId: session.id };

      await this.post(tx, { ...base, walletId: escrow.id, amountKobo: -session.totalKobo, type: 'ESCROW_RELEASE', description: `Released: ${reason}`, idempotencyKey: `release:${session.id}:escrow` });
      await this.post(tx, { ...base, walletId: tutorWallet.id, amountKobo: session.tutorFeeKobo, type: 'ESCROW_RELEASE', description: `Lesson payment (${reason})`, idempotencyKey: `release:${session.id}:tutor` });
      if (session.platformFeeKobo > 0n) {
        await this.post(tx, { ...base, walletId: platform.id, amountKobo: session.platformFeeKobo, type: 'PLATFORM_FEE', description: 'Service charge', idempotencyKey: `release:${session.id}:fee` });
      }
      return true;
    });
  }

  /** Dispute upheld: the session's money leaves escrow back to the parent. Safe to call twice. */
  async refundEscrow(sessionId: string, refundReference: string) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.tutorSession.updateMany({ where: { id: sessionId, escrowStatus: 'DISPUTED' }, data: { escrowStatus: 'REFUNDED' } });
      if (claimed.count === 0) return false;
      const session = await tx.tutorSession.findUniqueOrThrow({ where: { id: sessionId } });
      const escrow = await this.platformWallet(tx, 'ESCROW');
      await this.post(tx, {
        walletId: escrow.id,
        amountKobo: -session.totalKobo,
        type: 'REFUND',
        stream: 'TUTORING',
        description: `Refunded to parent (${refundReference || 'Squad'})`,
        tutorSessionId: session.id,
        paymentId: session.paymentId ?? undefined,
        idempotencyKey: `refund:${session.id}`,
      });
      return true;
    });
  }
}
