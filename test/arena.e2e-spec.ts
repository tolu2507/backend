/**
 * The arena: Ghost Races over HTTP and a live room over Socket.IO, against nexus_test.
 * The test writes its own questions and accounts and deletes them afterwards.
 *
 *   pnpm test:e2e test/arena.e2e-spec.ts
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';

import { configureApp } from '../src/app.factory.js';
import { AppModule } from '../src/app.module.js';
import { OlympiadService } from '../src/arena/olympiad.service.js';
import { DEFAULTS } from '../src/settings/settings.js';
import { SettingsService } from '../src/settings/settings.service.js';

const prisma = new PrismaClient();
let app: INestApplication;
let url = '';
const http = () => request(app.getHttpServer());
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const stamp = Date.now().toString(36);

let physicsId = '';
let topicId = '';
let leafId = '';
const kids: Record<'ada' | 'bayo' | 'chi', { token: string; id: string }> = { ada: { token: '', id: '' }, bayo: { token: '', id: '' }, chi: { token: '', id: '' } };
let parent = '';

/** The right option for the question a player was just shown, read from the database like an all-knowing player. */
async function rightAnswer(matchId: string, studentId: string, index: number) {
  const row = await prisma.arenaAnswer.findFirstOrThrow({ where: { index, player: { matchId, studentId } }, include: { question: true } });
  return row.question.answerId;
}

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(mod.createNestApplication());
  await app.listen(0);
  url = await app.getUrl();

  physicsId = (await prisma.examSubject.findUniqueOrThrow({ where: { exam_slug: { exam: 'JAMB', slug: 'physics' } } })).id;
  topicId = (await prisma.syllabusTopic.create({ data: { examSubjectId: physicsId, name: `Arena ${stamp}` } })).id;
  leafId = (await prisma.syllabusTopic.create({ data: { examSubjectId: physicsId, parentId: topicId, name: 'Waves' } })).id;
  await prisma.examQuestion.createMany({
    data: Array.from({ length: 20 }, (_, i) => ({
      examSubjectId: physicsId,
      topicId: leafId,
      difficulty: 2,
      stem: `Arena ${stamp}: what is ${i} + 1?`,
      options: [
        { id: 'a', label: String(i + 1) },
        { id: 'b', label: String(i + 2) },
      ],
      answerId: 'a',
      explanation: 'Add one.',
      origin: 'AUTHORED' as const,
      status: 'APPROVED' as const,
    })),
  });

  parent = (await http().post('/auth/register').send({ firstName: 'Ngozi', lastName: 'Eze', email: `ngozi.${stamp}@test.ng`, password: 'password-123', role: 'PARENT' }).expect(201)).body.accessToken;
  const catalog = (await http().get('/exams').expect(200)).body.find((e: { exam: string }) => e.exam === 'JAMB');
  const pick = ['english-language', 'physics', 'chemistry', 'mathematics'].map((slug) => catalog.subjects.find((s: { slug: string }) => s.slug === slug).id);
  for (const name of ['ada', 'bayo', 'chi'] as const) {
    const username = `${name}${stamp}`.slice(0, 20);
    const child = await http()
      .post('/parent/children')
      .set(auth(parent))
      .send({ firstName: name[0].toUpperCase() + name.slice(1), lastName: 'Eze', level: 'SENIOR_SECONDARY', gradeName: 'SS3', username, pin: '4821', consentDataProcessing: true, consentAiReports: true })
      .expect(201);
    await http().put(`/parent/children/${child.body.id}/exams/JAMB`).set(auth(parent)).send({ subjectIds: pick }).expect(200);
    kids[name] = { id: child.body.id, token: (await http().post('/auth/student-login').send({ username, pin: '4821' }).expect(200)).body.accessToken };
  }
});

afterAll(async () => {
  if (app) (app.get(SettingsService) as unknown as { cache: unknown }).cache = null; // back to the saved settings
  const questionIds = (await prisma.examQuestion.findMany({ where: { topicId: leafId }, select: { id: true } })).map((q) => q.id);
  await prisma.olympiad.deleteMany({ where: { questionIds: { hasSome: questionIds } } });
  await prisma.arenaMatch.deleteMany({ where: { players: { some: { studentId: { in: Object.values(kids).map((k) => k.id) } } } } });
  await prisma.examQuestion.deleteMany({ where: { topicId: leafId } });
  await prisma.syllabusTopic.deleteMany({ where: { id: topicId } });
  const users = await prisma.user.findMany({ where: { OR: [{ email: `ngozi.${stamp}@test.ng` }, ...(['ada', 'bayo', 'chi'] as const).map((n) => ({ username: `${n}${stamp}`.slice(0, 20) }))] }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const wallets = await prisma.wallet.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  await prisma.ledgerEntry.deleteMany({ where: { walletId: { in: wallets.map((w) => w.id) } } });
  await prisma.wallet.deleteMany({ where: { id: { in: wallets.map((w) => w.id) } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app?.close();
  await prisma.$disconnect();
});

describe('Ghost Race', () => {
  let adaScore = 0;

  it('the lobby shows trophies and no daily limit on the trial', async () => {
    const lobby = await http().get(`/me/student/arena/subjects/${physicsId}`).set(auth(kids.ada.token)).expect(200);
    expect(lobby.body).toMatchObject({ me: { name: 'Ada E.', trophies: 0 }, played: 0, matches: { limit: null }, questions: 5, seconds: 10 });
  });

  it('with nobody to race, the first player sets a run and earns 5 trophies', async () => {
    const start = await http().post('/me/student/arena/ghost').set(auth(kids.ada.token)).send({ subjectId: physicsId }).expect(200);
    expect(start.body.ghost).toBeNull();
    const matchId = start.body.matchId;

    await http().post(`/me/student/arena/matches/${matchId}/questions/1`).set(auth(kids.ada.token)).expect(400); // in order only
    let last;
    for (let i = 0; i < 5; i++) {
      const q = await http().post(`/me/student/arena/matches/${matchId}/questions/${i}`).set(auth(kids.ada.token)).expect(200);
      expect(q.body.options).toHaveLength(2);
      expect(q.body.answerId).toBeUndefined();
      last = await http().post(`/me/student/arena/matches/${matchId}/answers`).set(auth(kids.ada.token)).send({ index: i, optionId: await rightAnswer(matchId, kids.ada.id, i) }).expect(200);
      expect(last.body).toMatchObject({ correct: true, combo: i > 0 });
      expect(last.body.points).toBeGreaterThan(i > 0 ? 300 : 250); // fast, so near the full speed bonus
    }
    await http().post(`/me/student/arena/matches/${matchId}/answers`).set(auth(kids.ada.token)).send({ index: 4, optionId: 'a' }).expect(400); // once only
    expect(last!.body.finished).toMatchObject({ place: 1, ghostScore: null, correct: 5, xp: 25, trophies: 5, trophiesTotal: 5 });
    adaScore = last!.body.finished.score;
  });

  it('the next player races that real run, gets no coins, and the questions count as seen', async () => {
    const start = await http().post('/me/student/arena/ghost').set(auth(kids.bayo.token)).send({ subjectId: physicsId }).expect(200);
    expect(start.body.ghost).toMatchObject({ name: 'Ada E.', score: adaScore, trophies: 5 });
    expect(start.body.ghost.timeline).toHaveLength(5);
    const matchId = start.body.matchId;
    const coinsBefore = (await prisma.studentProfile.findUniqueOrThrow({ where: { id: kids.bayo.id } })).coinsTotal;

    let last;
    for (let i = 0; i < 5; i++) {
      await http().post(`/me/student/arena/matches/${matchId}/questions/${i}`).set(auth(kids.bayo.token)).expect(200);
      last = await http().post(`/me/student/arena/matches/${matchId}/answers`).set(auth(kids.bayo.token)).send({ index: i }).expect(200); // time ran out
      expect(last.body).toMatchObject({ correct: false, timedOut: true, points: 0 });
    }
    expect(last!.body.finished).toMatchObject({ place: 2, score: 0, ghostScore: adaScore, xp: 0, trophies: 0, trophiesTotal: 0 });

    const bayo = await prisma.studentProfile.findUniqueOrThrow({ where: { id: kids.bayo.id } });
    expect(bayo.coinsTotal).toBe(coinsBefore);
    const seen = await prisma.questionSeen.findMany({ where: { studentId: kids.bayo.id, question: { topicId: leafId } } });
    expect(seen).toHaveLength(5);
    expect(seen.every((s) => s.reviewDueAt)).toBe(true); // missed ones come back in practice
  });
});

describe('Rooms', () => {
  const connect = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const s = io(`${url}/arena`, { auth: { token }, transports: ['websocket'], forceNew: true });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
  const next = <T>(s: Socket, event: string) => new Promise<T>((resolve) => s.once(event, resolve));
  const sockets: Socket[] = [];
  afterAll(() => sockets.forEach((s) => s.disconnect()));

  it('a host opens a room, a friend joins with the code, quick chat works, and the live match ends with places', async () => {
    const room = await http().post('/me/student/arena/rooms').set(auth(kids.ada.token)).send({ subjectId: physicsId }).expect(201);
    const code: string = room.body.code;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    const [ada, chi] = await Promise.all([connect(kids.ada.token), connect(kids.chi.token)]);
    sockets.push(ada, chi);
    const adaJoined = next<{ you: string }>(ada, 'room:joined');
    const adaLobby = next<{ players: unknown[] }>(ada, 'room:state');
    ada.emit('room:join', { code });
    const adaId = (await adaJoined).you;
    expect((await adaLobby).players).toHaveLength(1); // the one joining sees the lobby too, not just those already in it
    const twoPlayers = next<{ players: unknown[] }>(ada, 'room:state');
    const chiLobby = next<{ players: unknown[] }>(chi, 'room:state');
    chi.emit('room:join', { code: code.toLowerCase() });
    const chiId = (await next<{ you: string }>(chi, 'room:joined')).you;
    expect((await twoPlayers).players).toHaveLength(2);
    expect((await chiLobby).players).toHaveLength(2);

    const chat = next<{ from: string; text: string }>(chi, 'room:chat');
    ada.emit('room:chat', { code, phrase: 'gl' });
    expect(await chat).toEqual({ from: adaId, phrase: 'gl', text: 'Good luck!' });

    const refused = next<{ message: string }>(chi, 'room:error');
    chi.emit('room:start', { code });
    expect((await refused).message).toMatch(/Only the host/);

    const matchId = (await prisma.arenaMatch.findUniqueOrThrow({ where: { code } })).id;
    const results = next<{ players: { id: string; place: number; correct: number }[] }>(ada, 'room:results');
    for (const [s, studentId, right] of [
      [ada, kids.ada.id, true],
      [chi, kids.chi.id, false],
    ] as const) {
      s.on('room:question', async (q: { index: number }) => {
        const optionId = right ? await rightAnswer(matchId, studentId, q.index) : 'zz';
        s.emit('room:answer', { code, index: q.index, optionId });
      });
    }
    ada.emit('room:start', { code });

    const done = await results;
    expect(done.players.map((p) => [p.id, p.place, p.correct])).toEqual([
      [adaId, 1, 5],
      [chiId, 2, 0],
    ]);
    const match = await prisma.arenaMatch.findUniqueOrThrow({ where: { id: matchId }, include: { players: true } });
    expect(match).toMatchObject({ status: 'FINISHED', code: null });
    // Ada's Ghost Race questions were left out: nobody in a room gets a question they've had.
    const adaGhost = await prisma.arenaMatch.findFirstOrThrow({ where: { kind: 'GHOST', ghostOfId: null, players: { some: { studentId: kids.ada.id } } } });
    expect(match.questionIds.some((q) => adaGhost.questionIds.includes(q))).toBe(false);
    expect(match.players.every((p) => p.trophies === null)).toBe(true);
  }, 60_000);

  it('a host who leaves an empty room keeps it for 10 minutes: the arena offers the way back, and a friend can still join', async () => {
    const room = await http().post('/me/student/arena/rooms').set(auth(kids.ada.token)).send({ subjectId: physicsId }).expect(201);
    const code: string = room.body.code;
    const ada = await connect(kids.ada.token);
    sockets.push(ada);
    const adaJoined = next<{ you: string }>(ada, 'room:joined');
    ada.emit('room:join', { code });
    const adaId = (await adaJoined).you;
    ada.emit('room:leave', { code });

    const lobby = await http().get(`/me/student/arena/subjects/${physicsId}`).set(auth(kids.ada.token)).expect(200);
    expect(lobby.body.openRoom).toMatchObject({ code, players: 1, here: 0 });
    const closesIn = new Date(lobby.body.openRoom.closesAt).getTime() - Date.now();
    expect(closesIn).toBeGreaterThan(9 * 60_000);
    expect(closesIn).toBeLessThanOrEqual(10 * 60_000);

    // The friend joins while the host is away, and hosts until they're back.
    const chi = await connect(kids.chi.token);
    sockets.push(chi);
    const chiState = next<{ host: string; players: { id: string; connected: boolean }[] }>(chi, 'room:state');
    chi.emit('room:join', { code });
    const chiId = (await next<{ you: string }>(chi, 'room:joined')).you;
    const seen = await chiState;
    expect(seen.host).toBe(chiId);
    expect(seen.players.find((p) => p.id === adaId)?.connected).toBe(false);

    const back = next<{ host: string; players: { id: string; connected: boolean }[] }>(ada, 'room:state');
    ada.emit('room:join', { code });
    const now = await back;
    expect(now.players.every((p) => p.connected)).toBe(true);
    expect(now.host).toBe(chiId);
    expect((await http().get(`/me/student/arena/subjects/${physicsId}`).set(auth(kids.ada.token)).expect(200)).body.openRoom).toMatchObject({ code, players: 2, here: 2, closesAt: null });

    for (const s of [ada, chi]) s.emit('room:leave', { code });
  });

  it('Quick Match pairs two players searching the same subject; the winner gains trophies', async () => {
    const [ada, bayo] = await Promise.all([connect(kids.ada.token), connect(kids.bayo.token)]);
    sockets.push(ada, bayo);
    const adaFound = next<{ code: string; opponent: { name: string } }>(ada, 'quick:matched');
    const bayoFound = next<{ code: string; opponent: { name: string } }>(bayo, 'quick:matched');
    ada.emit('quick:search', { subjectId: physicsId });
    bayo.emit('quick:search', { subjectId: physicsId });
    const [a, b] = await Promise.all([adaFound, bayoFound]);
    expect(a.code).toBe(b.code);
    expect([a.opponent.name, b.opponent.name]).toEqual(['Bayo E.', 'Ada E.']);

    const before = (await prisma.studentProfile.findUniqueOrThrow({ where: { id: kids.ada.id } })).trophies;
    const matchId = (await prisma.arenaMatch.findUniqueOrThrow({ where: { code: a.code } })).id;
    const results = next<{ players: { place: number; trophies: number | null }[] }>(ada, 'room:results');
    for (const [s, studentId, right] of [
      [ada, kids.ada.id, true],
      [bayo, kids.bayo.id, false],
    ] as const) {
      s.on('room:question', async (q: { index: number }) => s.emit('room:answer', { code: a.code, index: q.index, optionId: right ? await rightAnswer(matchId, studentId, q.index) : 'zz' }));
      s.emit('room:join', { code: a.code });
    }
    const done = await results;
    expect(done.players.map((p) => [p.place, p.trophies])).toEqual([
      [1, 12],
      [2, 0], // can't go below zero
    ]);
    expect((await prisma.studentProfile.findUniqueOrThrow({ where: { id: kids.ada.id } })).trophies).toBe(before + 12);
  }, 60_000);
});

describe('Daily Olympiad and leaderboards', () => {
  let olympiadId = '';

  beforeAll(() => {
    // Open the Olympiad now, prizes on for 2 players, without touching saved settings.
    const lagosHour = new Date(Date.now() + 3_600_000).getUTCHours();
    (app.get(SettingsService) as unknown as { cache: unknown }).cache = { at: Date.now() + 3_600_000, value: { ...DEFAULTS, olympiadHour: lagosHour, olympiadMinutes: 180, olympiadPrizesOn: true, olympiadMinPlayers: 2 } };
  });

  it('two children play today’s Olympiad on the same questions, once each; the board ranks them', async () => {
    const before = await http().get(`/me/student/arena/subjects/${physicsId}/olympiad`).set(auth(kids.ada.token)).expect(200);
    expect(before.body).toMatchObject({ status: 'open', questions: 10, players: 0, me: null, prizes: { naira: [1000, 500, 300], minPlayers: 2 } });

    const runs: string[][] = [];
    for (const [kid, right] of [
      [kids.ada, true],
      [kids.bayo, false],
    ] as const) {
      const start = await http().post('/me/student/arena/olympiad').set(auth(kid.token)).send({ subjectId: physicsId }).expect(200);
      const match = await prisma.arenaMatch.findUniqueOrThrow({ where: { id: start.body.matchId } });
      olympiadId = match.olympiadId!;
      runs.push(match.questionIds);
      let last;
      for (let i = 0; i < 10; i++) {
        await http().post(`/me/student/arena/matches/${start.body.matchId}/questions/${i}`).set(auth(kid.token)).expect(200);
        last = await http().post(`/me/student/arena/matches/${start.body.matchId}/answers`).set(auth(kid.token)).send({ index: i, optionId: right ? await rightAnswer(start.body.matchId, kid.id, i) : 'zz' }).expect(200);
      }
      expect(last!.body.finished).toMatchObject({ correct: right ? 10 : 0, xp: right ? 50 : 0 });
      await http().post('/me/student/arena/olympiad').set(auth(kid.token)).send({ subjectId: physicsId }).expect(400); // once a day
    }
    expect(runs[0]).toEqual(runs[1]);

    const board = await http().get(`/me/student/arena/subjects/${physicsId}/olympiad`).set(auth(kids.bayo.token)).expect(200);
    expect(board.body.players).toBe(2);
    expect(board.body.top.map((r: { name: string; you: boolean }) => [r.name, r.you])).toEqual([
      ['Ada E.', false],
      ['Bayo E.', true],
    ]);
    expect(board.body.me).toMatchObject({ rank: 2, finished: true });
  });

  it('after it closes, places are set and the winner’s parent gets the 1st prize (once)', async () => {
    const later = new Date(Date.now() + 5 * 3_600_000);
    await app.get(OlympiadService).settleDue(later);
    await app.get(OlympiadService).settleDue(later); // settling again pays nothing more
    const olympiad = await prisma.olympiad.findUniqueOrThrow({ where: { id: olympiadId } });
    expect(olympiad.settledAt).not.toBeNull();
    const parentUser = await prisma.user.findFirstOrThrow({ where: { email: `ngozi.${stamp}@test.ng` } });
    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId: parentUser.id, type: 'REWARDS' } });
    // 1st (Ada) wins ₦1,000; 2nd (Bayo) scored nothing, so no prize for a zero score.
    expect(wallet.balanceKobo).toBe(100_000n);
    const places = await prisma.arenaPlayer.findMany({ where: { match: { olympiadId } }, select: { studentId: true, place: true } });
    expect(places.find((p) => p.studentId === kids.ada.id)?.place).toBe(1);
  });

  it('the trophy leaderboard ranks everyone on the same exam', async () => {
    const board = await http().get(`/me/student/arena/subjects/${physicsId}/leaderboard`).set(auth(kids.bayo.token)).expect(200);
    expect(board.body.exam).toBe('JAMB');
    const ada = board.body.top.find((r: { name: string }) => r.name === 'Ada E.');
    expect(ada.trophies).toBe(17); // 5 for the first Ghost Race run + 12 for the Quick Match
    expect(board.body.me).toMatchObject({ name: 'Bayo E.', rank: null }); // no trophies yet
  });
});

describe('Parent switches', () => {
  it('a parent turns the arena off and the child is kept out', async () => {
    await http().put(`/parent/children/${kids.chi.id}/arena`).set(auth(parent)).send({ arenaAllowed: false }).expect(200);
    const res = await http().get(`/me/student/arena/subjects/${physicsId}`).set(auth(kids.chi.token)).expect(403);
    expect(res.body.message).toMatch(/switched the arena off/);
    const children = await http().get('/parent/children').set(auth(parent)).expect(200);
    expect(children.body.find((c: { id: string }) => c.id === kids.chi.id)).toMatchObject({ arenaAllowed: false, chatAllowed: true });
  });
});
