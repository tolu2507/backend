/**
 * The Friday mock and the parent progress page, through the real HTTP API on nexus_test.
 * The test makes its own questions, mock window and accounts, and deletes them afterwards.
 *
 *   pnpm test:e2e test/mocks.e2e-spec.ts
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { configureApp } from '../src/app.factory.js';
import { AppModule } from '../src/app.module.js';
import { MocksService } from '../src/mocks/mocks.service.js';

const prisma = new PrismaClient();
let app: INestApplication;
const http = () => request(app.getHttpServer());
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const stamp = Date.now().toString(36);

const SLUGS = ['english-language', 'mathematics', 'physics', 'chemistry'];
const subject: Record<string, string> = {}; // slug → examSubjectId
const topicIds: string[] = [];
let mockId = '';

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(mod.createNestApplication());
  await app.init();

  // 3 approved questions in each of 4 JAMB subjects; the answer is always "a".
  for (const slug of [...SLUGS, 'biology']) {
    subject[slug] = (await prisma.examSubject.findUniqueOrThrow({ where: { exam_slug: { exam: 'JAMB', slug } } })).id;
    if (slug === 'biology') continue; // left empty on purpose
    const topic = await prisma.syllabusTopic.create({ data: { examSubjectId: subject[slug], name: `Mock topic ${stamp}`, weight: 0.5, yearsSeen: 3 } });
    topicIds.push(topic.id);
    await prisma.examQuestion.createMany({
      data: [1, 2, 3].map((i) => ({
        examSubjectId: subject[slug],
        topicId: topic.id,
        difficulty: 2,
        stem: `Mock ${stamp} ${slug} question ${i}`,
        options: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: `Option ${id}` })),
        answerId: 'a',
        explanation: `Because ${i}.`,
        origin: 'AUTHORED' as const,
        status: 'APPROVED' as const,
      })),
    });
  }
  // A window that's open now (the real ones are on Fridays).
  const now = Date.now();
  mockId = (await prisma.mockExam.create({ data: { exam: 'JAMB', title: `Test mock ${stamp}`, opensAt: new Date(now - 10 * 3_600_000), closesAt: new Date(now + 3_600_000), durationMinutes: 120 } })).id;
});

afterAll(async () => {
  await prisma.mockExam.deleteMany({ where: { id: mockId } }); // sittings cascade
  await prisma.examQuestion.deleteMany({ where: { topicId: { in: topicIds } } });
  await prisma.syllabusTopic.deleteMany({ where: { id: { in: topicIds } } });
  const users = await prisma.user.findMany({ where: { OR: [{ email: { endsWith: `${stamp}@test.ng` } }, { username: { in: [`ade${stamp}`.slice(0, 20), `bisi${stamp}`.slice(0, 20)] } }] }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app?.close();
  await prisma.$disconnect();
});

describe('Friday mock', () => {
  let parent = '';
  let ade = { id: '', token: '' };
  let bisi = { id: '', token: '' };
  let sitting = '';
  let paper: { subjects: { id: string; name: string; questions: { id: string; options: { id: string }[] }[] }[] };

  const child = async (name: string) => {
    const username = `${name}${stamp}`.slice(0, 20);
    const res = await http().post('/parent/children').set(auth(parent)).send({ firstName: name, lastName: 'Bello', level: 'SENIOR_SECONDARY', gradeName: 'SS3', username, pin: '4821', consentDataProcessing: true, consentAiReports: true }).expect(201);
    const token = (await http().post('/auth/student-login').send({ username, pin: '4821' }).expect(200)).body.accessToken;
    return { id: res.body.id as string, token: token as string };
  };
  const choose = (id: string, slugs: string[]) => http().put(`/parent/children/${id}/exams/JAMB`).set(auth(parent)).send({ subjectIds: slugs.map((s) => subject[s]) });

  it('a JAMB student sees this week’s mock, and it won’t start without questions for every subject', async () => {
    parent = (await http().post('/auth/register').send({ firstName: 'Kemi', lastName: 'Bello', email: `kemi.${stamp}@test.ng`, password: 'password-123', role: 'PARENT' }).expect(201)).body.accessToken;
    ade = await child('ade');
    bisi = await child('bisi');
    await choose(ade.id, ['english-language', 'mathematics', 'physics', 'biology']).expect(200);

    const view = await http().get('/me/student/mocks').set(auth(ade.token)).expect(200);
    const mock = view.body.upcoming[0];
    expect(mock).toMatchObject({ id: mockId, state: 'OPEN', outOf: 400, ready: false, sitting: null });
    expect(mock.subjects.find((s: { name: string }) => s.name === 'Use of English')).toMatchObject({ needed: 60, available: 3 });

    const res = await http().post(`/me/student/mocks/${mockId}/start`).set(auth(ade.token)).expect(400);
    expect(res.body.message).toMatch(/Biology/);
  });

  it('starts once, with English first and no answers sent to the phone', async () => {
    await choose(ade.id, SLUGS).expect(200);
    sitting = (await http().post(`/me/student/mocks/${mockId}/start`).set(auth(ade.token)).expect(200)).body.sittingId;
    const again = await http().post(`/me/student/mocks/${mockId}/start`).set(auth(ade.token)).expect(200);
    expect(again.body.sittingId).toBe(sitting);

    paper = (await http().get(`/me/student/mocks/sittings/${sitting}`).set(auth(ade.token)).expect(200)).body;
    expect(paper.subjects.map((s) => s.name)[0]).toBe('Use of English');
    expect(paper.subjects.map((s) => s.questions.length)).toEqual([3, 3, 3, 3]);
    expect(JSON.stringify(paper)).not.toMatch(/answerId|explanation/);
    await http().get(`/me/student/mocks/sittings/${sitting}`).set(auth(bisi.token)).expect(404); // not theirs
  });

  it('saves answers as they go and ignores questions that aren’t on the paper', async () => {
    const english = paper.subjects[0].questions;
    const saved = await http().put(`/me/student/mocks/sittings/${sitting}/answers`).set(auth(ade.token)).send({ answers: { [english[0].id]: 'a', 'not-a-question': 'a' } }).expect(200);
    expect(saved.body.saved).toBe(1);
    await http().get(`/me/student/mocks/sittings/${sitting}/result`).set(auth(ade.token)).expect(400); // not finished
    const reloaded = await http().get(`/me/student/mocks/sittings/${sitting}`).set(auth(ade.token)).expect(200);
    expect(reloaded.body.answers).toEqual({ [english[0].id]: 'a' });
  });

  it('marks JAMB-style (each subject out of 100) but keeps answers hidden while the window is open', async () => {
    const answers: Record<string, string> = {};
    const bySubject = Object.fromEntries(paper.subjects.map((s) => [s.name, s.questions]));
    for (const q of bySubject['Use of English']) answers[q.id] = 'a'; // 3/3 → 100
    bySubject['Mathematics'].forEach((q, i) => (answers[q.id] = i < 2 ? 'a' : 'b')); // 2/3 → 67
    bySubject['Physics'].forEach((q, i) => (answers[q.id] = i < 1 ? 'a' : 'b')); // 1/3 → 33
    // Chemistry left blank → 0
    const res = await http().post(`/me/student/mocks/sittings/${sitting}/submit`).set(auth(ade.token)).send({ answers }).expect(200);
    expect(res.body).toMatchObject({ score: 200, outOf: 400, nationalRank: null, review: null, resultsOut: false });
    await http().put(`/me/student/mocks/sittings/${sitting}/answers`).set(auth(ade.token)).send({ answers }).expect(400); // already in

    const missed = await prisma.questionSeen.count({ where: { studentId: ade.id, reviewDueAt: { not: null } } });
    expect(missed).toBe(6); // 1 maths + 2 physics + 3 chemistry come back as reviews
  });

  it('when the window closes, unfinished papers are marked, everyone is ranked and answers appear', async () => {
    await choose(bisi.id, SLUGS).expect(200);
    const s2 = (await http().post(`/me/student/mocks/${mockId}/start`).set(auth(bisi.token)).expect(200)).body.sittingId;
    const p2 = (await http().get(`/me/student/mocks/sittings/${s2}`).set(auth(bisi.token)).expect(200)).body;
    await http().put(`/me/student/mocks/sittings/${s2}/answers`).set(auth(bisi.token)).send({ answers: { [p2.subjects[0].questions[0].id]: 'a' } }).expect(200);
    // Bisi never presses submit.

    await prisma.mockExam.update({ where: { id: mockId }, data: { closesAt: new Date(Date.now() - 1000) } });
    await prisma.mockSitting.update({ where: { id: s2 }, data: { deadlineAt: new Date(Date.now() - 60_000) } });
    await app.get(MocksService).finalise();

    const a = await http().get(`/me/student/mocks/sittings/${sitting}/result`).set(auth(ade.token)).expect(200);
    expect(a.body).toMatchObject({ score: 200, nationalRank: 1, percentile: 100, sat: 2, resultsOut: true });
    const english = a.body.review.find((r: { subjectId: string }) => r.subjectId === subject['english-language']);
    expect(english.questions[0]).toMatchObject({ answerId: 'a', explanation: expect.stringMatching(/^Because/) });

    const b = await http().get(`/me/student/mocks/sittings/${s2}/result`).set(auth(bisi.token)).expect(200);
    expect(b.body).toMatchObject({ score: 33, nationalRank: 2, percentile: 0 }); // 1/3 English = 33, the rest 0

    const view = await http().get('/me/student/mocks').set(auth(ade.token)).expect(200);
    expect(view.body.past[0]).toMatchObject({ sittingId: sitting, score: 200, nationalRank: 1, sat: 2 });
  });

  it('the parent sees each child’s card and a progress page built from what they did', async () => {
    const cards = await http().get('/parent/progress').set(auth(parent)).expect(200);
    const card = cards.body.find((c: { studentId: string }) => c.studentId === ade.id);
    expect(card.lastMock).toMatchObject({ score: 200, outOf: 400, rank: 1, sat: 2 });
    expect(card.week).toMatchObject({ questions: 12, correct: 6, activeDays: 1 });
    expect(card.streak).toBe(1);
    expect(card.exams).toEqual([{ exam: 'JAMB', label: 'JAMB', targetYear: null }]);

    const detail = await http().get(`/parent/children/${ade.id}/progress`).set(auth(parent)).expect(200);
    expect(detail.body.subjects.map((s: { name: string }) => s.name).sort()).toEqual(['Chemistry', 'Mathematics', 'Physics', 'Use of English']);
    expect(detail.body.mocks[0].subjects.find((s: { name: string }) => s.name === 'Physics')).toMatchObject({ correct: 1, total: 3, score: 33 });

    const stranger = (await http().post('/auth/register').send({ firstName: 'No', lastName: 'One', email: `stranger.${stamp}@test.ng`, password: 'password-123', role: 'PARENT' }).expect(201)).body.accessToken;
    await http().get(`/parent/children/${ade.id}/progress`).set(auth(stranger)).expect(404);
    expect((await http().get('/parent/progress').set(auth(stranger)).expect(200)).body).toEqual([]);
  });
});
