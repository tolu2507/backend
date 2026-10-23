import { Injectable } from '@nestjs/common';
import { Prisma, type ArenaKind, type ArenaStatus } from '@prisma/client';

import { LEVEL_LABEL } from '../catalog/catalog.js';
import { addDays, lagosDay } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { OlympiadService } from './olympiad.service.js';
import { RoomsService } from './rooms.service.js';

const KINDS: ArenaKind[] = ['GHOST', 'ROOM', 'LIVE', 'OLYMPIAD'];
const student = { select: { id: true, level: true, gradeName: true, trophies: true, user: { select: { firstName: true, lastName: true } }, school: { select: { name: true } } } } as const;
type Row = Prisma.StudentProfileGetPayload<typeof student>;
const who = (s: Row) => ({ id: s.id, name: `${s.user.firstName} ${s.user.lastName}`, class: s.gradeName ?? LEVEL_LABEL[s.level], school: s.school?.name ?? 'Learning at home' });

/** Lagos calendar day of a timestamp column, as 'YYYY-MM-DD'. Columns are stored as UTC without a zone. */
const day = (col: string) => Prisma.raw(`to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD')`);
const pct = (now: number, before: number) => (before === 0 ? (now === 0 ? 0 : null) : Math.round(((now - before) / before) * 1000) / 10);
const pageArgs = (page = 1, pageSize = 20) => ({ skip: (Math.max(1, page) - 1) * pageSize, take: Math.min(Math.max(1, pageSize), 100) });

/** Overwatch's view of the arena: what's live now, how much is played, the Daily Olympiads and their prizes, and the trophy leaders. */
@Injectable()
export class ArenaAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly olympiad: OlympiadService,
    private readonly rooms: RoomsService,
  ) {}

  async overview(days: number) {
    const since = addDays(new Date(), -days);
    const before = addDays(since, -days);
    const p = this.prisma;
    const finished = (from: Date, to?: Date) => p.arenaMatch.groupBy({ by: ['kind'], where: { status: 'FINISHED', finishedAt: { gte: from, ...(to ? { lt: to } : {}) } }, _count: true });
    const players = (from: Date, to: Date) => p.$queryRaw<{ c: number }[]>`SELECT COUNT(DISTINCT "studentId")::int AS c FROM "ArenaPlayer" WHERE "finishedAt" >= ${from} AND "finishedAt" < ${to}`;
    const prizes = (from: Date, to?: Date) => p.ledgerEntry.aggregate({ where: { idempotencyKey: { startsWith: 'olympiad:' }, createdAt: { gte: from, ...(to ? { lt: to } : {}) } }, _sum: { amountKobo: true }, _count: true });

    const [s, now, prev, playersNow, playersBefore, prizesNow, prizesBefore, cancelled, daily, bySubject, leaders, arenaOff, chatOff] = await Promise.all([
      this.settings.get(),
      finished(since),
      finished(before, since),
      players(since, new Date(Date.now() + 1000)),
      players(before, since),
      prizes(since),
      prizes(before, since),
      p.arenaMatch.count({ where: { status: 'CANCELLED', createdAt: { gte: since } } }),
      p.$queryRaw<{ day: string; kind: ArenaKind; matches: number }[]>`SELECT ${day('"finishedAt"')} AS day, kind, COUNT(*)::int AS matches FROM "ArenaMatch" WHERE status = 'FINISHED' AND "finishedAt" >= ${since} GROUP BY 1, 2`,
      p.$queryRaw<{ id: string; name: string; exam: string; matches: number; players: number }[]>`
        SELECT s.id, s.name, s.exam::text AS exam, COUNT(DISTINCT m.id)::int AS matches, COUNT(DISTINCT pl."studentId")::int AS players
        FROM "ArenaMatch" m JOIN "ExamSubject" s ON s.id = m."examSubjectId" JOIN "ArenaPlayer" pl ON pl."matchId" = m.id
        WHERE m.status = 'FINISHED' AND m."finishedAt" >= ${since}
        GROUP BY s.id ORDER BY matches DESC LIMIT 8`,
      p.studentProfile.findMany({ where: { trophies: { gt: 0 } }, orderBy: [{ trophies: 'desc' }, { xpTotal: 'desc' }], take: 10, ...student }),
      p.studentProfile.count({ where: { arenaAllowed: false } }),
      p.studentProfile.count({ where: { chatAllowed: false } }),
    ]);

    const byKind = (rows: { kind: ArenaKind; _count: number }[]) => Object.fromEntries(KINDS.map((k) => [k, rows.find((r) => r.kind === k)?._count ?? 0])) as Record<ArenaKind, number>;
    const kNow = byKind(now);
    const kPrev = byKind(prev);
    const total = (k: Record<ArenaKind, number>) => KINDS.reduce((n, x) => n + k[x], 0);

    const today = lagosDay();
    const keys = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1).toISOString().slice(0, 10));
    const series = keys.map((d) => ({ day: d, ...(Object.fromEntries(KINDS.map((k) => [k, daily.find((r) => r.day === d && r.kind === k)?.matches ?? 0])) as Record<ArenaKind, number>) }));

    const w = this.olympiad.window(s);
    const todays = await p.olympiad.findMany({ where: { day: w.day }, select: { id: true, examSubject: { select: { name: true } }, _count: { select: { entries: true } } } });

    return {
      live: this.rooms.live(),
      totals: {
        matches: { value: total(kNow), changePct: pct(total(kNow), total(kPrev)) },
        players: { value: playersNow[0]?.c ?? 0, changePct: pct(playersNow[0]?.c ?? 0, playersBefore[0]?.c ?? 0) },
        prizesKobo: { value: String(prizesNow._sum.amountKobo ?? 0n), count: prizesNow._count, previousKobo: String(prizesBefore._sum.amountKobo ?? 0n) },
        byKind: kNow,
        cancelled,
      },
      series,
      bySubject,
      leaders: leaders.map((l, i) => ({ rank: i + 1, ...who(l), trophies: l.trophies })),
      switchedOff: { arena: arenaOff, chat: chatOff },
      olympiad: {
        status: w.status,
        opensAt: w.opensAt,
        closesAt: w.closesAt,
        prizesOn: s.olympiadPrizesOn,
        prizesNaira: [s.olympiadPrize1Naira, s.olympiadPrize2Naira, s.olympiadPrize3Naira],
        minPlayers: s.olympiadMinPlayers,
        today: todays.map((o) => ({ id: o.id, subject: o.examSubject.name, entries: o._count.entries })).sort((a, b) => b.entries - a.entries),
      },
    };
  }

  /** Past and current Olympiads, newest first, with the top 3, how fast they answered and what they won. */
  async olympiads(page?: number, pageSize = 10) {
    const [total, rows] = await Promise.all([
      this.prisma.olympiad.count(),
      this.prisma.olympiad.findMany({ orderBy: [{ day: 'desc' }, { createdAt: 'desc' }], ...pageArgs(page, pageSize), include: { examSubject: { select: { name: true, exam: true } }, _count: { select: { entries: true } } } }),
    ]);
    const out = await Promise.all(
      rows.map(async (o) => {
        const [finished, top, paid] = await Promise.all([
          this.prisma.arenaPlayer.count({ where: { finishedAt: { not: null }, match: { olympiadId: o.id } } }),
          this.prisma.arenaPlayer.findMany({ where: { finishedAt: { not: null }, match: { olympiadId: o.id } }, orderBy: [{ score: 'desc' }, { finishedAt: 'asc' }], take: 3, include: { student: student } }),
          this.prisma.ledgerEntry.findMany({ where: { idempotencyKey: { startsWith: `olympiad:${o.id}:` } }, select: { idempotencyKey: true, amountKobo: true } }),
        ]);
        const speed = await this.speeds(top.map((t) => t.id));
        return {
          id: o.id,
          day: o.day.toISOString().slice(0, 10),
          subject: o.examSubject.name,
          exam: o.examSubject.exam,
          opensAt: o.opensAt,
          closesAt: o.closesAt,
          settledAt: o.settledAt,
          entered: o._count.entries,
          finished,
          top: top.map((t, i) => ({
            place: i + 1,
            ...who(t.student),
            score: t.score,
            correct: t.correct,
            questions: o.questionIds.length,
            avgMs: speed.get(t.id) ?? null,
            prizeKobo: String(paid.find((x) => x.idempotencyKey === `olympiad:${o.id}:${i + 1}`)?.amountKobo ?? 0n),
          })),
        };
      }),
    );
    return { total, rows: out };
  }

  /** Recent matches of every kind, with who played and how they did. */
  async matches(f: { kind?: ArenaKind; status?: ArenaStatus; page?: number; pageSize?: number }) {
    const where: Prisma.ArenaMatchWhereInput = { ...(f.kind ? { kind: f.kind } : {}), ...(f.status ? { status: f.status } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.arenaMatch.count({ where }),
      this.prisma.arenaMatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(f.page, f.pageSize),
        include: { examSubject: { select: { name: true, exam: true } }, players: { orderBy: [{ score: 'desc' }], include: { student: student } }, ghostOf: { include: { student: student } } },
      }),
    ]);
    const speed = await this.speeds(rows.flatMap((m) => m.players.map((pl) => pl.id)));
    return {
      total,
      rows: rows.map((m) => ({
        id: m.id,
        kind: m.kind,
        status: m.status,
        subject: m.examSubject.name,
        exam: m.examSubject.exam,
        code: m.code,
        questions: m.questionIds.length,
        createdAt: m.createdAt,
        finishedAt: m.finishedAt,
        ghostOf: m.ghostOf ? { name: who(m.ghostOf.student).name, score: m.ghostOf.score } : null,
        players: m.players.map((pl) => ({ ...who(pl.student), score: pl.score, correct: pl.correct, place: pl.place, trophies: pl.trophies, xp: pl.xp, finished: !!pl.finishedAt, avgMs: speed.get(pl.id) ?? null })),
      })),
    };
  }

  /** Average time to a right answer, per player. A very low number on a cash-prize run is worth a look. */
  private async speeds(playerIds: string[]) {
    if (!playerIds.length) return new Map<string, number>();
    const rows = await this.prisma.arenaAnswer.groupBy({ by: ['playerId'], where: { playerId: { in: playerIds }, correct: true, ms: { not: null } }, _avg: { ms: true } });
    return new Map(rows.map((r) => [r.playerId, Math.round(r._avg.ms ?? 0)]));
  }
}
