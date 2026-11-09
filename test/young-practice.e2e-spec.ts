/**
 * Primary practice on a small, all-easy subtopic: the climb must not stall at level 4 or the boss,
 * and once everything has been seen, questions come back the next day and count.
 * Real HTTP API on nexus_test; the test writes its own topic, questions and accounts and deletes them.
 *
 *   pnpm test:e2e test/young-practice.e2e-spec.ts
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

let subjectId = '';
let topicId = '';
let kid = '';
let studentId = '';

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(mod.createNestApplication());
  await app.init();

  const catalog = (await http().get('/exams').expect(200)).body.find((e: { exam: string }) => e.exam === 'PRIMARY');
  subjectId = catalog.subjects.find((s: { name: string }) => s.name === 'Mathematics (Primary 5)').id;
  topicId = (await prisma.syllabusTopic.create({ data: { examSubjectId: subjectId, name: `Tiny ${stamp}`, weight: 99 } })).id;
  // Only four questions, all difficulty 1: like many young-class subtopics.
  await prisma.examQuestion.createMany({
    data: Array.from({ length: 4 }, (_, i) => ({
      examSubjectId: subjectId,
      topicId,
      difficulty: 1,
      stem: `Tiny ${stamp}: what is ${i + 1} + 1?`,
      options: [
        { id: 'a', label: `${i + 2}` },
        { id: 'b', label: `${i + 3}` },
        { id: 'c', label: `${i + 4}` },
        { id: 'd', label: `${i + 5}` },
      ],
      answerId: 'a',
      explanation: 'Count on by one.',
      origin: 'AUTHORED' as const,
      status: 'APPROVED' as const,
    })),
  });

  const parent = (await http().post('/auth/register').send({ firstName: 'Ada', lastName: 'Eze', email: `young.${stamp}@test.ng`, password: 'password-123', role: 'PARENT' }).expect(201)).body.accessToken;
  const username = `yp${stamp}`.slice(0, 20);
  const child = await http()
    .post('/parent/children')
    .set(auth(parent))
    .send({ firstName: 'Kunle', lastName: 'Eze', level: 'PRIMARY', gradeName: 'Primary 5', username, pin: '4821', consentDataProcessing: true, consentAiReports: true })
    .expect(201);
  studentId = child.body.id;
  await http().put(`/parent/children/${studentId}/exams/PRIMARY`).set(auth(parent)).send({ subjectIds: [subjectId] }).expect(200);
  kid = (await http().post('/auth/student-login').send({ username, pin: '4821' }).expect(200)).body.accessToken;
});

afterAll(async () => {
  await prisma.examQuestion.deleteMany({ where: { topicId } });
  await prisma.topicProgress.deleteMany({ where: { topicId } });
  await prisma.syllabusTopic.deleteMany({ where: { id: topicId } });
  const users = await prisma.user.findMany({ where: { OR: [{ email: `young.${stamp}@test.ng` }, { username: `yp${stamp}`.slice(0, 20) }] }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app?.close();
  await prisma.$disconnect();
});

const playAllRight = async () => {
  const round = await http().post('/me/student/practice/rounds').set(auth(kid)).send({ topicId }).expect(200);
  const answers = Object.fromEntries(round.body.questions.map((q: { id: string; prompt: string }) => [q.id, 'a']));
  const result = await http().post('/me/student/practice/rounds/submit').set(auth(kid)).send({ topicId, answers }).expect(200);
  return { round: round.body, result: result.body };
};

const ageSeen = () =>
  prisma.questionSeen.updateMany({ where: { studentId, question: { topicId } }, data: { lastSeenAt: new Date(Date.now() - 2 * 86_400_000) } });

describe('Primary practice on a tiny, easy subtopic', () => {
  it('at level 4 a round still finds the easy questions, and four right is enough to level up', async () => {
    await prisma.topicProgress.create({ data: { studentId, topicId, level: 4, mastery: 0.5, answered: 10, correct: 8 } });
    const { round, result } = await playAllRight();
    expect(round.questions).toHaveLength(4);
    expect(result.correct ?? 4).toBe(4);
    expect((await prisma.topicProgress.findFirstOrThrow({ where: { studentId, topicId } })).level).toBe(5);
  });

  it('with everything seen, the stage says play again tomorrow, then the questions come back and the boss can be beaten', async () => {
    await http().post('/me/student/practice/rounds').set(auth(kid)).send({ topicId }).expect(400);
    await ageSeen();
    const { round } = await playAllRight();
    expect(round.boss).toBe(true);
    expect(round.questions).toHaveLength(4);
    expect((await prisma.topicProgress.findFirstOrThrow({ where: { studentId, topicId } })).bossBeaten).toBe(true);
  });
});
