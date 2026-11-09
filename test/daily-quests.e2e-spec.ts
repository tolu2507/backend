/**
 * Daily quests: fresh questions from the bank each day, through the real HTTP API on nexus_test.
 * The test writes its own questions and accounts and deletes them afterwards.
 *
 *   pnpm test:e2e test/daily-quests.e2e-spec.ts
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { configureApp } from '../src/app.factory.js';
import { AppModule } from '../src/app.module.js';

const prisma = new PrismaClient();
let app: INestApplication;
const http = () => request(app.getHttpServer());
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const stamp = Date.now().toString(36);

let physicsId = '';
let topicId = '';
let kid = '';
let kidId = '';

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(mod.createNestApplication());
  await app.init();

  physicsId = (await prisma.examSubject.findUniqueOrThrow({ where: { exam_slug: { exam: 'JAMB', slug: 'physics' } } })).id;
  topicId = (await prisma.syllabusTopic.create({ data: { examSubjectId: physicsId, name: `Daily ${stamp}`, weight: 0.1 } })).id;
  await prisma.examQuestion.createMany({
    data: Array.from({ length: 12 }, (_, i) => ({
      examSubjectId: physicsId,
      topicId,
      difficulty: 2,
      stem: `Daily ${stamp}: a body moves ${i + 2} m in 1 s. What is its speed?\n\n🔊 spoken only`,
      options: [
        { id: 'a', label: `${i + 2} m/s` },
        { id: 'b', label: `${i + 3} m/s` },
        { id: 'c', label: `${i + 4} m/s` },
        { id: 'd', label: `${i + 5} m/s` },
      ],
      answerId: 'a',
      explanation: 'Speed is distance over time.',
      origin: 'AUTHORED' as const,
      status: 'APPROVED' as const,
    })),
  });

  const parent = (await http().post('/auth/register').send({ firstName: 'Ada', lastName: 'Eze', email: `daily.${stamp}@test.ng`, password: 'password-123', role: 'PARENT' }).expect(201)).body.accessToken;
  const username = `dq${stamp}`.slice(0, 20);
  const child = await http()
    .post('/parent/children')
    .set(auth(parent))
    .send({ firstName: 'Tobi', lastName: 'Eze', level: 'SENIOR_SECONDARY', gradeName: 'SS3', username, pin: '4821', consentDataProcessing: true, consentAiReports: true })
    .expect(201);
  kidId = child.body.id;
  const catalog = (await http().get('/exams').expect(200)).body.find((e: { exam: string }) => e.exam === 'JAMB');
  const pick = ['english-language', 'physics', 'chemistry', 'mathematics'].map((slug) => catalog.subjects.find((s: { slug: string }) => s.slug === slug).id);
  await http().put(`/parent/children/${kidId}/exams/JAMB`).set(auth(parent)).send({ subjectIds: pick }).expect(200);
  kid = (await http().post('/auth/student-login').send({ username, pin: '4821' }).expect(200)).body.accessToken;
});

afterAll(async () => {
  await prisma.examQuestion.deleteMany({ where: { topicId } }); // seen rows cascade
  await prisma.syllabusTopic.deleteMany({ where: { id: topicId } });
  const users = await prisma.user.findMany({ where: { OR: [{ email: `daily.${stamp}@test.ng` }, { username: `dq${stamp}`.slice(0, 20) }] }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app?.close();
  await prisma.$disconnect();
});

describe('Daily quests', () => {
  let firstIds: string[] = [];

  it('home shows a daily quest built from the bank, and it holds for the day', async () => {
    const home = await http().get('/me/student/home').set(auth(kid)).expect(200);
    const quest = home.body.quests.find((q: { id: string }) => q.id === `daily-${physicsId}`);
    expect(quest).toMatchObject({ kind: 'ACTIVITY', progress: 0, xpReward: 25 });
    expect(home.body.adventure.activityId).toBe(`daily-${physicsId}`);

    const a = await http().get(`/me/student/activities/daily-${physicsId}`).set(auth(kid)).expect(200);
    expect(a.body.questions).toHaveLength(5);
    expect(a.body.questions[0].answerId).toBeUndefined();
    expect(a.body.questions[0].prompt).not.toContain('🔊');
    firstIds = a.body.questions.map((q: { id: string }) => q.id);

    const again = await http().get(`/me/student/activities/daily-${physicsId}`).set(auth(kid)).expect(200);
    expect(again.body.questions.map((q: { id: string }) => q.id)).toEqual(firstIds);
  });

  it('finishing it gives XP once a day and marks it done', async () => {
    const answers = Object.fromEntries(firstIds.map((id) => [id, 'a']));
    const done = await http().post(`/me/student/activities/daily-${physicsId}/submit`).set(auth(kid)).send({ answers }).expect(200);
    expect(done.body).toMatchObject({ correct: 5, total: 5, xpEarned: 25 });
    const replay = await http().post(`/me/student/activities/daily-${physicsId}/submit`).set(auth(kid)).send({ answers }).expect(200);
    expect(replay.body.xpEarned).toBe(0);

    const home = await http().get('/me/student/home').set(auth(kid)).expect(200);
    expect(home.body.quests.find((q: { id: string }) => q.id === `daily-${physicsId}`).progress).toBe(1);
  });

  it('the next day brings different questions', async () => {
    const student = await prisma.studentProfile.findUniqueOrThrow({ where: { id: kidId } });
    // Pretend today's questions were seen yesterday.
    await prisma.questionSeen.updateMany({ where: { studentId: student.id, questionId: { in: firstIds } }, data: { firstSeenAt: new Date(Date.now() - 2 * 86_400_000) } });
    const next = await http().get(`/me/student/activities/daily-${physicsId}`).set(auth(kid)).expect(200);
    const nextIds = next.body.questions.map((q: { id: string }) => q.id);
    expect(nextIds).toHaveLength(5);
    expect(nextIds.filter((id: string) => firstIds.includes(id))).toEqual([]);
  });

  it('a subject the child did not pick is refused', async () => {
    const bio = await prisma.examSubject.findUniqueOrThrow({ where: { exam_slug: { exam: 'JAMB', slug: 'biology' } } });
    await http().get(`/me/student/activities/daily-${bio.id}`).set(auth(kid)).expect(404);
  });
});
