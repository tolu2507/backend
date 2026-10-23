import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { ArenaKind, Prisma } from '@prisma/client';

import { lagosDay, lagosMidnightInstant } from '../common/dates.js';
import { GamificationService } from '../gamification/gamification.service.js';
import { PlanService } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';

type Tx = Prisma.TransactionClient;
type Option = { id: string; label: string };

export const QUESTIONS = 5;
export const SECONDS = 10;
/** Extra time allowed for the answer to travel back before it counts as "time up". */
const GRACE_MS = 1500;
const POINTS = { base: 100, speed: 200, combo: 50 };
const XP = { correct: 5, win: 20 };
/** Ghost Race trophies. Rooms give none, so friends can't pass trophies back and forth. */
const TROPHIES = { win: 10, loss: -5, firstRun: 5 };
const REVIEW_AFTER_DAYS = 2;

/** Quick chat: the only things players can say to each other. */
export const PHRASES = {
  gl: 'Good luck!',
  gg: 'Good game!',
  wow: 'Wow!',
  close: 'That was close!',
  hard: 'That one was hard!',
  again: 'Rematch?',
} as const;
export type Phrase = keyof typeof PHRASES;

export class ArenaLimitException extends HttpException {
  constructor(perDay: number) {
    super(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, code: 'ARENA_LIMIT', message: `That’s your ${perDay} arena ${perDay === 1 ? 'match' : 'matches'} for today. Come back tomorrow for more.` },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

const shuffle = <T>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** "Tobi E." — what other players see. Never the full name. */
export const publicName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName.slice(0, 1).toUpperCase()}.`.trim();

/** Points for one answer: 100 for right, up to 200 more for speed, and 50 more when the one before was right too. */
export function points(correct: boolean, ms: number | null, previousCorrect: boolean) {
  if (!correct || ms === null) return 0;
  const speed = Math.round(POINTS.speed * Math.max(0, 1 - ms / (SECONDS * 1000)));
  return POINTS.base + speed + (previousCorrect ? POINTS.combo : 0);
}

/** Places by score, highest first; equal scores share a place. */
export function places(scores: { id: string; score: number }[]) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const out = new Map<string, number>();
  sorted.forEach((p, i) => out.set(p.id, i > 0 && p.score === sorted[i - 1].score ? out.get(sorted[i - 1].id)! : i + 1));
  return out;
}

export type ArenaStudent = { id: string; name: string; initial: string; trophies: number; chatAllowed: boolean };

/**
 * The arena: short matches on one subject, everyone on the same questions, scored on the server by how fast and right they are.
 * Ghost Races run over HTTP (one player against a real recorded run); rooms are live (see RoomsService).
 */
@Injectable()
export class ArenaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly game: GamificationService,
    private readonly plan: PlanService,
    private readonly settings: SettingsService,
  ) {}

  /** The student behind a login, checked for the arena (a parent may have switched it off). */
  async student(userId: string): Promise<ArenaStudent> {
    const p = await this.prisma.studentProfile.findUnique({ where: { userId }, include: { user: { select: { firstName: true, lastName: true } } } });
    if (!p) throw new ForbiddenException('This account is not a student account.');
    if (!p.arenaAllowed) throw new ForbiddenException('Your parent has switched the arena off.');
    return { id: p.id, name: publicName(p.user), initial: p.user.firstName.slice(0, 1).toUpperCase(), trophies: p.trophies, chatAllowed: p.chatAllowed };
  }

  /** The subject must be one the student picked, and not Nursery (too young for speed rounds). */
  async subject(studentId: string, examSubjectId: string) {
    const link = await this.prisma.studentExamSubject.findFirst({ where: { examSubjectId, studentExam: { studentId } }, include: { examSubject: true } });
    if (!link) throw new NotFoundException('Add this subject to your exam first.');
    if (link.examSubject.exam === 'NURSERY') throw new BadRequestException('The arena opens from Primary 1.');
    return link.examSubject;
  }

  /** Free-plan children get a few matches a day; null means no limit. */
  async matchesLeft(studentId: string): Promise<{ limit: number | null; left: number | null }> {
    if (await this.plan.studentHasAccess(studentId)) return { limit: null, left: null };
    const [{ freeDailyMatches: limit }, today] = await Promise.all([
      this.settings.get(),
      // The Daily Olympiad is free for everyone, so it doesn't count.
      this.prisma.arenaPlayer.count({ where: { studentId, joinedAt: { gte: lagosMidnightInstant(lagosDay()) }, match: { kind: { not: 'OLYMPIAD' } } } }),
    ]);
    return { limit, left: Math.max(0, limit - today) };
  }

  async assertMatchLeft(studentId: string) {
    const { limit, left } = await this.matchesLeft(studentId);
    if (left === 0) throw new ArenaLimitException(limit ?? 0);
  }

  /** The arena lobby for one subject. */
  /** `openRoom` finds a friends' room the student still has a place in (rooms live in RoomsService). */
  async lobby<R>(userId: string, examSubjectId: string, openRoom: (studentId: string) => R) {
    const me = await this.student(userId);
    const subject = await this.subject(me.id, examSubjectId);
    const [left, played, won] = await Promise.all([
      this.matchesLeft(me.id),
      this.prisma.arenaPlayer.count({ where: { studentId: me.id, finishedAt: { not: null }, match: { examSubjectId } } }),
      this.prisma.arenaPlayer.count({ where: { studentId: me.id, place: 1, finishedAt: { not: null }, match: { examSubjectId } } }),
    ]);
    return { subject: { id: subject.id, exam: subject.exam, slug: subject.slug, name: subject.name }, me: { name: me.name, initial: me.initial, trophies: me.trophies, chatAllowed: me.chatAllowed }, played, won, matches: left, questions: QUESTIONS, seconds: SECONDS, phrases: PHRASES, openRoom: openRoom(me.id) };
  }

  /** Approved questions in the subject that none of the players has had, easy-to-middle first. */
  async pickQuestions(studentIds: string[], examSubjectId: string): Promise<string[]> {
    const picked: string[] = [];
    for (const difficulty of [2, 1, 3, 4, 5]) {
      if (picked.length >= QUESTIONS) break;
      const rows = await this.prisma.examQuestion.findMany({
        where: { examSubjectId, difficulty, status: 'APPROVED', seen: { none: { studentId: { in: studentIds } } }, id: { notIn: picked } },
        orderBy: { timesServed: 'asc' },
        take: (QUESTIONS - picked.length) * 3,
        select: { id: true },
      });
      picked.push(...shuffle(rows).slice(0, QUESTIONS - picked.length).map((r) => r.id));
    }
    if (picked.length < QUESTIONS) throw new BadRequestException('There aren’t enough new questions in this subject for a match yet. Try another subject.');
    return shuffle(picked);
  }

  /**
   * Trophy leaderboard for everyone preparing for the same exam as this subject (all JAMB students, all Primary 3s…):
   * the top 50 and the student's own place.
   */
  async leaderboard(userId: string, examSubjectId: string) {
    const me = await this.student(userId);
    const subject = await this.subject(me.id, examSubjectId);
    const where = { trophies: { gt: 0 }, arenaAllowed: true, exams: { some: { exam: subject.exam } } } satisfies Prisma.StudentProfileWhereInput;
    const [top, above] = await Promise.all([
      this.prisma.studentProfile.findMany({ where, orderBy: [{ trophies: 'desc' }, { updatedAt: 'asc' }], take: 50, select: { id: true, trophies: true, user: { select: { firstName: true, lastName: true } } } }),
      this.prisma.studentProfile.count({ where: { ...where, trophies: { gt: me.trophies } } }),
    ]);
    return {
      exam: subject.exam,
      top: top.map((p, i) => ({ rank: i + 1, name: publicName(p.user), initial: p.user.firstName.slice(0, 1).toUpperCase(), trophies: p.trophies, you: p.id === me.id })),
      me: { name: me.name, trophies: me.trophies, rank: me.trophies > 0 ? above + 1 : null },
    };
  }

  // ── Ghost Race ────────────────────────────────────────

  /**
   * Starts a Ghost Race: the same questions as a real player's finished run, none of which this student has had.
   * When nobody has a run they can race yet, they set the first one for others to chase.
   */
  async startGhost(userId: string, examSubjectId: string) {
    const me = await this.student(userId);
    await this.subject(me.id, examSubjectId);
    await this.assertMatchLeft(me.id);

    const runs = await this.prisma.arenaPlayer.findMany({
      where: { finishedAt: { not: null }, studentId: { not: me.id }, match: { examSubjectId, status: 'FINISHED' } },
      orderBy: { finishedAt: 'desc' },
      take: 40,
      include: { match: { select: { questionIds: true } }, student: { select: { trophies: true, user: { select: { firstName: true, lastName: true } } } } },
    });
    const seen = new Set(
      (await this.prisma.questionSeen.findMany({ where: { studentId: me.id, questionId: { in: [...new Set(runs.flatMap((r) => r.match.questionIds))] } }, select: { questionId: true } })).map((s) => s.questionId),
    );
    const fresh = runs.filter((r) => r.match.questionIds.length === QUESTIONS && r.match.questionIds.every((q) => !seen.has(q)));
    // The closest in trophies makes the fairest race.
    const ghost = fresh.sort((a, b) => Math.abs(a.student.trophies - me.trophies) - Math.abs(b.student.trophies - me.trophies))[0] ?? null;
    const questionIds = ghost ? ghost.match.questionIds : await this.pickQuestions([me.id], examSubjectId);

    const match = await this.prisma.arenaMatch.create({
      data: { kind: 'GHOST', examSubjectId, questionIds, ghostOfId: ghost?.id, players: { create: { studentId: me.id } } },
    });
    const timeline = ghost ? await this.prisma.arenaAnswer.findMany({ where: { playerId: ghost.id }, orderBy: { index: 'asc' }, select: { ms: true, correct: true, points: true } }) : [];
    return {
      matchId: match.id,
      questions: QUESTIONS,
      seconds: SECONDS,
      me: { name: me.name, initial: me.initial, trophies: me.trophies },
      ghost: ghost
        ? { name: publicName(ghost.student.user), initial: ghost.student.user.firstName.slice(0, 1).toUpperCase(), trophies: ghost.student.trophies, score: ghost.score, raced: ghost.finishedAt, timeline }
        : null,
    };
  }

  /** The student's own entry in a one-player match: a Ghost Race or an Olympiad. */
  private async soloPlayer(userId: string, matchId: string) {
    const me = await this.student(userId);
    const player = await this.prisma.arenaPlayer.findUnique({ where: { matchId_studentId: { matchId, studentId: me.id } }, include: { match: true, answers: { orderBy: { index: 'asc' } } } });
    if (!player || (player.match.kind !== 'GHOST' && player.match.kind !== 'OLYMPIAD')) throw new NotFoundException('Match not found.');
    if (player.match.status !== 'PLAYING') throw new BadRequestException('This race is over.');
    return player;
  }

  /** Shows question `index`. The clock starts now, on the server. Asking again for the same one doesn't restart it. */
  async serve(userId: string, matchId: string, index: number) {
    const player = await this.soloPlayer(userId, matchId);
    const last = player.answers.at(-1);
    const resume = last && !last.answeredAt ? last : null;
    if (index !== (resume ? resume.index : player.answers.length)) throw new BadRequestException('Answer the questions in order.');
    if (index >= player.match.questionIds.length) throw new BadRequestException(`There are only ${player.match.questionIds.length} questions.`);
    const questionId = player.match.questionIds[index];
    const row = resume ?? (await this.prisma.arenaAnswer.create({ data: { playerId: player.id, index, questionId } }));
    const q = await this.prisma.examQuestion.findUniqueOrThrow({ where: { id: questionId } });
    return { index, prompt: q.stem, options: shuffle(q.options as Option[]), msLeft: Math.max(0, SECONDS * 1000 - (Date.now() - row.servedAt.getTime())) };
  }

  /** Answers in a Ghost Race or an Olympiad. The last answer ends it; `onFinish` handles an Olympiad's ending. */
  async answerSolo(userId: string, matchId: string, index: number, optionId: string | null, onOlympiadFinish: (playerId: string) => Promise<unknown>) {
    const player = await this.soloPlayer(userId, matchId);
    const result = await this.answer(player.id, index, optionId);
    const last = index === player.match.questionIds.length - 1;
    const finished = !last ? null : player.match.kind === 'GHOST' ? await this.finishGhost(player.id) : await onOlympiadFinish(player.id);
    return { ...result, finished };
  }

  /** Marks one answer, timed from when the question was shown. Shared by Ghost Races and rooms. */
  async answer(playerId: string, index: number, optionId: string | null, at = new Date()) {
    const row = await this.prisma.arenaAnswer.findUnique({ where: { playerId_index: { playerId, index } }, include: { question: true } });
    if (!row) throw new BadRequestException('That question hasn’t been shown yet.');
    if (row.answeredAt) throw new BadRequestException('You’ve already answered this one.');
    const elapsed = at.getTime() - row.servedAt.getTime();
    const ms = optionId && elapsed <= SECONDS * 1000 + GRACE_MS ? Math.min(elapsed, SECONDS * 1000) : null;
    const correct = ms !== null && optionId === row.question.answerId;
    const before = index > 0 ? await this.prisma.arenaAnswer.findUnique({ where: { playerId_index: { playerId, index: index - 1 } }, select: { correct: true } }) : null;
    const pts = points(correct, ms, !!before?.correct);
    const [, player] = await this.prisma.$transaction([
      this.prisma.arenaAnswer.update({ where: { playerId_index: { playerId, index } }, data: { answeredAt: at, optionId, correct, ms, points: pts } }),
      this.prisma.arenaPlayer.update({ where: { id: playerId }, data: { score: { increment: pts }, correct: { increment: correct ? 1 : 0 } } }),
    ]);
    return { index, correct, timedOut: ms === null, answerId: row.question.answerId, explanation: row.question.explanation, points: pts, combo: correct && !!before?.correct, score: player.score };
  }

  private async finishGhost(playerId: string) {
    const player = await this.prisma.arenaPlayer.findUniqueOrThrow({ where: { id: playerId }, include: { match: { include: { ghostOf: true } }, student: true } });
    const ghost = player.match.ghostOf;
    const won = !ghost || player.score >= ghost.score;
    const delta = !ghost ? TROPHIES.firstRun : won ? TROPHIES.win : Math.max(TROPHIES.loss, -player.student.trophies);
    const xp = player.correct * XP.correct + (ghost && won ? XP.win : 0);
    const rewards = await this.prisma.$transaction((tx) => this.settle(tx, player.match.id, 'GHOST', [{ playerId, studentId: player.studentId, place: won ? 1 : 2, xp, trophies: delta }]));
    return {
      place: won ? 1 : 2,
      score: player.score,
      ghostScore: ghost?.score ?? null,
      correct: player.correct,
      questions: QUESTIONS,
      xp,
      trophies: delta,
      trophiesTotal: player.student.trophies + delta,
      rewards: rewards[0],
    };
  }

  /**
   * Ends a match for everyone in it: places, XP (no coins), trophies, and every question shown counts as seen,
   * so practice never repeats it. A wrong or missed one comes back later as a practice review.
   */
  async settle(tx: Tx, matchId: string, kind: ArenaKind, results: { playerId: string; studentId: string; place: number | null; xp: number; trophies: number | null }[]) {
    const now = new Date();
    const reviewDue = new Date(now.getTime() + REVIEW_AFTER_DAYS * 86_400_000);
    const out = [];
    for (const r of results) {
      const answers = await tx.arenaAnswer.findMany({ where: { playerId: r.playerId } });
      for (const a of answers) {
        const data = { lastSeenAt: now, lastCorrect: a.correct, reviewDueAt: a.correct ? null : reviewDue };
        await tx.questionSeen.upsert({
          where: { studentId_questionId: { studentId: r.studentId, questionId: a.questionId } },
          create: { studentId: r.studentId, questionId: a.questionId, ...data },
          update: { ...data, timesSeen: { increment: 1 } },
        });
        await tx.examQuestion.update({ where: { id: a.questionId }, data: { timesServed: { increment: 1 }, timesCorrect: { increment: a.correct ? 1 : 0 } } });
      }
      await tx.arenaPlayer.update({ where: { id: r.playerId }, data: { place: r.place, xp: r.xp, trophies: r.trophies, finishedAt: now } });
      if (r.trophies) await tx.studentProfile.update({ where: { id: r.studentId }, data: { trophies: { increment: r.trophies } } });
      out.push(await this.game.awardXp(tx, r.studentId, r.xp, 'ARENA', matchId));
    }
    await tx.arenaMatch.update({ where: { id: matchId }, data: { status: 'FINISHED', finishedAt: now, code: kind === 'ROOM' ? null : undefined } });
    return out;
  }
}
