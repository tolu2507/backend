import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { formatNaira } from '../common/money.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

const accountInclude = {
  memberships: true,
  studentProfile: { include: { _count: { select: { invoices: true, tutorBookings: true, tutorRequests: true } } } },
  wallets: true,
  childrenLinks: {
    include: {
      student: {
        include: {
          user: { include: { wallets: true } },
          guardians: { select: { parentId: true } },
          _count: { select: { invoices: true, tutorBookings: true, tutorRequests: true } },
        },
      },
    },
  },
  _count: { select: { payments: true, rewardRedemptions: true, bookingsAsParent: true, tutorRequests: true } },
} satisfies Prisma.UserInclude;
type Account = Prisma.UserGetPayload<{ include: typeof accountInclude }>;

const balance = (wallets: { type: string; balanceKobo: bigint }[], type: string) => wallets.find((w) => w.type === type)?.balanceKobo ?? 0n;

/** Why a child can't be deleted from Overwatch, if anything stops it. */
function childBlockers(name: string, s: { user: { wallets: { type: string; balanceKobo: bigint }[] }; _count: { invoices: number; tutorBookings: number; tutorRequests: number } }) {
  const out: string[] = [];
  const pocket = balance(s.user.wallets, 'STUDENT_SPEND');
  if (pocket > 0n) out.push(`${name} still has ${formatNaira(pocket)} in their tuck-shop wallet. Refund it first.`);
  if (s._count.invoices) out.push(`${name} has school fee bills. Their school removes them from its register.`);
  if (s._count.tutorBookings || s._count.tutorRequests) out.push(`${name} has tutor lesson records, which have to be kept.`);
  return out;
}

/**
 * Overwatch: deleting parent and child accounts, and the privacy requests parents send from the app.
 * Money records (payments, airtime sent, the ledger) are kept as the law requires: an account that has them
 * is stripped of everything personal instead of removed.
 */
@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  private async account(userId: string): Promise<Account> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, include: accountInclude });
    if (!u) throw new NotFoundException('Account not found.');
    return u;
  }

  private kind(u: Account): 'PARENT' | 'STUDENT' {
    if (u.studentProfile) return 'STUDENT';
    const roles = u.memberships.map((m) => m.role);
    if (roles.length && roles.every((r) => r === 'PARENT')) return 'PARENT';
    throw new BadRequestException('Only parent and student accounts can be deleted here. Staff leave through their school; Overwatch admins can’t be deleted.');
  }

  /** Everything Overwatch shows before asking "Delete?": who goes, what's kept, and what stops it. */
  async deletePreview(userId: string) {
    const u = await this.account(userId);
    const kind = this.kind(u);
    const name = `${u.firstName} ${u.lastName}`;
    if (kind === 'STUDENT') {
      const s = u.studentProfile!;
      return {
        userId,
        kind,
        name,
        children: [],
        rewardsKobo: '0',
        keepsRecords: false,
        blockers: childBlockers(u.firstName, { user: { wallets: u.wallets }, _count: s._count }),
      };
    }
    const children = u.childrenLinks.map((g) => {
      const c = g.student;
      const others = c.guardians.filter((x) => x.parentId !== userId).length;
      return { studentId: c.id, userId: c.userId, name: `${c.user.firstName} ${c.user.lastName}`, otherParents: others, blockers: childBlockers(c.user.firstName, c) };
    });
    return {
      userId,
      kind,
      name,
      children,
      rewardsKobo: balance(u.wallets, 'REWARDS').toString(),
      keepsRecords: u._count.payments + u._count.rewardRedemptions + u._count.bookingsAsParent + u._count.tutorRequests > 0,
      blockers: [] as string[],
    };
  }

  /**
   * Deletes a child, or a parent (and, with `withChildren`, every child of theirs with no other parent on BrainBox).
   * Children who have another parent just lose the link.
   */
  async delete(adminId: string, userId: string, withChildren: boolean) {
    const preview = await this.deletePreview(userId);
    const goingChildren = preview.kind === 'PARENT' && withChildren ? preview.children.filter((c) => c.otherParents === 0) : [];
    const blockers = [...preview.blockers, ...goingChildren.flatMap((c) => c.blockers)];
    if (blockers.length) throw new BadRequestException(blockers.join(' '));

    let anonymised = false;
    await this.prisma.$transaction(async (tx) => {
      if (preview.kind === 'STUDENT') {
        await this.deleteChild(tx, userId);
      } else {
        for (const c of goingChildren) await this.deleteChild(tx, c.userId);
        anonymised = await this.deleteParent(tx, userId, preview.keepsRecords);
      }
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'account.deleted',
          entityType: 'User',
          entityId: userId,
          // No names or contact details: the point is that they're gone.
          meta: { kind: preview.kind, childrenDeleted: preview.kind === 'STUDENT' ? 1 : goingChildren.length, anonymised, rewardsForfeitedKobo: preview.rewardsKobo },
        },
      });
    });
    return { deleted: preview.kind === 'STUDENT' ? 1 : 1 + goingChildren.length, anonymised };
  }

  /** A child: their profile and all learning data go (cascades), then their login. Wallet history stays, unnamed. */
  private async deleteChild(tx: Tx, userId: string) {
    const profile = await tx.studentProfile.findUniqueOrThrow({ where: { userId }, select: { id: true } });
    await tx.dataRequest.updateMany({ where: { subjectId: profile.id, status: { not: 'DONE' } }, data: { status: 'DONE', completedAt: new Date() } });
    await tx.studentProfile.delete({ where: { id: profile.id } });
    await tx.user.delete({ where: { id: userId } });
  }

  /** A parent with money records keeps an anonymous row (the law needs the records); otherwise the account goes. */
  private async deleteParent(tx: Tx, userId: string, keepsRecords: boolean) {
    await tx.reportDelivery.deleteMany({ where: { parentId: userId } });
    // Consents they gave for a child who stays (with another parent) are the record of that consent: keep the row anonymous.
    const consentsKept = await tx.consent.count({ where: { givenById: userId } });
    if (!keepsRecords && !consentsKept) {
      await tx.user.delete({ where: { id: userId } });
      return false;
    }
    await tx.guardianship.deleteMany({ where: { parentId: userId } });
    await tx.membership.deleteMany({ where: { userId } });
    await Promise.all([
      tx.refreshToken.deleteMany({ where: { userId } }),
      tx.pushToken.deleteMany({ where: { userId } }),
      tx.passwordReset.deleteMany({ where: { userId } }),
      tx.supportTicket.deleteMany({ where: { userId } }),
    ]);
    await tx.dataRequest.updateMany({ where: { userId, status: { not: 'DONE' } }, data: { status: 'DONE', completedAt: new Date() } });
    await tx.user.update({
      where: { id: userId },
      data: {
        firstName: 'Deleted',
        lastName: 'user',
        otherNames: null,
        email: null,
        phone: null,
        username: null,
        passwordHash: null,
        pinHash: null,
        photoUrl: null,
        dateOfBirth: null,
        notificationPrefs: Prisma.DbNull,
        trialStartedAt: null,
        trialEndsAt: null,
        paidUntil: null,
      },
    });
    return true;
  }

  // ── Privacy requests from the app ─────────────────────

  async dataRequests(open: boolean) {
    const rows = await this.prisma.dataRequest.findMany({
      where: open ? { status: { not: 'DONE' } } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    });
    const children = await this.prisma.studentProfile.findMany({
      where: { id: { in: rows.map((r) => r.subjectId).filter((x): x is string => !!x) } },
      select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } },
    });
    const childBy = new Map(children.map((c) => [c.id, c]));
    return rows.map((r) => {
      const child = r.subjectId ? childBy.get(r.subjectId) : undefined;
      return {
        id: r.id,
        type: r.type,
        status: r.status,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
        parent: { userId: r.user.id, name: `${r.user.firstName} ${r.user.lastName}`, email: r.user.email, phone: r.user.phone },
        child: child ? { userId: child.userId, name: `${child.user.firstName} ${child.user.lastName}` } : null,
      };
    });
  }

  async setRequestStatus(adminId: string, id: string, status: 'PROCESSING' | 'DONE') {
    const r = await this.prisma.dataRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Request not found.');
    await this.prisma.dataRequest.update({ where: { id }, data: { status, completedAt: status === 'DONE' ? new Date() : null } });
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: `data-request.${status.toLowerCase()}`, entityType: 'DataRequest', entityId: id } });
    return { ok: true };
  }

  /** "Send me my data": everything we hold about a parent and their children, to send to them. */
  async export(adminId: string, userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        payments: { orderBy: { createdAt: 'asc' }, select: { reference: true, purpose: true, amountKobo: true, status: true, createdAt: true, paidAt: true } },
        rewardRedemptions: { orderBy: { createdAt: 'asc' }, select: { kind: true, network: true, phone: true, planName: true, amountKobo: true, status: true, createdAt: true } },
        consentsGiven: { select: { type: true, version: true, grantedAt: true, revokedAt: true, studentId: true } },
        childrenLinks: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true, username: true, createdAt: true } },
                exams: { include: { subjects: { include: { examSubject: { select: { name: true } } } } } },
                badges: { include: { badge: { select: { name: true } } } },
                mockSittings: { where: { submittedAt: { not: null } }, select: { score: true, nationalRank: true, submittedAt: true, mock: { select: { title: true } } } },
                weeklyReports: { select: { weekStart: true, headline: true, summary: true } },
              },
            },
          },
        },
        studentProfile: { select: { id: true } },
      },
    });
    if (!u) throw new NotFoundException('Account not found.');
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: 'account.exported', entityType: 'User', entityId: userId } });
    const money = (k: bigint) => Number(k) / 100;
    return {
      exportedAt: new Date(),
      account: { firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, createdAt: u.createdAt, trialEndsAt: u.trialEndsAt, paidUntil: u.paidUntil },
      payments: u.payments.map((p) => ({ ...p, amountNaira: money(p.amountKobo), amountKobo: undefined })),
      rewardsSent: u.rewardRedemptions.map((r) => ({ ...r, amountNaira: money(r.amountKobo), amountKobo: undefined })),
      consents: u.consentsGiven,
      children: u.childrenLinks.map(({ student: s, relationship }) => ({
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        username: s.user.username,
        relationship,
        class: s.gradeName,
        joined: s.user.createdAt,
        xp: s.xpTotal,
        longestStreak: s.longestStreak,
        coinsEarned: s.coinsTotal,
        exams: s.exams.map((e) => ({ exam: e.exam, targetYear: e.targetYear, subjects: e.subjects.map((x) => x.examSubject.name) })),
        stickers: s.badges.map((b) => ({ name: b.badge.name, awardedAt: b.awardedAt })),
        fridayMocks: s.mockSittings.map((m) => ({ mock: m.mock.title, score: m.score, nationalRank: m.nationalRank, at: m.submittedAt })),
        weeklyReports: s.weeklyReports,
      })),
    };
  }
}
