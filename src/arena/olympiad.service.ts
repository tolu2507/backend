import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';

import { lagosDay, lagosMidnightInstant } from '../common/dates.js';
import { formatNaira } from '../common/money.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PlanService } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { olympiadPrizesKobo, type Settings } from '../settings/settings.js';
import { SettingsService } from '../settings/settings.service.js';
import { ArenaService, publicName, SECONDS } from './arena.service.js';

export const OLYMPIAD_QUESTIONS = 10;
/** Time after closing for children still mid-run to finish before places are worked out. */
const FINISH_GRACE_MS = 3 * 60_000;
const BOARD_SIZE = 20;

const shuffle = <T>(xs: T[]) => [...xs].sort(() => Math.random() - 0.5);

/**
 * The Daily Olympiad: every evening, one short window per subject. Everyone who plays a subject that day gets the
 * same 10 questions, scored on the server for speed. Free for every child. Top 3 can win cash for their parent,
 * only when Overwatch turns prizes on and enough children took part.
 */
@Injectable()
export class OlympiadService {
  private readonly logger = new Logger(OlympiadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly arena: ArenaService,
    private readonly settings: SettingsService,
    private readonly ledger: LedgerService,
    private readonly plan: PlanService,
    private readonly messaging: MessagingService,
  ) {}

  /** Today's window (Lagos time). */
  window(s: Settings, now = new Date()) {
    const day = lagosDay(now);
    const opensAt = new Date(lagosMidnightInstant(day).getTime() + s.olympiadHour * 3_600_000);
    const closesAt = new Date(opensAt.getTime() + s.olympiadMinutes * 60_000);
    const status = now < opensAt ? 'upcoming' : now < closesAt ? 'open' : 'closed';
    return { day, opensAt, closesAt, status } as const;
  }

  /** Today's window and whether prizes are on, for the arena's front page. */
  async tonight() {
    const s = await this.settings.get();
    const w = this.window(s);
    return { status: w.status, opensAt: w.opensAt, closesAt: w.closesAt, prizes: !!this.prizes(s) };
  }

  private prizes(s: Settings) {
    return s.olympiadPrizesOn ? { naira: [s.olympiadPrize1Naira, s.olympiadPrize2Naira, s.olympiadPrize3Naira], minPlayers: s.olympiadMinPlayers } : null;
  }

  /** Today's Olympiad for one subject, as the student sees it: when, whether they've played, and the board. */
  async today(userId: string, examSubjectId: string) {
    const me = await this.arena.student(userId);
    const subject = await this.arena.subject(me.id, examSubjectId);
    const s = await this.settings.get();
    const w = this.window(s);
    const olympiad = await this.prisma.olympiad.findUnique({ where: { examSubjectId_day: { examSubjectId, day: w.day } } });
    const board = olympiad ? await this.board(olympiad.id, me.id) : { top: [], players: 0, me: null };
    return {
      subject: { id: subject.id, name: subject.name },
      status: w.status,
      opensAt: w.opensAt,
      closesAt: w.closesAt,
      questions: OLYMPIAD_QUESTIONS,
      seconds: SECONDS,
      prizes: this.prizes(s),
      settled: !!olympiad?.settledAt,
      ...board,
    };
  }

  /** The leaderboard: best score first, then whoever finished first. Only finished runs count. */
  async board(olympiadId: string, studentId: string) {
    const runs = await this.prisma.arenaPlayer.findMany({
      where: { finishedAt: { not: null }, match: { olympiadId } },
      orderBy: [{ score: 'desc' }, { finishedAt: 'asc' }],
      include: { student: { select: { user: { select: { firstName: true, lastName: true } } } } },
    });
    const mine = runs.findIndex((r) => r.studentId === studentId);
    const entry = await this.prisma.arenaPlayer.findFirst({ where: { studentId, match: { olympiadId } }, select: { matchId: true, finishedAt: true, score: true, correct: true } });
    return {
      players: runs.length,
      top: runs.slice(0, BOARD_SIZE).map((r, i) => ({ rank: i + 1, name: publicName(r.student.user), initial: r.student.user.firstName.slice(0, 1).toUpperCase(), score: r.score, you: r.studentId === studentId })),
      me: entry ? { matchId: entry.matchId, finished: !!entry.finishedAt, score: entry.score, correct: entry.correct, rank: mine >= 0 ? mine + 1 : null } : null,
    };
  }

  /** Today's questions for a subject, picked the first time anyone enters. Seen questions are allowed: it must be the same for everyone. */
  private async olympiadFor(examSubjectId: string, w: { day: Date; opensAt: Date; closesAt: Date }) {
    const existing = await this.prisma.olympiad.findUnique({ where: { examSubjectId_day: { examSubjectId, day: w.day } } });
    if (existing) return existing;
    const picked: string[] = [];
    for (const difficulty of [3, 2, 4, 1, 5]) {
      if (picked.length >= OLYMPIAD_QUESTIONS) break;
      const rows = await this.prisma.examQuestion.findMany({ where: { examSubjectId, difficulty, status: 'APPROVED', id: { notIn: picked } }, orderBy: { timesServed: 'asc' }, take: OLYMPIAD_QUESTIONS * 2, select: { id: true } });
      picked.push(...shuffle(rows).slice(0, OLYMPIAD_QUESTIONS - picked.length).map((r) => r.id));
    }
    if (picked.length < OLYMPIAD_QUESTIONS) throw new BadRequestException('This subject doesn’t have enough questions for an Olympiad yet. Try another subject.');
    try {
      return await this.prisma.olympiad.create({ data: { examSubjectId, day: w.day, opensAt: w.opensAt, closesAt: w.closesAt, questionIds: shuffle(picked) } });
    } catch (e) {
      // Two children entered at the same moment: use the one that won.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return this.prisma.olympiad.findUniqueOrThrow({ where: { examSubjectId_day: { examSubjectId, day: w.day } } });
      throw e;
    }
  }

  /** Enters today's Olympiad (once per child per subject), or picks up an unfinished entry. Works like a Ghost Race after this. */
  async enter(userId: string, examSubjectId: string) {
    const me = await this.arena.student(userId);
    await this.arena.subject(me.id, examSubjectId);
    const w = this.window(await this.settings.get());
    if (w.status === 'upcoming') throw new BadRequestException('Today’s Olympiad hasn’t opened yet.');
    if (w.status === 'closed') throw new BadRequestException('Today’s Olympiad has closed. Come back tomorrow evening!');
    const olympiad = await this.olympiadFor(examSubjectId, w);

    const entry = await this.prisma.arenaPlayer.findFirst({ where: { studentId: me.id, match: { olympiadId: olympiad.id } } });
    if (entry?.finishedAt) throw new BadRequestException('You’ve already played today’s Olympiad. Check the leaderboard!');
    const matchId =
      entry?.matchId ??
      (await this.prisma.arenaMatch.create({ data: { kind: 'OLYMPIAD', examSubjectId, olympiadId: olympiad.id, questionIds: olympiad.questionIds, players: { create: { studentId: me.id } } } })).id;
    return { matchId, questions: OLYMPIAD_QUESTIONS, seconds: SECONDS, me: { name: me.name, initial: me.initial, trophies: me.trophies }, ghost: null, olympiad: { id: olympiad.id, closesAt: olympiad.closesAt } };
  }

  /** The last answer of an entry: XP now; places come when the window closes. */
  async finish(playerId: string) {
    const player = await this.prisma.arenaPlayer.findUniqueOrThrow({ where: { id: playerId }, include: { match: true } });
    const xp = player.correct * 5;
    const [rewards] = await this.prisma.$transaction((tx) => this.arena.settle(tx, player.matchId, 'OLYMPIAD', [{ playerId, studentId: player.studentId, place: null, xp, trophies: null }]));
    const board = await this.board(player.match.olympiadId!, player.studentId);
    return { place: board.me?.rank ?? null, score: player.score, ghostScore: null, correct: player.correct, questions: player.match.questionIds.length, xp, trophies: 0, trophiesTotal: null, rewards, players: board.players };
  }

  /** After each window: final places, and prizes when they're on and enough children finished. */
  @Cron('*/5 * * * *')
  async settleDue(now = new Date()) {
    const due = await this.prisma.olympiad.findMany({ where: { settledAt: null, closesAt: { lte: new Date(now.getTime() - FINISH_GRACE_MS) } }, include: { examSubject: { select: { name: true } } } });
    if (!due.length) return;
    const s = await this.settings.get();
    for (const o of due) {
      try {
        await this.settle(o, s);
      } catch (e) {
        this.logger.error(`Olympiad ${o.id}: ${String(e)}`);
      }
    }
  }

  private async settle(o: { id: string; day: Date; examSubject: { name: string } }, s: Settings) {
    const runs = await this.prisma.arenaPlayer.findMany({
      where: { finishedAt: { not: null }, match: { olympiadId: o.id } },
      orderBy: [{ score: 'desc' }, { finishedAt: 'asc' }],
      include: { student: { include: { user: { select: { firstName: true } } } } },
    });
    const prizes = s.olympiadPrizesOn && runs.length >= s.olympiadMinPlayers ? olympiadPrizesKobo(s) : [];
    const paid: { parentId: string; name: string; place: number; kobo: bigint }[] = [];

    await this.prisma.$transaction(
      async (tx) => {
        for (const [i, r] of runs.entries()) await tx.arenaPlayer.update({ where: { id: r.id }, data: { place: i + 1 } });
        for (const [i, kobo] of prizes.entries()) {
          const r = runs[i];
          if (!r || kobo <= 0n || r.score <= 0) continue;
          const parentId = await this.prizeParent(r.studentId);
          if (!parentId) continue;
          const wallet = await this.ledger.userWallet(tx, parentId, 'REWARDS');
          await this.ledger.post(tx, {
            walletId: wallet.id,
            amountKobo: kobo,
            type: 'REWARD_EARNED',
            stream: 'OTHER',
            description: `${r.student.user.firstName} came ${ordinal(i + 1)} in the ${o.examSubject.name} Olympiad`,
            actorId: parentId,
            idempotencyKey: `olympiad:${o.id}:${i + 1}`,
          });
          paid.push({ parentId, name: r.student.user.firstName, place: i + 1, kobo });
        }
        await tx.olympiad.update({ where: { id: o.id }, data: { settledAt: new Date() } });
      },
      { timeout: 60_000 },
    );

    for (const p of paid)
      this.messaging.notify([p.parentId], 'payments', {
        title: `${p.name} came ${ordinal(p.place)} in the ${o.examSubject.name} Olympiad!`,
        body: `They won you ${formatNaira(p.kobo)} in airtime or data. Collect it in the app.`,
        url: '/parent/rewards',
      });
  }

  /** Whose rewards balance a prize goes to: the parent who earns rewards, else the first confirmed parent. */
  private async prizeParent(studentId: string) {
    const earning = await this.plan.rewardsParent(studentId);
    if (earning) return earning;
    const first = await this.prisma.guardianship.findFirst({ where: { studentId, confirmedAt: { not: null } }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }], select: { parentId: true } });
    return first?.parentId ?? null;
  }
}

const ordinal = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);
