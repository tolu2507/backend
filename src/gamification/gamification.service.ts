import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { CoinReason, LeagueTier, Prisma, StickerRarity, XpReason } from '@prisma/client';

import { addDays, lagosDay, lagosMidnightInstant, weekStart } from '../common/dates.js';
import { formatNaira } from '../common/money.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { COINS_PER_REWARD, PRACTICE_COINS_PER_DAY, REWARD_KOBO } from '../plan/plan.js';
import { PlanService } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { levelFor } from './levels.js';
import { RARITY_COINS, STICKERS, stickerProgress, type StickerStats } from './stickers.js';

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaService;

export type NewSticker = { code: string; name: string; description: string; rarity: StickerRarity; icon: string | null; coins: number };

/** What changed for the student, so the app can celebrate it. */
export type Rewards = {
  level: { before: number; after: number; title: string };
  streak: { days: number; extended: boolean };
  newBadges: NewSticker[];
  /** null when the family isn't earning rewards (free plan, or no parent on BrainBox). */
  coins: { earned: number; balance: number; target: number; sentKobo: number } | null;
};

const TIERS: LeagueTier[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];
const GROUP_SIZE = 30;
export const PROMOTE_TOP = 5;

/** XP, streaks, weekly leagues, stickers and coins. All writes happen inside the caller's transaction. */
@Injectable()
export class GamificationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plan: PlanService,
    private readonly ledger: LedgerService,
    private readonly messaging: MessagingService,
  ) {}

  /** stickers.ts is the source of truth: names, rarity, coins and order are kept in step with it. */
  async onApplicationBootstrap() {
    for (const [i, st] of STICKERS.entries()) {
      const data = { name: st.name, description: st.description, rarity: st.rarity, coins: RARITY_COINS[st.rarity], icon: st.icon, sortOrder: i, criteria: st.rule };
      await this.prisma.badge.upsert({ where: { code: st.code }, update: data, create: { code: st.code, ...data } });
    }
  }

  async awardXp(tx: Tx, studentId: string, amount: number, reason: XpReason, refId?: string, coins?: { amount: number; reason: CoinReason }): Promise<Rewards> {
    const student = await tx.studentProfile.findUniqueOrThrow({ where: { id: studentId } });
    const before = levelFor(student.xpTotal);
    if (amount <= 0) {
      return { level: { before: before.level, after: before.level, title: before.title }, streak: { days: student.currentStreak, extended: false }, newBadges: [], coins: null };
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
    const earned = coins ? await this.awardCoins(tx, studentId, coins.amount, coins.reason, refId) : null;
    const { stickers, coins: stickerCoins } = await this.checkStickers(tx, studentId);
    const after = levelFor(updated.xpTotal);
    return {
      level: { before: before.level, after: after.level, title: after.title },
      streak: { days: streak, extended: dayGap !== 0 },
      newBadges: stickers,
      coins: mergeCoins(earned, stickerCoins),
    };
  }

  // ── Coins ─────────────────────────────────────────────

  /**
   * Coins only count while the family is on the free trial or the paid plan. Practice coins stop at
   * PRACTICE_COINS_PER_DAY. Every 10,000 coins becomes ₦1,000 in the parent's rewards wallet.
   */
  async awardCoins(tx: Tx, studentId: string, amount: number, reason: CoinReason, refId?: string): Promise<Rewards['coins']> {
    const parentId = await this.plan.rewardsParent(studentId);
    if (!parentId) return null;
    let give = amount;
    if (reason === 'PRACTICE') {
      const today = await tx.coinEvent.aggregate({ where: { studentId, reason: 'PRACTICE', createdAt: { gte: lagosMidnightInstant(lagosDay()) } }, _sum: { amount: true } });
      give = Math.max(0, Math.min(amount, PRACTICE_COINS_PER_DAY - (today._sum.amount ?? 0)));
    }
    let sentKobo = 0;
    if (give > 0) {
      await tx.coinEvent.create({ data: { studentId, amount: give, reason, refId } });
      let profile = await tx.studentProfile.update({ where: { id: studentId }, data: { coins: { increment: give }, coinsTotal: { increment: give } }, include: { user: { select: { firstName: true } } } });
      while (profile.coins >= COINS_PER_REWARD) {
        const converted = await tx.coinEvent.create({ data: { studentId, amount: -COINS_PER_REWARD, reason: 'CONVERTED' } });
        profile = await tx.studentProfile.update({ where: { id: studentId }, data: { coins: { decrement: COINS_PER_REWARD } }, include: { user: { select: { firstName: true } } } });
        const wallet = await this.ledger.userWallet(tx, parentId, 'REWARDS');
        await this.ledger.post(tx, {
          walletId: wallet.id,
          amountKobo: REWARD_KOBO,
          type: 'REWARD_EARNED',
          stream: 'OTHER',
          description: `${profile.user.firstName} earned ${formatNaira(REWARD_KOBO)} by practising`,
          actorId: parentId,
          idempotencyKey: `coins:${converted.id}`,
        });
        await tx.coinEvent.update({ where: { id: converted.id }, data: { refId: wallet.id } });
        sentKobo += Number(REWARD_KOBO);
        this.messaging.notify([parentId], 'payments', {
          title: `${profile.user.firstName} earned you ${formatNaira(REWARD_KOBO)}!`,
          body: 'Their coins from practising turned into airtime or data for you. Collect it in the app.',
          url: '/parent/rewards',
        });
      }
      return { earned: give, balance: profile.coins, target: COINS_PER_REWARD, sentKobo };
    }
    const p = await tx.studentProfile.findUniqueOrThrow({ where: { id: studentId }, select: { coins: true } });
    return { earned: 0, balance: p.coins, target: COINS_PER_REWARD, sentKobo };
  }

  // ── Stickers ──────────────────────────────────────────

  /** Everything stickers are judged on, from the child's own activity. */
  async stats(db: Db, studentId: string): Promise<StickerStats> {
    const [profile, days, practice, conquered, mastered, sittings, entries] = await Promise.all([
      db.studentProfile.findUniqueOrThrow({ where: { id: studentId }, select: { xpTotal: true, longestStreak: true, perfectRounds: true } }),
      db.$queryRaw<{ c: number }[]>`SELECT COUNT(DISTINCT ("createdAt" + interval '1 hour')::date)::int AS c FROM "XpEvent" WHERE "studentId" = ${studentId}`,
      db.topicProgress.aggregate({ where: { studentId }, _sum: { correct: true } }),
      db.topicProgress.count({ where: { studentId, bossBeaten: true } }),
      // A subject counts once every subtopic (leaf) in it is conquered, and it has at least 3.
      db.$queryRaw<{ c: number }[]>`
        SELECT COUNT(*)::int AS c FROM (
          SELECT t."examSubjectId"
          FROM "SyllabusTopic" t
          LEFT JOIN "TopicProgress" p ON p."topicId" = t.id AND p."studentId" = ${studentId} AND p."bossBeaten"
          WHERE NOT EXISTS (SELECT 1 FROM "SyllabusTopic" c WHERE c."parentId" = t.id)
            AND t."examSubjectId" IN (SELECT tt."examSubjectId" FROM "TopicProgress" pp JOIN "SyllabusTopic" tt ON tt.id = pp."topicId" WHERE pp."studentId" = ${studentId})
          GROUP BY t."examSubjectId"
          HAVING COUNT(*) >= 3 AND COUNT(p."topicId") = COUNT(*)
        ) s`,
      db.mockSitting.findMany({ where: { studentId, submittedAt: { not: null } }, select: { nationalRank: true, percentile: true, mock: { select: { status: true, _count: { select: { sittings: true } } } } } }),
      db.leagueEntry.findMany({ where: { studentId }, select: { finalRank: true, group: { select: { tier: true } } } }),
    ]);
    return {
      xp: profile.xpTotal,
      longestStreak: profile.longestStreak,
      daysActive: days[0]?.c ?? 0,
      right: practice._sum.correct ?? 0,
      conquered,
      subjectsMastered: mastered[0]?.c ?? 0,
      perfectRounds: profile.perfectRounds,
      mocksSat: sittings.length,
      mockResults: sittings
        .filter((s) => s.mock.status === 'RESULTS_OUT' && s.nationalRank != null && s.percentile != null)
        .map((s) => ({ rank: s.nationalRank!, percentile: s.percentile!, sat: s.mock._count.sittings })),
      leagueTier: Math.max(0, ...entries.map((e) => TIERS.indexOf(e.group.tier) + 1)),
      leagueTop5: entries.filter((e) => e.finalRank != null && e.finalRank <= PROMOTE_TOP).length,
      leagueWins: entries.filter((e) => e.finalRank === 1).length,
    };
  }

  /** Grants every sticker the child has now earned. Safe to call any time; the app celebrates the new ones. */
  async checkStickers(tx: Tx, studentId: string) {
    const stats = await this.stats(tx, studentId);
    const due = STICKERS.filter((st) => stickerProgress(st, stats).done).map((st) => st.code);
    return this.grantWithCoins(tx, studentId, due);
  }

  /** Awards stickers the student doesn't have yet and returns only the new ones. Used directly for lesson-quiz stickers. */
  async grant(tx: Tx, studentId: string, codes: string[]): Promise<NewSticker[]> {
    return (await this.grantWithCoins(tx, studentId, codes)).stickers;
  }

  private async grantWithCoins(tx: Tx, studentId: string, codes: string[]) {
    if (!codes.length) return { stickers: [], coins: null };
    const badges = await tx.badge.findMany({ where: { code: { in: codes }, awards: { none: { studentId } } }, orderBy: { sortOrder: 'asc' } });
    let coins: Rewards['coins'] = null;
    const stickers: NewSticker[] = [];
    for (const b of badges) {
      // skipDuplicates so a sticker can't be granted (and paid) twice by two requests at once.
      const created = await tx.studentBadge.createMany({ data: [{ studentId, badgeId: b.id }], skipDuplicates: true });
      if (!created.count) continue;
      stickers.push({ code: b.code, name: b.name, description: b.description, rarity: b.rarity, icon: b.icon, coins: b.coins });
      if (b.coins > 0) coins = mergeCoins(coins, await this.awardCoins(tx, studentId, b.coins, 'STICKER', b.id));
    }
    return { stickers, coins };
  }

  /** The sticker book: every sticker, what's collected, and how close the rest are. */
  async stickerBook(studentId: string) {
    const [badges, mine, stats] = await Promise.all([
      this.prisma.badge.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.studentBadge.findMany({ where: { studentId } }),
      this.stats(this.prisma, studentId),
    ]);
    const earned = new Map(mine.map((m) => [m.badgeId, m]));
    const byCode = new Map(STICKERS.map((st) => [st.code, st]));
    return badges.map((b) => {
      const award = earned.get(b.id);
      const st = byCode.get(b.code);
      const progress = st ? stickerProgress(st, stats) : { current: 0, target: null, done: false };
      return {
        id: b.id,
        code: b.code,
        name: b.name,
        description: b.description,
        rarity: b.rarity,
        icon: b.icon,
        coins: b.coins,
        earned: !!award,
        awardedAt: award?.awardedAt ?? null,
        seen: !!award?.seenAt,
        progress: award ? null : { current: progress.current, target: progress.target },
      };
    });
  }

  /**
   * What a collected sticker means: how many children have it, when this child got it compared with them,
   * and where their whole collection puts them among everyone collecting. Counts only, never other children's names.
   */
  async stickerStats(studentId: string, badgeId: string) {
    const mine = await this.prisma.studentBadge.findUnique({ where: { studentId_badgeId: { studentId, badgeId } } });
    if (!mine) return null;
    const [owners, before, myCount, collectors] = await Promise.all([
      this.prisma.studentBadge.count({ where: { badgeId } }),
      this.prisma.studentBadge.count({ where: { badgeId, OR: [{ awardedAt: { lt: mine.awardedAt } }, { awardedAt: mine.awardedAt, id: { lt: mine.id } }] } }),
      this.prisma.studentBadge.count({ where: { studentId } }),
      this.prisma.studentBadge.groupBy({ by: ['studentId'] }).then((g) => g.length),
    ]);
    const ahead = await this.prisma.$queryRaw<{ c: number }[]>`
      SELECT COUNT(*)::int AS c FROM (SELECT "studentId" FROM "StudentBadge" GROUP BY "studentId" HAVING COUNT(*) > ${myCount}) s`;
    return {
      owners,
      collectors,
      // Share of children collecting stickers who have this one (at least 1%, so it never reads "0%").
      percent: Math.max(1, Math.round((owners / Math.max(1, collectors)) * 100)),
      unlockedOrder: before + 1,
      myStickers: myCount,
      collectorRank: (ahead[0]?.c ?? 0) + 1,
    };
  }

  async markStickersSeen(studentId: string, badgeIds: string[]) {
    await this.prisma.studentBadge.updateMany({ where: { studentId, badgeId: { in: badgeIds }, seenAt: null }, data: { seenAt: new Date() } });
    return { ok: true };
  }

  // ── Leagues ───────────────────────────────────────────

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

  /** Monday 00:10 Lagos: last week's leagues are final. Record each place, then hand out league stickers. */
  @Cron('10 0 * * 1', { timeZone: 'Africa/Lagos' })
  async closeLeagueWeek(week = addDays(weekStart(), -7)) {
    const groups = await this.prisma.leagueGroup.findMany({ where: { weekStart: week }, include: { entries: { orderBy: [{ weeklyXp: 'desc' }, { id: 'asc' }] } } });
    let students = 0;
    for (const g of groups) {
      for (const [i, e] of g.entries.entries()) {
        if (e.finalRank == null) await this.prisma.leagueEntry.update({ where: { id: e.id }, data: { finalRank: i + 1 } });
        try {
          await this.prisma.$transaction((tx) => this.checkStickers(tx, e.studentId));
          students++;
        } catch (err) {
          this.logger.error(`League stickers for ${e.studentId} failed: ${(err as Error).message}`);
        }
      }
    }
    if (students) this.logger.log(`League week ${week.toISOString().slice(0, 10)} closed for ${students} students`);
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

/** Adds up two coin results from the same action (practice coins, then sticker coins). The later balance wins. */
function mergeCoins(a: Rewards['coins'], b: Rewards['coins']): Rewards['coins'] {
  if (!a) return b;
  if (!b) return a;
  return { earned: a.earned + b.earned, balance: b.balance, target: b.target, sentKobo: a.sentKobo + b.sentKobo };
}
