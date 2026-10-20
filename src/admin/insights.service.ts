import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type LedgerEntryType, type PaymentPurpose, type PaymentStatus, type RevenueStream, type Role, type WalletType } from '@prisma/client';

import { aiPricing, AiService, lagosMonthStart, microUsdToKobo } from '../ai/ai.service.js';
import { addDays, lagosDay } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { planPriceKobo } from '../settings/settings.js';
import { SettingsService } from '../settings/settings.service.js';

export type Page = { page?: number; pageSize?: number };
export type PeopleKind = 'STUDENT' | 'PARENT' | 'STAFF' | 'TUTOR';

const STAFF_ROLES: Role[] = ['SCHOOL_OWNER', 'SCHOOL_ADMIN', 'TEACHER', 'TUCK_SHOP'];
// Platform wallets keep escrow and fees flowing; freezing them would stop every lesson payment.
const UNFREEZABLE: WalletType[] = ['ESCROW', 'PLATFORM_REVENUE'];

/** Lagos calendar day of a timestamp column, as 'YYYY-MM-DD'. Columns are stored as UTC without a zone. */
const day = (col: string) => Prisma.raw(`to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD')`);
const contains = (q: string) => ({ contains: q, mode: 'insensitive' as const });
const nameSearch = (q?: string) =>
  q?.trim() ? { OR: [{ firstName: contains(q.trim()) }, { lastName: contains(q.trim()) }, { email: contains(q.trim()) }, { phone: contains(q.trim()) }, { username: contains(q.trim()) }] } : {};
const pageArgs = ({ page = 1, pageSize = 25 }: Page) => ({ skip: (Math.max(1, page) - 1) * pageSize, take: Math.min(Math.max(1, pageSize), 500) });
const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/** Every Lagos day from `since` to today, so charts show gaps as zero instead of skipping them. */
function dayKeys(days: number) {
  const today = lagosDay();
  return Array.from({ length: days }, (_, i) => addDays(today, i - days + 1).toISOString().slice(0, 10));
}
function fill<T extends { day: string }>(keys: string[], rows: T[], empty: Omit<T, 'day'>): T[] {
  const by = new Map(rows.map((r) => [r.day, r]));
  return keys.map((k) => by.get(k) ?? ({ day: k, ...empty } as T));
}
const pct = (now: number, before: number) => (before === 0 ? (now === 0 ? 0 : null) : Math.round(((now - before) / before) * 1000) / 10);

/** Overwatch's read side: analytics, directories, activity, money and AI across every school. */
@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly settings: SettingsService,
  ) {}

  // ── Platform analytics ─────────────────────────────────

  async analytics(days: number) {
    const since = addDays(new Date(), -days);
    const before = addDays(since, -days);
    const keys = dayKeys(days);
    const p = this.prisma;
    const paid = (from: Date, to?: Date) => p.payment.aggregate({ where: { status: 'SUCCESS', paidAt: { gte: from, ...(to ? { lt: to } : {}) } }, _sum: { amountKobo: true }, _count: true });
    const fees = (from: Date, to?: Date) => p.ledgerEntry.aggregate({ where: { amountKobo: { gt: 0 }, wallet: { type: 'PLATFORM_REVENUE' }, createdAt: { gte: from, ...(to ? { lt: to } : {}) } }, _sum: { amountKobo: true } });
    const aiCost = (from: Date, to?: Date) => p.aiUsage.aggregate({ where: { createdAt: { gte: from, ...(to ? { lt: to } : {}) } }, _sum: { costMicroUsd: true }, _count: true });
    const learners = (from: Date, to: Date) => p.$queryRaw<{ c: number }[]>`SELECT COUNT(DISTINCT "studentId")::int AS c FROM "ActivityAttempt" WHERE "completedAt" >= ${from} AND "completedAt" < ${to}`;
    const signups = (from: Date, to?: Date) => p.user.count({ where: { createdAt: { gte: from, ...(to ? { lt: to } : {}) } } });

    const [schools, students, parents, staff, tutors, payNow, payBefore, feeNow, feeBefore, aiNow, aiBefore, learnNow, learnBefore, signNow, signBefore, plans] = await Promise.all([
      p.school.groupBy({ by: ['status'], _count: true }),
      p.studentProfile.count(),
      p.membership.count({ where: { role: 'PARENT' } }),
      p.membership.count({ where: { role: { in: STAFF_ROLES } } }),
      p.tutorProfile.groupBy({ by: ['verificationStatus'], _count: true }),
      paid(since),
      paid(before, since),
      fees(since),
      fees(before, since),
      aiCost(since),
      aiCost(before, since),
      learners(since, new Date()),
      learners(before, since),
      signups(since),
      signups(before, since),
      // Parent plans right now. A trial starts when the parent first opens the app with a child on the account.
      p.$queryRaw<{ paying: number; trial: number; ended: number }[]>`SELECT
        COUNT(*) FILTER (WHERE "paidUntil" > now())::int AS paying,
        COUNT(*) FILTER (WHERE "trialEndsAt" > now() AND ("paidUntil" IS NULL OR "paidUntil" <= now()))::int AS trial,
        COUNT(*) FILTER (WHERE "trialEndsAt" IS NOT NULL AND GREATEST("trialEndsAt", COALESCE("paidUntil", "trialEndsAt")) <= now())::int AS ended
        FROM "User"`,
    ]);

    const [signupDays, payDays, learnDays, aiDays, actDays, byPurpose, bySchoolPay, schoolRows] = await Promise.all([
      p.$queryRaw<{ day: string; users: number }[]>`SELECT ${day('"createdAt"')} AS day, COUNT(*)::int AS users FROM "User" WHERE "createdAt" >= ${since} GROUP BY 1`,
      p.$queryRaw<{ day: string; amountKobo: bigint; payments: number }[]>`SELECT ${day('"paidAt"')} AS day, SUM("amountKobo")::bigint AS "amountKobo", COUNT(*)::int AS payments FROM "Payment" WHERE status = 'SUCCESS' AND "paidAt" >= ${since} GROUP BY 1`,
      p.$queryRaw<{ day: string; attempts: number; learners: number; avgScore: number | null }[]>`SELECT ${day('"completedAt"')} AS day, COUNT(*)::int AS attempts, COUNT(DISTINCT "studentId")::int AS learners, AVG(score)::float AS "avgScore" FROM "ActivityAttempt" WHERE "completedAt" >= ${since} GROUP BY 1`,
      p.$queryRaw<{ day: string; costMicroUsd: bigint; calls: number }[]>`SELECT ${day('"createdAt"')} AS day, SUM("costMicroUsd")::bigint AS "costMicroUsd", COUNT(*)::int AS calls FROM "AiUsage" WHERE "createdAt" >= ${since} GROUP BY 1`,
      p.$queryRaw<{ day: string; events: number }[]>`SELECT ${day('"createdAt"')} AS day, COUNT(*)::int AS events FROM "AuditLog" WHERE "createdAt" >= ${since} GROUP BY 1`,
      p.payment.groupBy({ by: ['purpose'], where: { status: 'SUCCESS', paidAt: { gte: since } }, _sum: { amountKobo: true }, _count: true }),
      p.payment.groupBy({ by: ['schoolId'], where: { status: 'SUCCESS', paidAt: { gte: since }, schoolId: { not: null } }, _sum: { amountKobo: true } }),
      p.school.findMany({ select: { id: true, name: true, status: true, _count: { select: { students: true } } } }),
    ]);

    const series = keys.map((k) => {
      const s = signupDays.find((r) => r.day === k);
      const pay = payDays.find((r) => r.day === k);
      const l = learnDays.find((r) => r.day === k);
      const a = aiDays.find((r) => r.day === k);
      const e = actDays.find((r) => r.day === k);
      return {
        day: k,
        signups: s?.users ?? 0,
        paymentsKobo: n(pay?.amountKobo),
        payments: pay?.payments ?? 0,
        attempts: l?.attempts ?? 0,
        learners: l?.learners ?? 0,
        avgScore: l?.avgScore === null || l?.avgScore === undefined ? null : Math.round(l.avgScore * 100),
        aiCostKobo: n(microUsdToKobo(n(a?.costMicroUsd))),
        aiCalls: a?.calls ?? 0,
        events: e?.events ?? 0,
      };
    });

    const paidBySchool = new Map(bySchoolPay.map((r) => [r.schoolId, n(r._sum.amountKobo)]));
    const tutorCounts = Object.fromEntries(tutors.map((t) => [t.verificationStatus, t._count]));
    const kpi = (now: number, prev: number) => ({ value: now, previous: prev, changePct: pct(now, prev) });
    return {
      days,
      totals: {
        schools: Object.fromEntries(schools.map((s) => [s.status, s._count])),
        students,
        parents,
        staff,
        tutors: { verified: tutorCounts.VERIFIED ?? 0, total: tutors.reduce((a, t) => a + t._count, 0) },
        plans: { ...plans[0], priceKobo: Number(planPriceKobo(await this.settings.get())) },
      },
      kpis: {
        paymentsKobo: kpi(n(payNow._sum.amountKobo), n(payBefore._sum.amountKobo)),
        platformRevenueKobo: kpi(n(feeNow._sum.amountKobo), n(feeBefore._sum.amountKobo)),
        aiCostKobo: kpi(n(microUsdToKobo(n(aiNow._sum.costMicroUsd))), n(microUsdToKobo(n(aiBefore._sum.costMicroUsd)))),
        activeLearners: kpi(learnNow[0]?.c ?? 0, learnBefore[0]?.c ?? 0),
        signups: kpi(signNow, signBefore),
      },
      series,
      paymentsByPurpose: byPurpose.map((r) => ({ purpose: r.purpose, count: r._count, amountKobo: n(r._sum.amountKobo) })),
      topSchools: schoolRows
        .map((s) => ({ id: s.id, name: s.name, status: s.status, students: s._count.students, paymentsKobo: paidBySchool.get(s.id) ?? 0 }))
        .sort((a, b) => b.paymentsKobo - a.paymentsKobo || b.students - a.students)
        .slice(0, 8),
    };
  }

  // ── People directories ─────────────────────────────────

  async peopleCounts() {
    const [STUDENT, PARENT, STAFF, TUTOR] = await Promise.all([
      this.prisma.studentProfile.count(),
      this.prisma.membership.count({ where: { role: 'PARENT' } }),
      this.prisma.membership.count({ where: { role: { in: STAFF_ROLES } } }),
      this.prisma.tutorProfile.count(),
    ]);
    return { STUDENT, PARENT, STAFF, TUTOR };
  }

  async people(kind: PeopleKind, f: Page & { q?: string; schoolId?: string; status?: string }) {
    const page = pageArgs(f);
    const userSelect = { id: true, firstName: true, lastName: true, email: true, phone: true, username: true, lastLoginAt: true, createdAt: true } as const;

    if (kind === 'STUDENT') {
      const where: Prisma.StudentProfileWhereInput = { ...(f.schoolId ? { schoolId: f.schoolId } : {}), user: nameSearch(f.q) };
      const [total, rows] = await Promise.all([
        this.prisma.studentProfile.count({ where }),
        this.prisma.studentProfile.findMany({
          where,
          ...page,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { ...userSelect, wallets: { where: { type: 'STUDENT_SPEND' }, select: { balanceKobo: true, isFrozen: true } } } },
            school: { select: { id: true, name: true } },
            enrollments: { take: 1, orderBy: { academicYear: { startDate: 'desc' } }, include: { class: { select: { gradeName: true, armName: true } } } },
            _count: { select: { guardians: true, attempts: true } },
          },
        }),
      ]);
      return {
        total,
        rows: rows.map((s) => {
          const c = s.enrollments[0]?.class;
          return {
            id: s.id,
            userId: s.user.id,
            name: `${s.user.firstName} ${s.user.lastName}`,
            username: s.user.username,
            school: s.school,
            className: c ? `${c.gradeName}${c.armName ? ` ${c.armName}` : ''}` : s.gradeName,
            level: s.level,
            xp: s.xpTotal,
            streak: s.currentStreak,
            lastActive: s.lastActiveDate,
            quests: s._count.attempts,
            parents: s._count.guardians,
            walletKobo: n(s.user.wallets[0]?.balanceKobo),
            walletFrozen: s.user.wallets[0]?.isFrozen ?? false,
            joined: s.createdAt,
          };
        }),
      };
    }

    if (kind === 'PARENT') {
      const where: Prisma.MembershipWhereInput = {
        role: 'PARENT',
        user: { ...nameSearch(f.q), ...(f.schoolId ? { childrenLinks: { some: { student: { schoolId: f.schoolId } } } } : {}) },
      };
      const [total, rows] = await Promise.all([
        this.prisma.membership.count({ where }),
        this.prisma.membership.findMany({
          where,
          ...page,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                ...userSelect,
                childrenLinks: { include: { student: { select: { id: true, user: { select: { firstName: true, lastName: true } }, school: { select: { id: true, name: true } } } } } },
                _count: { select: { bookingsAsParent: true, payments: true } },
              },
            },
          },
        }),
      ]);
      return {
        total,
        rows: rows.map((m) => ({
          id: m.user.id,
          name: `${m.user.firstName} ${m.user.lastName}`,
          email: m.user.email,
          phone: m.user.phone,
          children: m.user.childrenLinks.map((g) => ({ id: g.student.id, name: `${g.student.user.firstName} ${g.student.user.lastName}`, school: g.student.school?.name ?? null, relationship: g.relationship })),
          bookings: m.user._count.bookingsAsParent,
          payments: m.user._count.payments,
          lastLoginAt: m.user.lastLoginAt,
          joined: m.createdAt,
        })),
      };
    }

    if (kind === 'STAFF') {
      const where: Prisma.MembershipWhereInput = {
        role: f.status && STAFF_ROLES.includes(f.status as Role) ? (f.status as Role) : { in: STAFF_ROLES },
        ...(f.schoolId ? { schoolId: f.schoolId } : {}),
        user: nameSearch(f.q),
      };
      const [total, rows] = await Promise.all([
        this.prisma.membership.count({ where }),
        this.prisma.membership.findMany({
          where,
          ...page,
          orderBy: { createdAt: 'desc' },
          include: { school: { select: { id: true, name: true } }, user: { select: { ...userSelect, passwordHash: true, _count: { select: { taughtSubjects: true, formClasses: true, notesWritten: true } } } } },
        }),
      ]);
      return {
        total,
        rows: rows.map((m) => ({
          id: m.id,
          userId: m.user.id,
          name: `${m.user.firstName} ${m.user.lastName}`,
          email: m.user.email,
          phone: m.user.phone,
          role: m.role,
          status: m.status,
          school: m.school,
          subjectsTaught: m.user._count.taughtSubjects,
          formClasses: m.user._count.formClasses,
          notesWritten: m.user._count.notesWritten,
          invited: !m.user.passwordHash, // hasn't set a password yet
          lastLoginAt: m.user.lastLoginAt,
          joined: m.createdAt,
        })),
      };
    }

    const where: Prisma.TutorProfileWhereInput = {
      ...(f.status ? { verificationStatus: f.status as Prisma.EnumVerificationStatusFilter['equals'] } : {}),
      user: nameSearch(f.q),
    };
    const [total, rows] = await Promise.all([
      this.prisma.tutorProfile.count({ where }),
      this.prisma.tutorProfile.findMany({
        where,
        ...page,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { ...userSelect, wallets: { where: { type: 'TUTOR_EARNINGS' }, select: { balanceKobo: true } } } },
          subjects: { where: { approvedAt: { not: null } }, select: { subject: true, level: true } },
          _count: { select: { bookings: true, reviews: true } },
        },
      }),
    ]);
    return {
      total,
      rows: rows.map((t) => ({
        id: t.id,
        userId: t.user.id,
        name: `${t.user.firstName} ${t.user.lastName}`,
        email: t.user.email,
        phone: t.user.phone,
        state: t.state,
        status: t.verificationStatus,
        subjects: t.subjects.map((s) => s.subject),
        rateKobo: n(t.rateKobo),
        rating: t.ratingCount ? Math.round(t.ratingAvg * 10) / 10 : null,
        reviews: t.ratingCount,
        bookings: t._count.bookings,
        earningsKobo: n(t.user.wallets[0]?.balanceKobo),
        accepting: t.isAcceptingStudents,
        lastLoginAt: t.user.lastLoginAt,
        joined: t.createdAt,
      })),
    };
  }

  // ── Activity log ───────────────────────────────────────

  async activity(f: Page & { schoolId?: string; actorId?: string; q?: string; days?: number }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(f.schoolId === 'none' ? { schoolId: null } : f.schoolId ? { schoolId: f.schoolId } : {}),
      ...(f.actorId ? { actorId: f.actorId } : {}),
      ...(f.days ? { createdAt: { gte: addDays(new Date(), -f.days) } } : {}),
      ...(f.q?.trim() ? { OR: [{ action: contains(f.q.trim()) }, { actor: nameSearch(f.q) }] } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        ...pageArgs(f),
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, firstName: true, lastName: true, memberships: { select: { role: true, schoolId: true } } } } },
      }),
    ]);
    const schoolIds = [...new Set(rows.map((r) => r.schoolId).filter(Boolean))] as string[];
    const schools = new Map((await this.prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true } })).map((s) => [s.id, s.name]));
    return {
      total,
      rows: rows.map((r) => {
        const roles = r.actor?.memberships.filter((m) => !r.schoolId || m.schoolId === r.schoolId || m.schoolId === null).map((m) => m.role) ?? [];
        return {
          id: r.id,
          at: r.createdAt,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          actor: r.actor ? { id: r.actor.id, name: `${r.actor.firstName} ${r.actor.lastName}`, role: roles[0] ?? null } : null,
          school: r.schoolId ? { id: r.schoolId, name: schools.get(r.schoolId) ?? 'Unknown school' } : null,
          ip: r.ip,
          meta: r.meta,
        };
      }),
    };
  }

  /** Per school: how busy it is, who is using it, and when it was last used. Quiet schools show up at the top. */
  async activitySummary(days: number) {
    const since = addDays(new Date(), -days);
    const [schools, stats, logins, daily] = await Promise.all([
      this.prisma.school.findMany({ select: { id: true, name: true, status: true, _count: { select: { students: true } } } }),
      this.prisma.$queryRaw<{ schoolId: string; events: number; people: number; last: Date }[]>`
        SELECT "schoolId", COUNT(*)::int AS events, COUNT(DISTINCT "actorId")::int AS people, MAX("createdAt") AS last
        FROM "AuditLog" WHERE "schoolId" IS NOT NULL AND "createdAt" >= ${since} GROUP BY 1`,
      this.prisma.$queryRaw<{ schoolId: string; logins: number }[]>`
        SELECT "schoolId", COUNT(*)::int AS logins FROM "AuditLog" WHERE action = 'auth.login' AND "schoolId" IS NOT NULL AND "createdAt" >= ${since} GROUP BY 1`,
      this.prisma.$queryRaw<{ day: string; events: number }[]>`SELECT ${day('"createdAt"')} AS day, COUNT(*)::int AS events FROM "AuditLog" WHERE "createdAt" >= ${since} GROUP BY 1`,
    ]);
    const lastEver = await this.prisma.auditLog.groupBy({ by: ['schoolId'], where: { schoolId: { not: null } }, _max: { createdAt: true } });
    const s = new Map(stats.map((r) => [r.schoolId, r]));
    const l = new Map(logins.map((r) => [r.schoolId, r.logins]));
    const ever = new Map(lastEver.map((r) => [r.schoolId, r._max.createdAt]));
    return {
      series: fill(dayKeys(days), daily, { events: 0 }),
      schools: schools
        .map((x) => ({ id: x.id, name: x.name, status: x.status, students: x._count.students, events: s.get(x.id)?.events ?? 0, people: s.get(x.id)?.people ?? 0, logins: l.get(x.id) ?? 0, lastActivity: ever.get(x.id) ?? null }))
        .sort((a, b) => a.events - b.events),
    };
  }

  // ── Wallets ────────────────────────────────────────────

  async wallets(f: Page & { type?: WalletType; q?: string; frozen?: boolean }) {
    const q = f.q?.trim();
    const where: Prisma.WalletWhereInput = {
      ...(f.type ? { type: f.type } : {}),
      ...(f.frozen !== undefined ? { isFrozen: f.frozen } : {}),
      ...(q ? { OR: [{ user: nameSearch(q) }, { school: { name: contains(q) } }] } : {}),
    };
    const [total, rows, totals] = await Promise.all([
      this.prisma.wallet.count({ where }),
      this.prisma.wallet.findMany({
        where,
        ...pageArgs(f),
        orderBy: [{ balanceKobo: 'desc' }, { updatedAt: 'desc' }],
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, studentProfile: { select: { school: { select: { name: true } } } } } }, school: { select: { id: true, name: true } }, _count: { select: { entries: true } } },
      }),
      this.prisma.wallet.groupBy({ by: ['type'], _sum: { balanceKobo: true }, _count: true }),
    ]);
    return {
      total,
      totals: totals.map((t) => ({ type: t.type, wallets: t._count, balanceKobo: n(t._sum.balanceKobo) })),
      rows: rows.map((w) => ({
        id: w.id,
        type: w.type,
        owner: w.user ? `${w.user.firstName} ${w.user.lastName}` : w.school?.name ?? 'BrainBox (platform)',
        contact: w.user?.email ?? w.user?.phone ?? null,
        school: w.school?.name ?? w.user?.studentProfile?.school?.name ?? null,
        balanceKobo: n(w.balanceKobo),
        isFrozen: w.isFrozen,
        canFreeze: !UNFREEZABLE.includes(w.type),
        entries: w._count.entries,
        updatedAt: w.updatedAt,
      })),
    };
  }

  async wallet(id: string) {
    const w = await this.prisma.wallet.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        school: { select: { name: true } },
        entries: { orderBy: { createdAt: 'desc' }, take: 200, include: { actor: { select: { firstName: true, lastName: true } }, payment: { select: { reference: true } } } },
      },
    });
    if (!w) throw new NotFoundException('Wallet not found.');
    const sums = await this.prisma.ledgerEntry.groupBy({ by: ['type'], where: { walletId: id }, _sum: { amountKobo: true }, _count: true });
    return {
      id: w.id,
      type: w.type,
      owner: w.user ? `${w.user.firstName} ${w.user.lastName}` : w.school?.name ?? 'BrainBox (platform)',
      contact: w.user?.email ?? w.user?.phone ?? null,
      balanceKobo: n(w.balanceKobo),
      isFrozen: w.isFrozen,
      canFreeze: !UNFREEZABLE.includes(w.type),
      createdAt: w.createdAt,
      byType: sums.map((s) => ({ type: s.type, count: s._count, amountKobo: n(s._sum.amountKobo) })),
      entries: w.entries.map((e) => ({
        id: e.id,
        at: e.createdAt,
        type: e.type,
        stream: e.stream,
        amountKobo: n(e.amountKobo),
        balanceAfterKobo: n(e.balanceAfter),
        description: e.description,
        actor: e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : null,
        reference: e.payment?.reference ?? null,
      })),
    };
  }

  async setWalletFrozen(adminId: string, id: string, frozen: boolean, reason?: string) {
    const w = await this.prisma.wallet.findUnique({ where: { id }, include: { user: { select: { studentProfile: { select: { schoolId: true } } } } } });
    if (!w) throw new NotFoundException('Wallet not found.');
    if (UNFREEZABLE.includes(w.type)) throw new BadRequestException('Platform wallets can’t be frozen: lesson payments and fees would stop.');
    await this.prisma.$transaction([
      this.prisma.wallet.update({ where: { id }, data: { isFrozen: frozen } }),
      this.prisma.auditLog.create({ data: { actorId: adminId, action: frozen ? 'wallet.freeze' : 'wallet.unfreeze', entityType: 'Wallet', entityId: id, schoolId: w.schoolId ?? w.user?.studentProfile?.schoolId ?? null, meta: { reason: reason ?? null } } }),
    ]);
    return { ok: true, isFrozen: frozen };
  }

  // ── Transactions ───────────────────────────────────────

  async transactions(f: Page & { type?: LedgerEntryType; stream?: RevenueStream; schoolId?: string; walletType?: WalletType; from?: string; to?: string; q?: string }) {
    const createdAt = { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lt: addDays(new Date(f.to), 1) } : {}) };
    const q = f.q?.trim();
    const where: Prisma.LedgerEntryWhereInput = {
      ...(f.type ? { type: f.type } : {}),
      ...(f.stream ? { stream: f.stream } : {}),
      ...(f.schoolId ? { schoolId: f.schoolId } : {}),
      ...(f.walletType ? { wallet: { type: f.walletType } } : {}),
      ...(f.from || f.to ? { createdAt } : {}),
      ...(q ? { OR: [{ description: contains(q) }, { payment: { reference: contains(q) } }, { wallet: { user: nameSearch(q) } }] } : {}),
    };
    const [total, rows, byType] = await Promise.all([
      this.prisma.ledgerEntry.count({ where }),
      this.prisma.ledgerEntry.findMany({
        where,
        ...pageArgs(f),
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: { select: { id: true, type: true, user: { select: { firstName: true, lastName: true } }, school: { select: { name: true } } } },
          school: { select: { name: true } },
          actor: { select: { firstName: true, lastName: true } },
          payment: { select: { reference: true } },
        },
      }),
      this.prisma.ledgerEntry.groupBy({ by: ['type'], where, _sum: { amountKobo: true }, _count: true }),
    ]);
    return {
      total,
      byType: byType.map((t) => ({ type: t.type, count: t._count, amountKobo: n(t._sum.amountKobo) })),
      rows: rows.map((e) => ({
        id: e.id,
        at: e.createdAt,
        type: e.type,
        stream: e.stream,
        amountKobo: n(e.amountKobo),
        balanceAfterKobo: n(e.balanceAfter),
        description: e.description,
        wallet: { id: e.wallet.id, type: e.wallet.type, owner: e.wallet.user ? `${e.wallet.user.firstName} ${e.wallet.user.lastName}` : e.wallet.school?.name ?? 'BrainBox (platform)' },
        school: e.school?.name ?? null,
        actor: e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : null,
        reference: e.payment?.reference ?? null,
      })),
    };
  }

  /** Money in and out per day, for the transactions chart. */
  async moneyFlow(days: number) {
    const since = addDays(new Date(), -days);
    const [ledger, payments] = await Promise.all([
      this.prisma.$queryRaw<{ day: string; inKobo: bigint; outKobo: bigint; entries: number }[]>`
        SELECT ${day('"createdAt"')} AS day,
          COALESCE(SUM(CASE WHEN "amountKobo" > 0 THEN "amountKobo" END), 0)::bigint AS "inKobo",
          COALESCE(-SUM(CASE WHEN "amountKobo" < 0 THEN "amountKobo" END), 0)::bigint AS "outKobo",
          COUNT(*)::int AS entries
        FROM "LedgerEntry" WHERE "createdAt" >= ${since} GROUP BY 1`,
      this.prisma.$queryRaw<{ day: string; status: string; amountKobo: bigint; count: number }[]>`
        SELECT ${day('"createdAt"')} AS day, status::text AS status, SUM("amountKobo")::bigint AS "amountKobo", COUNT(*)::int AS count
        FROM "Payment" WHERE "createdAt" >= ${since} GROUP BY 1, 2`,
    ]);
    const keys = dayKeys(days);
    return keys.map((k) => {
      const l = ledger.find((r) => r.day === k);
      const ps = payments.filter((r) => r.day === k);
      const of = (s: string) => ps.find((r) => r.status === s);
      return {
        day: k,
        creditsKobo: n(l?.inKobo),
        debitsKobo: n(l?.outKobo),
        entries: l?.entries ?? 0,
        paidKobo: n(of('SUCCESS')?.amountKobo),
        failedPayments: of('FAILED')?.count ?? 0,
        pendingPayments: of('PENDING')?.count ?? 0,
      };
    });
  }

  async payments(f: Page & { status?: PaymentStatus; purpose?: PaymentPurpose; schoolId?: string; q?: string }) {
    const q = f.q?.trim();
    const where: Prisma.PaymentWhereInput = {
      ...(f.status ? { status: f.status } : {}),
      ...(f.purpose ? { purpose: f.purpose } : {}),
      ...(f.schoolId ? { schoolId: f.schoolId } : {}),
      ...(q ? { OR: [{ reference: contains(q) }, { providerRef: contains(q) }, { payer: nameSearch(q) }] } : {}),
    };
    const [total, rows, byStatus] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({ where, ...pageArgs(f), orderBy: { createdAt: 'desc' }, include: { payer: { select: { firstName: true, lastName: true, email: true, phone: true } }, school: { select: { name: true } } } }),
      this.prisma.payment.groupBy({ by: ['status'], where, _sum: { amountKobo: true }, _count: true }),
    ]);
    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count, amountKobo: n(s._sum.amountKobo) })),
      rows: rows.map((p) => ({
        id: p.id,
        reference: p.reference,
        provider: p.provider,
        providerRef: p.providerRef,
        purpose: p.purpose,
        status: p.status,
        amountKobo: n(p.amountKobo),
        payer: `${p.payer.firstName} ${p.payer.lastName}`,
        payerContact: p.payer.email ?? p.payer.phone,
        school: p.school?.name ?? null,
        createdAt: p.createdAt,
        paidAt: p.paidAt,
      })),
    };
  }

  // ── AI usage & cost ────────────────────────────────────

  async aiUsage(days: number) {
    const since = addDays(new Date(), -days);
    const month = lagosMonthStart();
    const where = { createdAt: { gte: since } };
    const [totals, failures, daily, byFeature, bySchool, monthBySchool, schools, recent, monthTotal] = await Promise.all([
      this.prisma.aiUsage.aggregate({ where, _sum: { costMicroUsd: true, inputTokens: true, outputTokens: true }, _count: true, _avg: { latencyMs: true } }),
      this.prisma.aiUsage.count({ where: { ...where, ok: false } }),
      this.prisma.$queryRaw<{ day: string; costMicroUsd: bigint; calls: number; failed: number; tokens: bigint }[]>`
        SELECT ${day('"createdAt"')} AS day, SUM("costMicroUsd")::bigint AS "costMicroUsd", COUNT(*)::int AS calls,
          COUNT(*) FILTER (WHERE NOT ok)::int AS failed, SUM("inputTokens" + "outputTokens")::bigint AS tokens
        FROM "AiUsage" WHERE "createdAt" >= ${since} GROUP BY 1`,
      this.prisma.aiUsage.groupBy({ by: ['feature'], where, _sum: { costMicroUsd: true, inputTokens: true, outputTokens: true }, _count: true }),
      this.prisma.aiUsage.groupBy({ by: ['schoolId'], where, _sum: { costMicroUsd: true, inputTokens: true, outputTokens: true }, _count: true }),
      this.prisma.aiUsage.groupBy({ by: ['schoolId'], where: { createdAt: { gte: month } }, _sum: { costMicroUsd: true } }),
      this.prisma.school.findMany({ select: { id: true, name: true, status: true, aiProfile: true, _count: { select: { topics: true, students: true } } }, orderBy: { name: 'asc' } }),
      this.prisma.aiUsage.findMany({ where, orderBy: { createdAt: 'desc' }, take: 40, include: { school: { select: { name: true } } } }),
      this.prisma.aiUsage.aggregate({ where: { createdAt: { gte: month } }, _sum: { costMicroUsd: true } }),
    ]);
    const usage = new Map(bySchool.map((r) => [r.schoolId, r]));
    const monthCost = new Map(monthBySchool.map((r) => [r.schoolId, r._sum.costMicroUsd ?? 0]));
    const kobo = (micro: number | null | undefined) => n(microUsdToKobo(micro ?? 0));
    const noSchool = usage.get(null);
    return {
      config: { model: this.ai.model, configured: this.ai.configured, ...aiPricing(), monthCostMicroUsd: monthTotal._sum.costMicroUsd ?? 0 },
      totals: {
        calls: totals._count,
        failed: failures,
        inputTokens: totals._sum.inputTokens ?? 0,
        outputTokens: totals._sum.outputTokens ?? 0,
        costMicroUsd: totals._sum.costMicroUsd ?? 0,
        costKobo: kobo(totals._sum.costMicroUsd),
        avgLatencyMs: Math.round(totals._avg.latencyMs ?? 0),
      },
      series: dayKeys(days).map((k) => {
        const r = daily.find((x) => x.day === k);
        return { day: k, calls: r?.calls ?? 0, failed: r?.failed ?? 0, tokens: n(r?.tokens), costKobo: kobo(n(r?.costMicroUsd)) };
      }),
      byFeature: byFeature.map((f) => ({ feature: f.feature, calls: f._count, tokens: (f._sum.inputTokens ?? 0) + (f._sum.outputTokens ?? 0), costKobo: kobo(f._sum.costMicroUsd) })),
      bySchool: schools
        .map((s) => {
          const u = usage.get(s.id);
          const spent = kobo(monthCost.get(s.id));
          return {
            id: s.id,
            name: s.name,
            status: s.status,
            students: s._count.students,
            curriculum: s.aiProfile?.curriculum ?? null,
            aiEnabled: s.aiProfile?.aiEnabled ?? true,
            topics: s._count.topics,
            calls: u?._count ?? 0,
            tokens: (u?._sum.inputTokens ?? 0) + (u?._sum.outputTokens ?? 0),
            costKobo: kobo(u?._sum.costMicroUsd),
            monthCostKobo: spent,
            monthlyBudgetKobo: s.aiProfile?.monthlyBudgetKobo === null || s.aiProfile?.monthlyBudgetKobo === undefined ? null : n(s.aiProfile.monthlyBudgetKobo),
            perStudentKobo: s._count.students ? Math.round(kobo(u?._sum.costMicroUsd) / s._count.students) : 0,
          };
        })
        .sort((a, b) => b.costKobo - a.costKobo),
      unattributed: noSchool ? { calls: noSchool._count, costKobo: kobo(noSchool._sum.costMicroUsd) } : { calls: 0, costKobo: 0 },
      recent: recent.map((r) => ({
        id: r.id,
        at: r.createdAt,
        feature: r.feature,
        model: r.model,
        school: r.school?.name ?? null,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costKobo: kobo(r.costMicroUsd),
        ok: r.ok,
        latencyMs: r.latencyMs,
        error: r.error,
      })),
    };
  }

  // ── Student learning ───────────────────────────────────

  async learning(days: number, schoolId?: string) {
    const since = addDays(new Date(), -days);
    const scope = schoolId ? Prisma.sql`AND sp."schoolId" = ${schoolId}` : Prisma.empty;
    const studentScope: Prisma.StudentProfileWhereInput = schoolId ? { schoolId } : {};
    const [totals, daily, bySubject, bySchool, topXp, struggling, hardest, streaks, students, lessonQuizzes] = await Promise.all([
      this.prisma.$queryRaw<{ attempts: number; learners: number; avgScore: number | null; xp: bigint }[]>`
        SELECT COUNT(*)::int AS attempts, COUNT(DISTINCT a."studentId")::int AS learners, AVG(a.score)::float AS "avgScore", COALESCE(SUM(a."xpEarned"), 0)::bigint AS xp
        FROM "ActivityAttempt" a JOIN "StudentProfile" sp ON sp.id = a."studentId"
        WHERE a."completedAt" >= ${since} ${scope}`,
      this.prisma.$queryRaw<{ day: string; attempts: number; learners: number; avgScore: number | null }[]>`
        SELECT ${day('a."completedAt"')} AS day, COUNT(*)::int AS attempts, COUNT(DISTINCT a."studentId")::int AS learners, AVG(a.score)::float AS "avgScore"
        FROM "ActivityAttempt" a JOIN "StudentProfile" sp ON sp.id = a."studentId"
        WHERE a."completedAt" >= ${since} ${scope} GROUP BY 1`,
      this.prisma.$queryRaw<{ subject: string; attempts: number; learners: number; avgScore: number | null }[]>`
        SELECT la.subject, COUNT(*)::int AS attempts, COUNT(DISTINCT a."studentId")::int AS learners, AVG(a.score)::float AS "avgScore"
        FROM "ActivityAttempt" a JOIN "StudentProfile" sp ON sp.id = a."studentId" JOIN "LearningActivity" la ON la.id = a."activityId"
        WHERE a."completedAt" >= ${since} ${scope} GROUP BY 1 ORDER BY 2 DESC`,
      this.prisma.$queryRaw<{ id: string | null; name: string | null; students: number; learners: number; attempts: number; avgScore: number | null }[]>`
        SELECT s.id, s.name, (SELECT COUNT(*)::int FROM "StudentProfile" x WHERE x."schoolId" = s.id) AS students,
          COUNT(DISTINCT a."studentId")::int AS learners, COUNT(a.id)::int AS attempts, AVG(a.score)::float AS "avgScore"
        FROM "School" s
        LEFT JOIN "StudentProfile" sp ON sp."schoolId" = s.id
        LEFT JOIN "ActivityAttempt" a ON a."studentId" = sp.id AND a."completedAt" >= ${since}
        WHERE s.status <> 'PENDING' ${schoolId ? Prisma.sql`AND s.id = ${schoolId}` : Prisma.empty}
        GROUP BY s.id, s.name ORDER BY attempts DESC`,
      this.prisma.xpEvent.groupBy({ by: ['studentId'], where: { createdAt: { gte: since }, student: studentScope }, _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } }, take: 10 }),
      this.prisma.$queryRaw<{ studentId: string; attempts: number; avgScore: number }[]>`
        SELECT a."studentId", COUNT(*)::int AS attempts, AVG(a.score)::float AS "avgScore"
        FROM "ActivityAttempt" a JOIN "StudentProfile" sp ON sp.id = a."studentId"
        WHERE a."completedAt" >= ${since} AND a.score IS NOT NULL ${scope}
        GROUP BY 1 HAVING COUNT(*) >= 3 AND AVG(a.score) < 0.5 ORDER BY 3 ASC LIMIT 15`,
      this.prisma.$queryRaw<{ id: string; title: string; subject: string; level: string; attempts: number; avgScore: number }[]>`
        SELECT la.id, la.title, la.subject, la.level::text AS level, COUNT(*)::int AS attempts, AVG(a.score)::float AS "avgScore"
        FROM "ActivityAttempt" a JOIN "StudentProfile" sp ON sp.id = a."studentId" JOIN "LearningActivity" la ON la.id = a."activityId"
        WHERE a."completedAt" >= ${since} AND a.score IS NOT NULL ${scope}
        GROUP BY 1, 2, 3, 4 HAVING COUNT(*) >= 3 ORDER BY 6 ASC LIMIT 10`,
      this.prisma.$queryRaw<{ bucket: string; students: number }[]>`
        SELECT CASE WHEN "currentStreak" = 0 THEN '0' WHEN "currentStreak" < 3 THEN '1–2' WHEN "currentStreak" < 7 THEN '3–6' WHEN "currentStreak" < 30 THEN '7–29' ELSE '30+' END AS bucket,
          COUNT(*)::int AS students
        FROM "StudentProfile" sp WHERE TRUE ${scope} GROUP BY 1`,
      this.prisma.studentProfile.count({ where: studentScope }),
      this.prisma.lessonQuiz.count({ where: { completedAt: { gte: since }, student: studentScope } }),
    ]);

    const ids = [...new Set([...topXp.map((t) => t.studentId), ...struggling.map((s) => s.studentId)])];
    const people = new Map(
      (await this.prisma.studentProfile.findMany({ where: { id: { in: ids } }, select: { id: true, gradeName: true, level: true, currentStreak: true, xpTotal: true, user: { select: { firstName: true, lastName: true } }, school: { select: { name: true } } } })).map((s) => [s.id, s]),
    );
    const who = (id: string) => {
      const s = people.get(id);
      return { id, name: s ? `${s.user.firstName} ${s.user.lastName}` : 'Student', school: s?.school?.name ?? null, grade: s?.gradeName ?? s?.level ?? null, streak: s?.currentStreak ?? 0, xpTotal: s?.xpTotal ?? 0 };
    };
    const score = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 100));
    const t = totals[0];
    return {
      totals: { students, activeLearners: t?.learners ?? 0, attempts: t?.attempts ?? 0, avgScore: score(t?.avgScore), xp: n(t?.xp), lessonQuizzes },
      series: fill(
        dayKeys(days),
        daily.map((d) => ({ ...d, avgScore: score(d.avgScore) })),
        { attempts: 0, learners: 0, avgScore: null },
      ),
      bySubject: bySubject.map((s) => ({ ...s, avgScore: score(s.avgScore) })),
      bySchool: bySchool.map((s) => ({ ...s, avgScore: score(s.avgScore), participation: s.students ? Math.round((s.learners / s.students) * 100) : 0 })),
      streaks: ['0', '1–2', '3–6', '7–29', '30+'].map((b) => ({ bucket: b, students: streaks.find((s) => s.bucket === b)?.students ?? 0 })),
      topStudents: topXp.map((x) => ({ ...who(x.studentId), xp: x._sum.amount ?? 0 })),
      struggling: struggling.map((s) => ({ ...who(s.studentId), attempts: s.attempts, avgScore: score(s.avgScore) })),
      hardest: hardest.map((h) => ({ ...h, avgScore: score(h.avgScore) })),
    };
  }
}
