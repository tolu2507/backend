import { BadRequestException, HttpException, Injectable, Logger, NotFoundException, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { Namespace } from 'socket.io';

import { PrismaService } from '../prisma/prisma.service.js';
import { ArenaService, PHRASES, places, QUESTIONS, SECONDS, type ArenaStudent, type Phrase } from './arena.service.js';

const MAX_PLAYERS = 8;
const COUNTDOWN_MS = 3000;
const GRACE_MS = 1500;
const REVEAL_MS = 3000;
/** A Quick Match player who drops out before it starts gets this long to come back before they lose their place. */
const LOBBY_RECONNECT_MS = 20_000;
/** A friends' room keeps a player who leaves its lobby (to do something else, or while waiting) this long. */
export const ROOM_AWAY_MS = 10 * 60_000;
const CHAT_GAP_MS = 1500;
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I
/** Quick Match: time for both phones to open the match before it starts. */
const LIVE_START_MS = 5000;
/** Quick Match: give up looking after this long (the app then offers a Ghost Race). */
const SEARCH_MS = 25_000;
/** Quick Match trophies. A friendly room gives none. */
const LIVE_TROPHIES = { win: 12, loss: -6, draw: 3 };
/** How far apart in trophies two players may be, widening the longer they wait; anyone after 10 seconds. */
const trophyGap = (waitedMs: number) => (waitedMs >= 10_000 ? Infinity : 100 + (waitedMs / 1000) * 50);

type Option = { id: string; label: string };
type Player = ArenaStudent & { playerId: string; sockets: Set<string>; score: number; correct: number; answered: boolean; lastChat: number; dropTimer?: NodeJS.Timeout; awayUntil?: number };
type Searcher = { me: ArenaStudent; socketId: string; since: number };
type Room = {
  kind: 'ROOM' | 'LIVE';
  code: string;
  matchId: string;
  subject: { id: string; name: string };
  hostId: string; // StudentProfile id
  status: 'lobby' | 'playing' | 'finished';
  players: Map<string, Player>; // by StudentProfile id
  questions: { id: string; prompt: string; options: Option[] }[];
  index: number;
  endsAt: number;
  timer?: NodeJS.Timeout;
  /** Every change to a room runs through this, one at a time, so answers and the clock never race. */
  queue: Promise<unknown>;
};

/**
 * Live private rooms. Room state lives in this server's memory, so the API must run as ONE instance
 * (Railway's default). Running more needs a shared store such as Redis first.
 */
@Injectable()
export class RoomsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RoomsService.name);
  private readonly rooms = new Map<string, Room>();
  /** Quick Match queues, by subject. */
  private readonly searching = new Map<string, Searcher[]>();
  private searchTimer?: NodeJS.Timeout;
  private io?: Namespace;

  constructor(
    private readonly prisma: PrismaService,
    private readonly arena: ArenaService,
  ) {}

  attach(io: Namespace) {
    this.io = io;
  }

  /** Rooms live only in memory, so any left open in the database by the last run are gone: close them. */
  async onApplicationBootstrap() {
    const { count } = await this.prisma.arenaMatch.updateMany({ where: { kind: { in: ['ROOM', 'LIVE'] }, status: { in: ['WAITING', 'PLAYING'] } }, data: { status: 'CANCELLED', code: null } });
    if (count) this.logger.log(`Closed ${count} room${count === 1 ? '' : 's'} left open by the last run`);
  }

  onApplicationShutdown() {
    for (const room of this.rooms.values()) {
      clearTimeout(room.timer);
      for (const p of room.players.values()) clearTimeout(p.dropTimer);
    }
    clearInterval(this.searchTimer);
  }

  private async newCode() {
    let code = '';
    do code = Array.from({ length: 6 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join('');
    while (this.rooms.has(code) || (await this.prisma.arenaMatch.findUnique({ where: { code }, select: { id: true } })));
    return code;
  }

  /** Opens a room on one of the host's subjects and returns its invite code. */
  async create(userId: string, examSubjectId: string) {
    const me = await this.arena.student(userId);
    const subject = await this.arena.subject(me.id, examSubjectId);
    await this.arena.assertMatchLeft(me.id);
    const code = await this.newCode();
    const match = await this.prisma.arenaMatch.create({ data: { kind: 'ROOM', status: 'WAITING', examSubjectId, code, hostId: me.id, players: { create: { studentId: me.id } } }, include: { players: true } });
    this.rooms.set(code, {
      kind: 'ROOM',
      code,
      matchId: match.id,
      subject: { id: subject.id, name: subject.name },
      hostId: me.id,
      status: 'lobby',
      players: new Map([[me.id, this.player(me, match.players[0].id)]]),
      questions: [],
      index: -1,
      endsAt: 0,
      queue: Promise.resolve(),
    });
    return { code, subject: { id: subject.id, name: subject.name } };
  }

  private player(me: ArenaStudent, playerId: string): Player {
    return { ...me, playerId, sockets: new Set(), score: 0, correct: 0, answered: false, lastChat: 0 };
  }

  /** Runs `fn` after everything already queued for this room. */
  private run<T>(room: Room, fn: () => Promise<T>): Promise<T> {
    const next = room.queue.then(fn);
    room.queue = next.catch((e: unknown) => {
      if (!(e instanceof HttpException)) this.logger.error(`room ${room.code}: ${String(e)}`);
    });
    return next;
  }

  private room(code: string) {
    const room = this.rooms.get(code.trim().toUpperCase());
    if (!room) throw new NotFoundException('That room code doesn’t exist, or the room has closed.');
    return room;
  }

  // ── What players see ──────────────────────────────────

  private state(room: Room) {
    return {
      kind: room.kind,
      code: room.code,
      subject: room.subject,
      status: room.status,
      host: room.players.get(room.hostId)?.playerId ?? null,
      index: room.index,
      questions: QUESTIONS,
      seconds: SECONDS,
      players: [...room.players.values()].map((p) => ({ id: p.playerId, name: p.name, initial: p.initial, score: p.score, connected: p.sockets.size > 0, answered: p.answered })),
    };
  }

  private broadcast(room: Room) {
    this.io?.to(room.code).emit('room:state', this.state(room));
  }

  private question(room: Room) {
    const q = room.questions[room.index];
    return { index: room.index, prompt: q.prompt, options: q.options, msLeft: Math.max(0, room.endsAt - Date.now()) };
  }

  // ── Joining and leaving ───────────────────────────────

  async join(me: ArenaStudent, socketId: string, code: string) {
    const room = this.room(code);
    return this.run(room, async () => {
      let p = room.players.get(me.id);
      if (!p) {
        if (room.kind === 'LIVE') throw new BadRequestException('This is someone else’s Quick Match.');
        if (room.status !== 'lobby') throw new BadRequestException('This match has already started.');
        if (room.players.size >= MAX_PLAYERS) throw new BadRequestException(`This room is full (${MAX_PLAYERS} players).`);
        try {
          await this.arena.subject(me.id, room.subject.id);
        } catch {
          throw new BadRequestException(`Add ${room.subject.name} to your subjects to join this room.`);
        }
        await this.arena.assertMatchLeft(me.id);
        const row = await this.prisma.arenaPlayer.create({ data: { matchId: room.matchId, studentId: me.id } });
        p = this.player(me, row.id);
        room.players.set(me.id, p);
      }
      clearTimeout(p.dropTimer);
      p.awayUntil = undefined;
      p.sockets.add(socketId);
      this.passHost(room);
      this.broadcast(room);
      return { room: room.code, you: p.playerId, state: this.state(room), question: room.status === 'playing' && !p.answered && room.index >= 0 ? this.question(room) : null };
    });
  }

  /** A socket went away. In the lobby the player keeps their place for a while; in a match they just stop answering. */
  async disconnect(me: ArenaStudent, socketId: string) {
    this.stopSearching(me.id);
    for (const room of this.rooms.values()) {
      const p = room.players.get(me.id);
      if (!p?.sockets.delete(socketId)) continue;
      if (room.status === 'lobby' && !p.sockets.size) this.away(room, me.id, p);
      else this.broadcast(room);
    }
  }

  /** Left the room screen. A friends' room keeps their place (and the room) for ROOM_AWAY_MS; a Quick Match lets them go. */
  async leave(me: ArenaStudent, socketId: string, code: string) {
    const room = this.room(code);
    await this.run(room, async () => {
      const p = room.players.get(me.id);
      if (!p) return;
      p.sockets.delete(socketId);
      this.io?.in(socketId).socketsLeave(room.code);
      if (room.status !== 'lobby' || p.sockets.size) this.broadcast(room);
      else if (room.kind === 'ROOM') this.away(room, me.id, p);
      else await this.remove(room, me.id);
    });
  }

  /** Marks a lobby player away: they keep their place until the timer runs out, and hand over hosting to someone still here. */
  private away(room: Room, studentId: string, p: Player) {
    const ms = room.kind === 'ROOM' ? ROOM_AWAY_MS : LOBBY_RECONNECT_MS;
    clearTimeout(p.dropTimer);
    p.awayUntil = Date.now() + ms;
    p.dropTimer = setTimeout(() => void this.run(room, () => this.remove(room, studentId)), ms);
    p.dropTimer.unref?.();
    this.passHost(room);
    this.broadcast(room);
  }

  /** An away host can't press Start, so hosting moves to the first player who's here. */
  private passHost(room: Room) {
    if (room.players.get(room.hostId)?.sockets.size) return;
    const here = [...room.players.entries()].find(([, x]) => x.sockets.size);
    if (here) room.hostId = here[0];
  }

  /** The student's open friends' room in this subject, if they still have a place in one, so the arena can offer the way back. */
  openRoom(studentId: string, examSubjectId: string) {
    const room = [...this.rooms.values()].reverse().find((r) => r.kind === 'ROOM' && r.status === 'lobby' && r.subject.id === examSubjectId && r.players.has(studentId));
    if (!room) return null;
    const me = room.players.get(studentId)!;
    return { code: room.code, players: room.players.size, here: [...room.players.values()].filter((x) => x.sockets.size).length, closesAt: me.awayUntil ? new Date(me.awayUntil) : null };
  }

  /** Takes a player out of a lobby. Their match doesn't count towards the daily limit. The last one out closes the room. */
  private async remove(room: Room, studentId: string, force = false) {
    const p = room.players.get(studentId);
    if (!p || room.status !== 'lobby' || (p.sockets.size && !force)) return;
    room.players.delete(studentId);
    await this.prisma.arenaPlayer.delete({ where: { id: p.playerId } });
    if (!room.players.size) {
      this.rooms.delete(room.code);
      await this.prisma.arenaMatch.update({ where: { id: room.matchId }, data: { status: 'CANCELLED', code: null } });
      return;
    }
    if (room.hostId === studentId) room.hostId = room.players.keys().next().value!;
    this.broadcast(room);
  }

  // ── Playing ───────────────────────────────────────────

  async start(me: ArenaStudent, code: string) {
    const room = this.room(code);
    await this.run(room, async () => {
      if (room.hostId !== me.id) throw new BadRequestException('Only the host can start the match.');
      if (room.status !== 'lobby') throw new BadRequestException('The match has already started.');
      if ([...room.players.values()].filter((p) => p.sockets.size).length < 2) throw new BadRequestException('Wait for at least one friend to join.');
      // Anyone still away when it starts misses this one.
      const away = Array.from(room.players).filter(([, p]) => !p.sockets.size); // a copy: remove() deletes from the map
      for (const [id] of away) await this.remove(room, id, true);
      await this.begin(room);
    });
  }

  /** Closes a lobby that can't start, telling everyone in it why. */
  private async close(room: Room, why: string) {
    this.io?.to(room.code).emit('room:error', { message: why });
    const ids = Array.from(room.players.keys()); // a copy: remove() deletes from the map
    for (const id of ids) await this.remove(room, id, true);
  }

  /** Picks the questions (none any player has had) and starts the countdown. */
  private async begin(room: Room) {
    if (room.status !== 'lobby') return;
    if (room.players.size < 2) {
      // A Quick Match opponent left before it started.
      return this.close(room, 'Your opponent left before the match started. Try Quick Match again.');
    }
    let ids: string[];
    try {
      ids = await this.arena.pickQuestions([...room.players.keys()], room.subject.id);
    } catch (e) {
      // Not enough questions nobody has had: a Quick Match can't wait for a host to try again, so it closes.
      if (room.kind === 'LIVE' && e instanceof HttpException) {
        return this.close(room, (e.getResponse() as { message?: string }).message ?? e.message);
      }
      throw e;
    }
    const rows = await this.prisma.examQuestion.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map((q) => [q.id, q]));
    room.questions = ids.map((id) => {
      const q = byId.get(id)!;
      return { id, prompt: q.stem, options: [...(q.options as Option[])].sort(() => Math.random() - 0.5) };
    });
    await this.prisma.arenaMatch.update({ where: { id: room.matchId }, data: { status: 'PLAYING', questionIds: ids } });
    room.status = 'playing';
    this.broadcast(room);
    this.io?.to(room.code).emit('room:starting', { msLeft: COUNTDOWN_MS });
    room.timer = setTimeout(() => void this.run(room, () => this.nextQuestion(room)), COUNTDOWN_MS);
  }

  private async nextQuestion(room: Room) {
    room.index++;
    const servedAt = new Date();
    await this.prisma.arenaAnswer.createMany({ data: [...room.players.values()].map((p) => ({ playerId: p.playerId, index: room.index, questionId: room.questions[room.index].id, servedAt })) });
    for (const p of room.players.values()) p.answered = false;
    room.endsAt = servedAt.getTime() + SECONDS * 1000;
    this.io?.to(room.code).emit('room:question', this.question(room));
    this.broadcast(room);
    room.timer = setTimeout(() => void this.run(room, () => this.reveal(room)), SECONDS * 1000 + GRACE_MS);
  }

  async answer(me: ArenaStudent, code: string, index: number, optionId: string | null) {
    const room = this.room(code);
    const at = new Date(); // timed when it arrives, not when its turn in the queue comes
    await this.run(room, async () => {
      const p = room.players.get(me.id);
      if (!p || room.status !== 'playing' || index !== room.index || p.answered) return;
      const r = await this.arena.answer(p.playerId, index, optionId, at);
      p.answered = true;
      p.score = r.score;
      if (r.correct) p.correct++;
      for (const s of p.sockets) this.io?.to(s).emit('room:marked', { index, correct: r.correct, timedOut: r.timedOut, points: r.points, combo: r.combo, score: r.score });
      this.broadcast(room);
      // Everyone still here has answered: no need to wait for the clock.
      if ([...room.players.values()].every((x) => x.answered || !x.sockets.size)) {
        clearTimeout(room.timer);
        await this.reveal(room);
      }
    });
  }

  private async reveal(room: Room) {
    if (room.status !== 'playing') return;
    clearTimeout(room.timer);
    const q = await this.prisma.examQuestion.findUniqueOrThrow({ where: { id: room.questions[room.index].id }, select: { answerId: true, explanation: true } });
    const answers = await this.prisma.arenaAnswer.findMany({ where: { index: room.index, player: { matchId: room.matchId } }, select: { playerId: true, correct: true, points: true, answeredAt: true } });
    this.io?.to(room.code).emit('room:reveal', {
      index: room.index,
      answerId: q.answerId,
      explanation: q.explanation,
      results: answers.map((a) => ({ id: a.playerId, correct: a.correct, points: a.points, answered: !!a.answeredAt })),
    });
    this.broadcast(room);
    room.timer = setTimeout(() => void this.run(room, () => (room.index < QUESTIONS - 1 ? this.nextQuestion(room) : this.finish(room))), REVEAL_MS);
  }

  private async finish(room: Room) {
    room.status = 'finished';
    const players = [...room.players.values()];
    const place = places(players.map((p) => ({ id: p.playerId, score: p.score })));
    const draw = players.every((p) => place.get(p.playerId) === 1);
    const trophies = (p: Player) => {
      if (room.kind !== 'LIVE') return null;
      if (draw) return LIVE_TROPHIES.draw;
      return place.get(p.playerId) === 1 ? LIVE_TROPHIES.win : Math.max(LIVE_TROPHIES.loss, -p.trophies);
    };
    const results = players.map((p) => ({ playerId: p.playerId, studentId: p.id, place: place.get(p.playerId)!, xp: p.correct * 5 + (place.get(p.playerId) === 1 ? 20 : 0), trophies: trophies(p) }));
    await this.prisma.$transaction((tx) => this.arena.settle(tx, room.matchId, room.kind, results), { timeout: 30_000 });
    this.io?.to(room.code).emit('room:results', {
      players: players
        .map((p) => {
          const r = results.find((x) => x.playerId === p.playerId)!;
          return { id: p.playerId, name: p.name, initial: p.initial, score: p.score, correct: p.correct, place: r.place, xp: r.xp, trophies: r.trophies };
        })
        .sort((a, b) => a.place - b.place),
      questions: QUESTIONS,
    });
    this.broadcast(room);
    setTimeout(() => this.rooms.delete(room.code), 60_000);
  }

  // ── Quick Match ───────────────────────────────────────

  /** Puts the student in the Quick Match queue for a subject and pairs them as soon as there's someone close in trophies. */
  async search(me: ArenaStudent, socketId: string, examSubjectId: string) {
    await this.arena.subject(me.id, examSubjectId);
    await this.arena.assertMatchLeft(me.id);
    this.stopSearching(me.id);
    const queue = this.searching.get(examSubjectId) ?? [];
    queue.push({ me, socketId, since: Date.now() });
    this.searching.set(examSubjectId, queue);
    this.searchTimer ??= setInterval(() => void this.sweep(), 1000);
    await this.pair(examSubjectId);
  }

  /** What's happening on this server right now, for Overwatch. */
  live() {
    const rooms = Array.from(this.rooms.values());
    const count = (kind: Room['kind'], status: Room['status']) => rooms.filter((r) => r.kind === kind && r.status === status).length;
    return {
      roomsWaiting: count('ROOM', 'lobby'),
      roomsPlaying: count('ROOM', 'playing'),
      quickPlaying: count('LIVE', 'playing') + count('LIVE', 'lobby'),
      playersInGames: rooms.reduce((n, r) => n + (r.status === 'finished' ? 0 : r.players.size), 0),
      searching: Array.from(this.searching.values()).reduce((n, q) => n + q.length, 0),
    };
  }

  stopSearching(studentId: string) {
    for (const [subjectId, queue] of this.searching) {
      const rest = queue.filter((s) => s.me.id !== studentId);
      if (rest.length) this.searching.set(subjectId, rest);
      else this.searching.delete(subjectId);
    }
  }

  /** Every second: pair anyone who now fits, and let go of anyone who has waited too long. */
  private async sweep() {
    const now = Date.now();
    const queues = Array.from(this.searching); // a copy: stopSearching() changes the map
    for (const [subjectId, queue] of queues) {
      for (const s of queue.filter((x) => now - x.since >= SEARCH_MS)) {
        this.stopSearching(s.me.id);
        this.io?.to(s.socketId).emit('quick:timeout', {});
      }
      if (this.searching.has(subjectId)) await this.pair(subjectId).catch((e: unknown) => this.logger.error(`quick match: ${String(e)}`));
    }
    if (!this.searching.size) {
      clearInterval(this.searchTimer);
      this.searchTimer = undefined;
    }
  }

  private async pair(examSubjectId: string): Promise<void> {
    const queue = this.searching.get(examSubjectId) ?? [];
    const now = Date.now();
    for (const a of queue) {
      const b = queue.find((x) => x.me.id !== a.me.id && Math.abs(x.me.trophies - a.me.trophies) <= trophyGap(now - Math.min(a.since, x.since)));
      if (!b) continue;
      // Out of the queue before anything slow, so nobody gets paired twice.
      this.stopSearching(a.me.id);
      this.stopSearching(b.me.id);
      await this.startLive(examSubjectId, [a, b]);
      return this.pair(examSubjectId);
    }
  }

  private async startLive(examSubjectId: string, pair: Searcher[]) {
    const subject = await this.prisma.examSubject.findUniqueOrThrow({ where: { id: examSubjectId }, select: { id: true, name: true } });
    const code = await this.newCode();
    const match = await this.prisma.arenaMatch.create({
      data: { kind: 'LIVE', status: 'WAITING', examSubjectId, code, hostId: pair[0].me.id, players: { create: pair.map((s) => ({ studentId: s.me.id })) } },
      include: { players: true },
    });
    const room: Room = {
      kind: 'LIVE',
      code,
      matchId: match.id,
      subject,
      hostId: pair[0].me.id,
      status: 'lobby',
      players: new Map(pair.map((s) => [s.me.id, this.player(s.me, match.players.find((p) => p.studentId === s.me.id)!.id)])),
      questions: [],
      index: -1,
      endsAt: 0,
      queue: Promise.resolve(),
    };
    this.rooms.set(code, room);
    for (const [i, s] of pair.entries()) {
      const other = pair[1 - i].me;
      this.io?.to(s.socketId).emit('quick:matched', { code, opponent: { name: other.name, initial: other.initial, trophies: other.trophies } });
    }
    room.timer = setTimeout(() => void this.run(room, () => this.begin(room)), LIVE_START_MS);
  }

  // ── Quick chat ────────────────────────────────────────

  chat(me: ArenaStudent, code: string, phrase: Phrase) {
    const room = this.room(code);
    const p = room.players.get(me.id);
    if (!p || !p.chatAllowed || !(phrase in PHRASES)) return;
    const now = Date.now();
    if (now - p.lastChat < CHAT_GAP_MS) return;
    p.lastChat = now;
    // Only players whose parents allow chat see it.
    for (const other of room.players.values()) if (other.chatAllowed) for (const s of other.sockets) this.io?.to(s).emit('room:chat', { from: p.playerId, phrase, text: PHRASES[phrase] });
  }
}
