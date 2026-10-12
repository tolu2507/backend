import { Injectable } from '@nestjs/common';
import type { LeagueTier, Prisma, XpReason } from '@prisma/client';

import { addDays, lagosDay, weekStart } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { levelFor } from './levels.js';

type Tx = Prisma.TransactionClient;

/** What changed for the student, so the app can celebrate it. */
export type Rewards = {
  level: { before: number; after: number; title: string };
  streak: { days: number; extended: boolean };
  newBadges: { code: string; name: string; description: string }[];
};

const TIERS: LeagueTier[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];
const GROUP_SIZE = 30;
export const PROMOTE_TOP = 5;

/** XP, streaks, weekly leagues and badges. All writes happen inside the caller's transaction. */
@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async awardXp(tx: Tx, studentId: string, amount: number, reason: XpReason, refId?: string): Promise<Rewards> {
    const student = await tx.studentProfile.findUniqueOrThrow({ where: { id: studentId } });
    const before = levelFor(student.xpTotal);
    if (amount <= 0) {
      return { level: { before: before.level, after: before.level, title: before.title }, streak: { days: student.currentStreak, extended: false }, newBadges: [] };
    }
    const today = lagosDay();
    const last = student.lastActiveDate;
    const dayGap = last ? Math.round((today.getTime() - last.getTime()) / 86_400_000) : null;
    const streak = dayGap === 0 ? student.currentStreak : dayGap === 1 ? student.currentStreak + 1 : 1;

    await tx.xpEvent.create({ data: { studentId, amount, reason, refId } });
    const updated = await tx.studentProfile.update({
      where: { id: studentId },
      data: { xpTotal: { increment: amount }, currentStreak: streak, longestStreak: Math.max(student.longestStreak, streak), lastActiveDate: today },
    });

    const entry = await this.leagueEntry(tx, studentId, updated.level);
    await tx.leagueEntry.update({ where: { id: entry.id }, data: { weeklyXp: { increment: amount } } });
    const newBadges = await this.checkBadges(tx, studentId, updated.xpTotal, streak);
    const after = levelFor(updated.xpTotal);
    return {
      level: { before: before.level, after: after.level, title: after.title },
      streak: { days: streak, extended: dayGap !== 0 },
      newBadges,
    };
  }

  /** Finds (or creates) this week's league entry, placing the student by last week's result. */
  private async leagueEntry(tx: Tx, studentId: string, level: Prisma.StudentProfileGetPayload<object>['level']) {
    const week = weekStart();
    const existing = await tx.leagueEntry.findFirst({ where: { studentId, group: { weekStart: week } } });
    if (existing) return existing;

    const previous = await tx.leagueEntry.findFirst({
      where: { studentId, group: { weekStart: addDays(week, -7) } },
      include: { group: { include: { _count: { select: { entries: true } } } } },
    });
    let tier: LeagueTier = 'BRONZE';
    if (previous) {
      const rank = previous.finalRank ?? (await this.rankOf(tx, previous.groupId, previous.studentId));
      const idx = TIERS.indexOf(previous.group.tier);
      const size = previous.group._count.entries;
      tier = rank <= PROMOTE_TOP ? TIERS[Math.min(idx + 1, TIERS.length - 1)] : size >= 10 && rank > size - PROMOTE_TOP ? TIERS[Math.max(idx - 1, 0)] : previous.group.tier;
    }
    const open = await tx.leagueGroup.findFirst({
      where: { weekStart: week, tier, level, entries: { none: { studentId } } },
      include: { _count: { select: { entries: true } } },
      orderBy: { id: 'asc' },
    });
    const group = open && open._count.entries < GROUP_SIZE ? open : await tx.leagueGroup.create({ data: { weekStart: week, tier, level } });
    return tx.leagueEntry.create({ data: { groupId: group.id, studentId } });
  }

  private async rankOf(tx: Tx, groupId: string, studentId: string) {
    const entries = await tx.leagueEntry.findMany({ where: { groupId }, orderBy: [{ weeklyXp: 'desc' }, { id: 'asc' }] });
    return entries.findIndex((e) => e.studentId === studentId) + 1;
  }

  private async checkBadges(tx: Tx, studentId: string, xp: number, streak: number) {
    const earned: string[] = [];
    if (xp > 0) earned.push('FIRST_QUEST');
    if (streak >= 3) earned.push('STREAK_3');
    if (streak >= 7) earned.push('STREAK_7');
    if (streak >= 30) earned.push('STREAK_30');
    if (xp >= 500) earned.push('XP_500');
    if (xp >= 2000) earned.push('XP_2000');
    return this.grant(tx, studentId, earned);
  }

  /** Awards badges the student doesn't have yet and returns only the new ones. */
  async grant(tx: Tx, studentId: string, codes: string[]): Promise<Rewards['newBadges']> {
    if (!codes.length) return [];
    const badges = await tx.badge.findMany({ where: { code: { in: codes }, awards: { none: { studentId } } } });
    for (const b of badges) {
      await tx.studentBadge.create({ data: { studentId, badgeId: b.id } });
    }
    return badges.map((b) => ({ code: b.code, name: b.name, description: b.description }));
  }

  /** Current week's table for the student's league group. */
  async league(studentId: string) {
    const week = weekStart();
    const mine = await this.prisma.leagueEntry.findFirst({ where: { studentId, group: { weekStart: week } }, include: { group: true } });
    const daysLeft = Math.max(1, Math.ceil((addDays(week, 7).getTime() - lagosDay().getTime()) / 86_400_000));
    if (!mine) return { league: null, standings: [] };
    const entries = await this.prisma.leagueEntry.findMany({
      where: { groupId: mine.groupId },
      orderBy: [{ weeklyXp: 'desc' }, { id: 'asc' }],
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    const rank = entries.findIndex((e) => e.id === mine.id) + 1;
    return {
      league: { tier: mine.group.tier, rank, size: entries.length, promoteTop: PROMOTE_TOP, daysLeft },
      standings: entries.map((e) => ({
        studentId: e.studentId,
        name: e.studentId === studentId ? 'You' : `${e.student.user.firstName} ${e.student.user.lastName[0] ?? ''}.`,
        weeklyXp: e.weeklyXp,
        isMe: e.studentId === studentId,
      })),
    };
  }
}
