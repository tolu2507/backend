import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { addDays, lagosDay, lagosMidnightInstant } from '../common/dates.js';
import { formatNaira } from '../common/money.js';
import { formatShopCode, normaliseShopCode } from '../common/shop-code.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Seller } from './tuckshop.context.js';
import type { ChargeDto, PhonepayDto } from './tuckshop.dto.js';

const MAX_WRONG_PINS = 5;
const LOCK_MINUTES = 15;

const className = (c: { gradeName: string; armName: string | null } | undefined) => (c ? [c.gradeName, c.armName].filter(Boolean).join(' ') : null);

/**
 * The school tuck shop. Staff pick a child on their own phone, the child types their PIN on it,
 * and the price moves from the child's wallet to the school's. The child needs no phone or card.
 */
@Injectable()
export class TuckShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly messaging: MessagingService,
  ) {}

  classes(s: Seller) {
    return this.prisma.class
      .findMany({ where: { schoolId: s.schoolId }, orderBy: [{ gradeName: 'asc' }, { armName: 'asc' }] })
      .then((rows) => rows.map((c) => ({ id: c.id, name: className(c)! })));
  }

  /** Children of this school, by name or admission number. No balances: staff see one only after the PIN. */
  async students(s: Seller, q: { q?: string; classId?: string }) {
    const search = q.q?.trim();
    const thisYear = { academicYear: { isCurrent: true } };
    const rows = await this.prisma.studentProfile.findMany({
      where: {
        schoolId: s.schoolId,
        ...(q.classId ? { enrollments: { some: { ...thisYear, classId: q.classId } } } : {}),
        ...(search
          ? { OR: [{ admissionNo: { contains: search, mode: 'insensitive' } }, { user: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } }] }
          : {}),
      },
      include: { user: true, enrollments: { where: thisYear, include: { class: true }, take: 1 } },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
      take: 60,
    });
    const needsPin = !!(await this.prisma.school.findUnique({ where: { id: s.schoolId }, select: { tuckShopRequirePin: true } }))?.tuckShopRequirePin;
    return rows.map((p) => ({
      id: p.id,
      firstName: p.user.firstName,
      lastName: p.user.lastName,
      photoUrl: p.user.photoUrl,
      admissionNo: p.admissionNo,
      className: className(p.enrollments[0]?.class),
      shopCode: formatShopCode(p.shopCode),
      hasPin: !!p.user.pinHash,
      needsPin,
    }));
  }

  /** The counter types the ID printed on the child's slip: their tuck-shop ID or the school's admission number. */
  async lookup(s: Seller, code: string) {
    const typed = code.trim();
    if (!typed) throw new BadRequestException('Type the child’s tuck-shop ID or admission number.');
    const student = await this.prisma.studentProfile.findFirst({
      where: { schoolId: s.schoolId, OR: [{ shopCode: normaliseShopCode(typed) }, { admissionNo: { equals: typed, mode: 'insensitive' } }] },
      include: { user: true, school: true, enrollments: { where: { academicYear: { isCurrent: true } }, include: { class: true }, take: 1 } },
    });
    if (!student) throw new NotFoundException(`No child in your school has the ID “${typed}”. Check it, or search by name.`);
    return {
      id: student.id,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      photoUrl: student.user.photoUrl,
      admissionNo: student.admissionNo,
      shopCode: formatShopCode(student.shopCode),
      className: className(student.enrollments[0]?.class),
      hasPin: !!student.user.pinHash,
      needsPin: !!student.school?.tuckShopRequirePin,
    };
  }

  /** Counter sale. The PIN is only asked for when the school has switched that on. */
  async charge(s: Seller, dto: ChargeDto) {
    const student = await this.prisma.studentProfile.findFirst({ where: { id: dto.studentId, schoolId: s.schoolId }, include: { user: true, guardians: { where: { confirmedAt: { not: null } } }, school: true } });
    if (!student) throw new NotFoundException('We couldn’t find that child in your school.');
    const done = await this.alreadyDone(dto.requestId, student.userId, s.userId);
    if (done) return done;
    if (student.school?.tuckShopRequirePin) {
      if (!dto.pin) throw new BadRequestException(`Your school asks for ${student.user.firstName}’s PIN too.`);
      await this.checkPin(student.user, dto.pin);
    }
    return this.spend({ student, schoolId: s.schoolId, actorId: s.userId, amount: BigInt(dto.amountKobo), note: dto.note, requestId: dto.requestId });
  }

  /** A child pays the tuck shop from their own phone: amount, send. Their own sign-in is the security. */
  async payFromPhone(userId: string, dto: PhonepayDto) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId }, include: { user: true, guardians: { where: { confirmedAt: { not: null } } }, school: true } });
    if (!student) throw new NotFoundException('Student account not found.');
    const schoolId = student.schoolId ?? dto.schoolId;
    if (!schoolId) throw new BadRequestException('Pick the school you’re paying.');
    if (student.schoolId && dto.schoolId && dto.schoolId !== student.schoolId) throw new BadRequestException('You can only pay your own school’s tuck shop.');
    const school = student.schoolId ? student.school : await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school || school.status !== 'ACTIVE') throw new BadRequestException('That school isn’t taking payments on Nexus.');
    const done = await this.alreadyDone(dto.requestId, userId, userId);
    if (done) return { ...done, schoolName: school.name };
    const receipt = await this.spend({ student, schoolId, actorId: userId, amount: BigInt(dto.amountKobo), note: dto.note, requestId: dto.requestId });
    return { ...receipt, schoolName: school.name };
  }

  /** Schools a child without a school can pay. Active schools only. */
  async payableSchools(q?: string) {
    const search = q?.trim();
    const rows = await this.prisma.school.findMany({
      where: { status: 'ACTIVE', ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}) },
      orderBy: { name: 'asc' },
      take: 30,
    });
    return rows.map((r) => ({ id: r.id, name: r.name, state: r.state }));
  }

  /** The same sale sent twice (lost reply on bad Wi-Fi): hand back the first receipt instead of charging again. */
  private async alreadyDone(requestId: string, childUserId: string, actorId: string) {
    const done = await this.prisma.ledgerEntry.findUnique({ where: { idempotencyKey: `tuck:${requestId}:child` }, include: { wallet: { include: { user: true } } } });
    if (!done) return null;
    if (done.wallet.userId !== childUserId || done.actorId !== actorId) throw new BadRequestException('Start a new payment and try again.');
    return this.receipt(done, done.wallet.user!.firstName, done.wallet.user!.lastName);
  }

  private async spend(input: { student: { userId: string; dailySpendLimitKobo: bigint | null; user: { firstName: string; lastName: string }; guardians: { parentId: string }[] }; schoolId: string; actorId: string; amount: bigint; note?: string; requestId: string }) {
    const { student, schoolId, actorId, amount } = input;
    const { firstName, lastName } = student.user;
    const note = input.note?.trim();
    const key = `tuck:${input.requestId}`;
    const fromPhone = actorId === student.userId;
    const entry = await this.prisma.$transaction(async (tx) => {
      const wallet = await this.ledger.userWallet(tx, student.userId, 'STUDENT_SPEND');
      // One sale at a time per wallet, so two payments at once can't both slip under the daily limit.
      await tx.$executeRaw`SELECT 1 FROM "Wallet" WHERE id = ${wallet.id} FOR UPDATE`;
      if (wallet.isFrozen) throw new BadRequestException(`${firstName}’s wallet is paused. A parent or the school can explain why.`);
      const limit = student.dailySpendLimitKobo;
      if (limit !== null) {
        const left = limit - (await this.ledger.tuckShopSpentToday(tx, wallet.id));
        if (amount > left) {
          throw new BadRequestException(
            left <= 0n
              ? `${fromPhone ? 'You’ve' : `${firstName} has`} reached today’s limit of ${formatNaira(limit)}. A parent can change it in the Nexus app.`
              : `${fromPhone ? 'You' : firstName} can spend ${formatNaira(left)} more today (daily limit ${formatNaira(limit)}).`,
          );
        }
      }
      const balance = (await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).balanceKobo;
      if (balance < amount) {
        throw new BadRequestException(fromPhone ? `You only have ${formatNaira(balance)}. Ask a parent to top up.` : `${firstName} only has ${formatNaira(balance)}. Pick something cheaper, or ask a parent to top up.`);
      }
      const school = await this.ledger.schoolWallet(tx, schoolId);
      const base = { type: 'PURCHASE' as const, stream: 'TUCK_SHOP' as const, schoolId, actorId };
      const description = note ? `Tuck shop: ${note}` : 'Tuck shop';
      const child = await this.ledger.post(tx, { ...base, walletId: wallet.id, amountKobo: -amount, description, idempotencyKey: `${key}:child` });
      await this.ledger.post(tx, { ...base, walletId: school.id, amountKobo: amount, description: `${description} (${firstName} ${lastName}${fromPhone ? ', from phone' : ''})`, idempotencyKey: `${key}:school` });
      return child;
    });

    this.messaging.notify(
      student.guardians.map((g) => g.parentId),
      'payments',
      { title: `${firstName} spent ${formatNaira(amount)} at the tuck shop`, body: `${note ? `${note}. ` : ''}${formatNaira(entry.balanceAfter)} left in the wallet.`, url: '/parent/wallet' },
    );
    return this.receipt(entry, firstName, lastName);
  }

  /**
   * Wrong PINs are counted in the database, so restarting the server or switching phones
   * doesn't reset them. After five in a row the PIN is locked and the parents are told.
   */
  private async checkPin(user: { id: string; firstName: string; pinHash: string | null; pinLockedUntil: Date | null }, pin: string) {
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      const minutes = Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / 60_000);
      throw new ForbiddenException(`Too many wrong PINs. ${user.firstName} can try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or a parent can reset the PIN.`);
    }
    if (!user.pinHash) throw new BadRequestException(`${user.firstName} doesn’t have a PIN yet. A parent can set one in the Nexus app, or the school office can.`);

    if (await bcrypt.compare(pin, user.pinHash)) {
      await this.prisma.user.updateMany({ where: { id: user.id, pinFailures: { gt: 0 } }, data: { pinFailures: 0 } });
      return;
    }
    const { pinFailures } = await this.prisma.user.update({ where: { id: user.id }, data: { pinFailures: { increment: 1 } } });
    if (pinFailures < MAX_WRONG_PINS) {
      const left = MAX_WRONG_PINS - pinFailures;
      throw new BadRequestException(`Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { pinFailures: 0, pinLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } });
    const parents = await this.prisma.guardianship.findMany({ where: { student: { userId: user.id }, confirmedAt: { not: null } }, select: { parentId: true } });
    this.messaging.notify(
      parents.map((p) => p.parentId),
      'payments',
      { title: `${user.firstName}’s PIN is locked`, body: `Someone typed a wrong PIN ${MAX_WRONG_PINS} times at the tuck shop. It unlocks in ${LOCK_MINUTES} minutes, or you can change it now.`, url: '/parent/wallet' },
    );
    throw new ForbiddenException(`Too many wrong PINs. ${user.firstName}’s PIN is locked for ${LOCK_MINUTES} minutes.`);
  }

  private receipt(entry: { id: string; amountKobo: bigint; balanceAfter: bigint; description: string | null; createdAt: Date }, firstName: string, lastName: string) {
    return { id: entry.id, studentName: `${firstName} ${lastName}`, amountKobo: -entry.amountKobo, balanceKobo: entry.balanceAfter, note: noteOf(entry.description), createdAt: entry.createdAt };
  }

  /**
   * The counter's sales for a day (Lagos time): every staff member's, plus children paying from their
   * phones, so staff can see a phone payment arrive. Only owners and admins can look at other days.
   */
  async sales(s: Seller, date?: string) {
    const day = s.isAdmin && date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : lagosDay();
    if (Number.isNaN(day.getTime())) throw new BadRequestException('Pick a valid date.');
    const since = lagosMidnightInstant(day);
    const sales = await this.prisma.ledgerEntry.findMany({
      where: { schoolId: s.schoolId, stream: 'TUCK_SHOP', type: 'PURCHASE', amountKobo: { lt: 0 }, createdAt: { gte: since, lt: addDays(since, 1) } },
      include: { wallet: { include: { user: { select: { id: true, firstName: true, lastName: true } } } }, actor: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const refunded = new Set(
      (await this.prisma.ledgerEntry.findMany({ where: { idempotencyKey: { in: sales.map((e) => `refund:${e.id}:child`) } }, select: { idempotencyKey: true } })).map((r) => r.idempotencyKey!.split(':')[1]),
    );
    const items = sales.map((e) => ({
      id: e.id,
      studentName: e.wallet.user ? `${e.wallet.user.firstName} ${e.wallet.user.lastName}` : 'Student',
      amountKobo: -e.amountKobo,
      note: noteOf(e.description),
      createdAt: e.createdAt,
      refunded: refunded.has(e.id),
      fromPhone: e.actorId === e.wallet.user?.id,
      soldBy: e.actorId === e.wallet.user?.id ? 'Paid from phone' : e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : null,
      mine: e.actorId === s.userId,
    }));
    const kept = items.filter((i) => !i.refunded);
    return { totalKobo: kept.reduce((sum, i) => sum + i.amountKobo, 0n), count: kept.length, items };
  }

  /**
   * Undo a sale made by mistake, the same day. Staff undo their own sales and any phone payment
   * (a child who paid the wrong amount); admins can undo any. Safe to tap twice.
   */
  async refund(s: Seller, entryId: string) {
    const sale = await this.prisma.ledgerEntry.findUnique({ where: { id: entryId }, include: { wallet: { include: { user: true } } } });
    if (!sale || sale.schoolId !== s.schoolId || sale.stream !== 'TUCK_SHOP' || sale.type !== 'PURCHASE' || sale.amountKobo >= 0n || !sale.idempotencyKey) {
      throw new NotFoundException('Sale not found.');
    }
    const fromPhone = sale.actorId === sale.wallet.userId;
    if (!s.isAdmin && !fromPhone && sale.actorId !== s.userId) throw new ForbiddenException('Only the person who made this sale can undo it.');
    if (sale.createdAt < lagosMidnightInstant(lagosDay())) throw new BadRequestException('Sales can only be undone on the day they were made. Ask the school office.');

    const amount = -sale.amountKobo;
    const schoolKey = sale.idempotencyKey.replace(/:child$/, ':school');
    const entry = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const school = await this.ledger.schoolWallet(tx, s.schoolId);
      const base = { type: 'REFUND' as const, stream: 'TUCK_SHOP' as const, schoolId: s.schoolId, actorId: s.userId };
      if (!(await tx.ledgerEntry.findUnique({ where: { idempotencyKey: schoolKey } }))) throw new BadRequestException('This sale can’t be undone here. Ask the school office.');
      await this.ledger.post(tx, { ...base, walletId: school.id, amountKobo: -amount, description: 'Tuck shop sale undone', idempotencyKey: `refund:${sale.id}:school` });
      return this.ledger.post(tx, { ...base, walletId: sale.walletId, amountKobo: amount, description: 'Tuck shop refund', idempotencyKey: `refund:${sale.id}:child` });
    });
    const name = sale.wallet.user?.firstName ?? 'The child';
    return { ok: true, message: `${formatNaira(amount)} is back in ${name}’s wallet.`, balanceKobo: entry.balanceAfter };
  }
}

function noteOf(description: string | null) {
  return description?.startsWith('Tuck shop: ') ? description.slice('Tuck shop: '.length) : null;
}
