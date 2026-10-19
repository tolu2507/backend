import { Injectable } from '@nestjs/common';
import type { ExamBody, Prisma } from '@prisma/client';

import { LEVEL_LABEL } from '../catalog/catalog.js';
import { lagosMidnightInstant, weekStart } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';

const student = { select: { id: true, level: true, gradeName: true, xpTotal: true, currentStreak: true, user: { select: { firstName: true, lastName: true } }, school: { select: { name: true } } } } as const;
type Row = Prisma.StudentProfileGetPayload<typeof student>;
const who = (s: Row) => ({ id: s.id, name: `${s.user.firstName} ${s.user.lastName}`, class: s.gradeName ?? LEVEL_LABEL[s.level], school: s.school?.name ?? 'Learning at home' });

/** Overwatch rankings: who is working hardest, who is scoring best in the Friday mocks, and how well practice is going. */
@Injectable()
export class RankingsService {
  constructor(private readonly prisma: PrismaService) {}

  async rankings(f: { exam?: ExamBody; period: 'week' | 'all' }) {
    const since = lagosMidnightInstant(weekStart());
    const studentWhere: Prisma.StudentProfileWhereInput = f.exam ? { exams: { some: { exam: f.exam } } } : {};

    // XP leaderboard: this week's XP from events, or the all-time total.
    let xp: { student: Row; xp: number }[];
    if (f.period === 'week') {
      const sums = await this.prisma.xpEvent.groupBy({ by: ['studentId'], where: { createdAt: { gte: since }, student: studentWhere }, _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } }, take: 50 });
      const rows = await this.prisma.studentProfile.findMany({ where: { id: { in: sums.map((s) => s.studentId) } }, ...student });
      const byId = new Map(rows.map((r) => [r.id, r]));
      xp = sums.flatMap((s) => (byId.has(s.studentId) ? [{ student: byId.get(s.studentId)!, xp: s._sum.amount ?? 0 }] : []));
    } else {
      const rows = await this.prisma.studentProfile.findMany({ where: { ...studentWhere, xpTotal: { gt: 0 } }, orderBy: { xpTotal: 'desc' }, take: 50, ...student });
      xp = rows.map((s) => ({ student: s, xp: s.xpTotal }));
    }

    const [streaks, mocks, activeThisWeek, practice] = await Promise.all([
      this.prisma.studentProfile.findMany({ where: { ...studentWhere, currentStreak: { gt: 0 } }, orderBy: { currentStreak: 'desc' }, take: 10, ...student }),
      this.prisma.mockExam.findMany({
        where: { status: 'RESULTS_OUT', ...(f.exam ? { exam: f.exam } : {}) },
        orderBy: { opensAt: 'desc' },
        take: 4,
        include: {
          sittings: { where: { score: { not: null } }, orderBy: { score: 'desc' }, take: 10, include: { student: student } },
          _count: { select: { sittings: true } },
        },
      }),
      this.prisma.xpEvent.groupBy({ by: ['studentId'], where: { createdAt: { gte: since }, student: studentWhere } }).then((r) => r.length),
      this.practice(studentWhere),
    ]);

    const mockStats = await Promise.all(mocks.map((mk) => this.prisma.mockSitting.aggregate({ where: { mockId: mk.id, score: { not: null } }, _avg: { score: true }, _count: true })));

    return {
      activeThisWeek,
      xp: xp.map((x, i) => ({ rank: i + 1, ...who(x.student), xp: x.xp, streak: x.student.currentStreak })),
      streaks: streaks.map((s, i) => ({ rank: i + 1, ...who(s), streak: s.currentStreak })),
      practice,
      mocks: mocks.map((mk, i) => ({
        id: mk.id,
        exam: mk.exam,
        title: mk.title,
        opensAt: mk.opensAt,
        sat: mk._count.sittings,
        scored: mockStats[i]._count,
        averageScore: mockStats[i]._avg.score === null ? null : Math.round(mockStats[i]._avg.score!),
        top: mk.sittings.map((st) => ({ rank: st.nationalRank, ...who(st.student), score: st.score!, percentile: st.percentile })),
      })),
    };
  }

  /** Students with the most practice questions answered (at least 20), and how many they got right last time. */
  private async practice(studentWhere: Prisma.StudentProfileWhereInput) {
    const rows = await this.prisma.questionSeen.groupBy({ by: ['studentId'], where: { student: studentWhere }, _count: true, orderBy: { _count: { studentId: 'desc' } }, take: 50 });
    const enough = rows.filter((r) => r._count >= 20).slice(0, 20);
    const [right, profiles] = await Promise.all([
      this.prisma.questionSeen.groupBy({ by: ['studentId'], where: { studentId: { in: enough.map((r) => r.studentId) }, lastCorrect: true }, _count: true }),
      this.prisma.studentProfile.findMany({ where: { id: { in: enough.map((r) => r.studentId) } }, ...student }),
    ]);
    const correct = new Map(right.map((r) => [r.studentId, r._count]));
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return enough
      .filter((r) => byId.has(r.studentId))
      .map((r) => ({ ...who(byId.get(r.studentId)!), answered: r._count, accuracy: Math.round(((correct.get(r.studentId) ?? 0) / r._count) * 100) }))
      .sort((a, b) => b.accuracy - a.accuracy || b.answered - a.answered)
      .map((r, i) => ({ rank: i + 1, ...r }));
  }
}
