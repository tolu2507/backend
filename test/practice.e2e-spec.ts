/**
 * Topic practice and the Overwatch question bank, through the real HTTP API on nexus_test.
 * The test writes its own small syllabus and questions and deletes them afterwards.
 *
 *   pnpm test:e2e test/practice.e2e-spec.ts
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
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
let first = ''; // subtopic 1
let second = ''; // subtopic 2

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(mod.createNestApplication());
  await app.init(); // syncs ExamSubject from the catalog

  physicsId = (await prisma.examSubject.findUniqueOrThrow({ where: { exam_slug: { exam: 'JAMB', slug: 'physics' } } })).id;
  const topic = await prisma.syllabusTopic.create({ data: { examSubjectId: physicsId, name: `Mechanics ${stamp}`, weight: 0.2, yearsSeen: 4 } });
  topicId = topic.id;
  first = (await prisma.syllabusTopic.create({ data: { examSubjectId: physicsId, parentId: topic.id, name: 'Motion', order: 0 } })).id;
  second = (await prisma.syllabusTopic.create({ data: { examSubjectId: physicsId, parentId: topic.id, name: 'Forces', order: 1 } })).id;

  // 12 easy and 3 level-2 questions on Motion, 2 on Forces. All waiting for review.
  const make = (topic: string, difficulty: number, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      examSubjectId: physicsId,
      topicId: topic,
      difficulty,
      stem: `Test ${stamp}: a car travels ${i + 2} m in 1 s. What is its speed?`,
      options: [
        { id: 'a', label: `${i + 2} m/s` },
        { id: 'b', label: `${i + 3} m/s` },
        { id: 'c', label: `${i + 4} m/s` },
        { id: 'd', label: `${i + 5} m/s` },
      ],
      answerId: 'a',
      explanation: 'Speed is distance over time.',
      origin: 'AUTHORED' as const,
      status: 'IN_REVIEW' as const,
    }));
  await prisma.examQuestion.createMany({ data: [...make(first, 1, 12), ...make(first, 2, 3), ...make(second, 1, 2)] });
});

afterAll(async () => {
  await prisma.examQuestion.deleteMany({ where: { topicId: { in: [first, second] } } }); // seen rows and reports cascade
  await prisma.questionTemplate.deleteMany({ where: { topicId: { in: [first, second] } } });
  await prisma.syllabusTopic.deleteMany({ where: { id: topicId } });
  // The accounts this run made: Overwatch admin, parent and child.
  const users = await prisma.user.findMany({ where: { OR: [{ email: { endsWith: `${stamp}@test.ng` } }, { username: `tobi${stamp}`.slice(0, 20) }] }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app?.close();
  await prisma.$disconnect();
});

describe('Topic practice', () => {
  let admin = '';
  let kid = '';
  let wrongId = '';

  it('Overwatch sees the questions waiting and approves them', async () => {
    const email = `overwatch.${stamp}@test.ng`;
    await prisma.user.create({ data: { email, firstName: 'Over', lastName: 'Watch', passwordHash: await bcrypt.hash('password-123', 4), memberships: { create: { role: 'PLATFORM_ADMIN' } } } });
    admin = (await http().post('/auth/login').send({ identifier: email, password: 'password-123' }).expect(200)).body.accessToken;

    const summary = await http().get('/admin/question-bank').set(auth(admin)).expect(200);
    const row = summary.body.subjects.find((s: { id: string }) => s.id === physicsId);
    expect(row.questions.IN_REVIEW).toBeGreaterThanOrEqual(17);

    const tree = await http().get(`/admin/question-bank/subjects/${physicsId}/topics`).set(auth(admin)).expect(200);
    expect(tree.body.find((t: { id: string }) => t.id === topicId).subtopics.map((s: { name: string }) => s.name)).toEqual(['Motion', 'Forces']);

    const page1 = await http().get(`/admin/question-bank/questions?topicId=${topicId}&status=IN_REVIEW&pageSize=10`).set(auth(admin)).expect(200);
    expect(page1.body.total).toBe(17);
    expect(page1.body.items).toHaveLength(10);
    expect(page1.body.items[0].topic).toBe(`Mechanics ${stamp} › ${page1.body.items[0].topicId === first ? 'Motion' : 'Forces'}`);
    const page2 = await http().get(`/admin/question-bank/questions?topicId=${topicId}&status=IN_REVIEW&pageSize=10&page=2`).set(auth(admin)).expect(200);
    expect(page2.body.items).toHaveLength(7);

    const ids = [...page1.body.items, ...page2.body.items].map((q: { id: string }) => q.id);
    await http().post('/admin/question-bank/questions/status').set(auth(admin)).send({ ids, status: 'APPROVED' }).expect(200);
    const approved = await http().get(`/admin/question-bank/questions?topicId=${topicId}&status=APPROVED`).set(auth(admin)).expect(200);
    expect(approved.body.total).toBe(17);
    expect(approved.body.items[0].reviewedBy).toBe('Over Watch');
  });

  it('a student who picked JAMB Physics sees the map; the second subtopic starts locked', async () => {
    const parent = (await http().post('/auth/register').send({ firstName: 'Ada', lastName: 'Eze', email: `ada.${stamp}@test.ng`, password: 'password-123', role: 'PARENT' }).expect(201)).body.accessToken;
    const username = `tobi${stamp}`.slice(0, 20);
    const child = await http()
      .post('/parent/children')
      .set(auth(parent))
      .send({ firstName: 'Tobi', lastName: 'Eze', level: 'SENIOR_SECONDARY', gradeName: 'SS3', username, pin: '4821', consentDataProcessing: true, consentAiReports: true })
      .expect(201);
    kid = (await http().post('/auth/student-login').send({ username, pin: '4821' }).expect(200)).body.accessToken;

    await http().get(`/me/student/practice/subjects/${physicsId}`).set(auth(kid)).expect(404); // not picked yet

    const catalog = (await http().get('/exams').expect(200)).body.find((e: { exam: string }) => e.exam === 'JAMB');
    const pick = ['english-language', 'physics', 'chemistry', 'mathematics'].map((slug) => catalog.subjects.find((s: { slug: string }) => s.slug === slug).id);
    await http().put(`/parent/children/${child.body.id}/exams/JAMB`).set(auth(parent)).send({ subjectIds: pick }).expect(200);

    const map = await http().get(`/me/student/practice/subjects/${physicsId}`).set(auth(kid)).expect(200);
    const mech = map.body.topics.find((t: { id: string }) => t.id === topicId);
    expect(mech.hot).toBe(true);
    expect(mech.subtopics.map((s: { name: string; unlocked: boolean; fresh: number }) => [s.name, s.unlocked, s.fresh])).toEqual([
      ['Motion', true, 15],
      ['Forces', false, 2],
    ]);
    await http().post('/me/student/practice/rounds').set(auth(kid)).send({ topicId: second }).expect(400);

    const worlds = await http().get('/me/student/practice/worlds').set(auth(kid)).expect(200);
    expect(worlds.body.map((w: { slug: string }) => w.slug).sort()).toEqual(['chemistry', 'english-language', 'mathematics', 'physics']);
    expect(worlds.body.find((w: { id: string }) => w.id === physicsId)).toMatchObject({ exam: 'JAMB', name: map.body.subject.name, leaves: map.body.leaves, conquered: 0, mastery: 0, ready: true });
  });

  it('a round serves 10 easy questions without answers; 9 right levels them up and opens the next subtopic', async () => {
    const round = await http().post('/me/student/practice/rounds').set(auth(kid)).send({ topicId: first }).expect(200);
    expect(round.body.level).toBe(1);
    expect(round.body.questions).toHaveLength(10);
    expect(round.body.questions.every((q: { difficulty: number; answerId?: string }) => q.difficulty === 1 && q.answerId === undefined)).toBe(true);

    const answers: Record<string, string> = Object.fromEntries(round.body.questions.map((q: { id: string }) => [q.id, 'a']));
    wrongId = round.body.questions[0].id;
    answers[wrongId] = 'b';
    const done = await http().post('/me/student/practice/rounds/submit').set(auth(kid)).send({ topicId: first, answers }).expect(200);
    expect(done.body).toMatchObject({ counted: 10, correct: 9, levelBefore: 1, levelAfter: 2, xpEarned: 9 * 5 + 25 });
    expect(done.body.results.find((r: { questionId: string }) => r.questionId === wrongId)).toMatchObject({ correct: false, answerId: 'a', explanation: 'Speed is distance over time.' });

    const again = await http().post('/me/student/practice/rounds/submit').set(auth(kid)).send({ topicId: first, answers }).expect(200);
    expect(again.body).toMatchObject({ counted: 0, xpEarned: 0, levelAfter: 2 }); // replaying can't farm XP

    const map = await http().get(`/me/student/practice/subjects/${physicsId}`).set(auth(kid)).expect(200);
    const [motion, forces] = map.body.topics.find((t: { id: string }) => t.id === topicId).subtopics;
    expect([motion.level, motion.fresh, forces.unlocked]).toEqual([2, 5, true]);
  });

  it('never repeats a question, except a wrong one that comes back as a review', async () => {
    await prisma.questionSeen.updateMany({ where: { questionId: wrongId }, data: { reviewDueAt: new Date(Date.now() - 1000) } }); // as if two days passed

    const round = await http().post('/me/student/practice/rounds').set(auth(kid)).send({ topicId: first }).expect(200);
    expect(round.body.level).toBe(2);
    const reviews = round.body.questions.filter((q: { review: boolean }) => q.review);
    expect(reviews.map((q: { id: string }) => q.id)).toEqual([wrongId]);
    expect(round.body.questions).toHaveLength(6); // 1 review + the 5 it hasn't had (3 level-2, 2 easy)

    const answers = Object.fromEntries(round.body.questions.map((q: { id: string }) => [q.id, 'a']));
    const done = await http().post('/me/student/practice/rounds/submit').set(auth(kid)).send({ topicId: first, answers }).expect(200);
    expect(done.body).toMatchObject({ counted: 6, correct: 6, levelAfter: 3, xpEarned: 5 * 5 + 3 + 25 });

    const res = await http().post('/me/student/practice/rounds').set(auth(kid)).send({ topicId: first }).expect(400);
    expect(res.body.message).toMatch(/every question we have/);
  });

  it('a student reports a question; Overwatch fixes it and the report closes', async () => {
    await http().post(`/me/student/practice/questions/${wrongId}/report`).set(auth(kid)).send({ reason: 'typo', note: 'missing unit' }).expect(200);
    const reported = await http().get(`/admin/question-bank/questions?reported=true&subjectId=${physicsId}`).set(auth(admin)).expect(200);
    expect(reported.body.items.map((q: { id: string }) => q.id)).toEqual([wrongId]);
    expect(reported.body.items[0].reports[0]).toMatchObject({ reason: 'typo', note: 'missing unit' });

    await http().patch(`/admin/question-bank/questions/${wrongId}`).set(auth(admin)).send({ answerId: 'z' }).expect(400);
    await http().patch(`/admin/question-bank/questions/${wrongId}`).set(auth(admin)).send({ topicId: second, difficulty: 2 }).expect(200);
    const after = await http().get(`/admin/question-bank/questions?reported=true&subjectId=${physicsId}`).set(auth(admin)).expect(200);
    expect(after.body.total).toBe(0);
  });

  it('approving a template approves its questions, but not ones retired on their own', async () => {
    const t = await prisma.questionTemplate.create({ data: { examSubjectId: physicsId, topicId: second, difficulty: 2, spec: { key: `test/${stamp}` }, status: 'IN_REVIEW' } });
    const make = (i: number, status: 'IN_REVIEW' | 'RETIRED') => ({ examSubjectId: physicsId, topicId: second, difficulty: 2, stem: `Template ${stamp} ${i}`, options: [{ id: 'a', label: '1' }, { id: 'b', label: '2' }], answerId: 'a', explanation: 'Worked out.', origin: 'TEMPLATE' as const, status, templateId: t.id });
    await prisma.examQuestion.createMany({ data: [make(1, 'IN_REVIEW'), make(2, 'IN_REVIEW'), make(3, 'RETIRED')] });

    const list = await http().get(`/admin/question-bank/questions?q=Template ${stamp}&status=IN_REVIEW`).set(auth(admin)).expect(200);
    expect(list.body.items[0].template).toMatchObject({ id: t.id, key: `test/${stamp}`, status: 'IN_REVIEW', questions: 3 });

    const res = await http().post(`/admin/question-bank/templates/${t.id}/status`).set(auth(admin)).send({ status: 'APPROVED' }).expect(200);
    expect(res.body.updated).toBe(2);
    const rows = await prisma.examQuestion.findMany({ where: { templateId: t.id }, orderBy: { stem: 'asc' }, select: { status: true } });
    expect(rows.map((q) => q.status)).toEqual(['APPROVED', 'APPROVED', 'RETIRED']);
    expect((await prisma.questionTemplate.findUniqueOrThrow({ where: { id: t.id } })).status).toBe('APPROVED');
  });

  it('retired questions are never served, and students can’t reach Overwatch', async () => {
    const forces = await prisma.examQuestion.findMany({ where: { topicId: second }, select: { id: true } });
    await http().post('/admin/question-bank/questions/status').set(auth(admin)).send({ ids: forces.map((q) => q.id), status: 'RETIRED' }).expect(200);
    const res = await http().post('/me/student/practice/rounds').set(auth(kid)).send({ topicId: second }).expect(400);
    expect(res.body.message).toMatch(/still writing/);

    await http().get('/admin/question-bank').set(auth(kid)).expect(403);
  });
});
