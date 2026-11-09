/**
 * University students: sign up, pick department and courses, take a classroom lesson, practise,
 * and Overwatch approving lessons. Real HTTP API on nexus_test. Writes its own lesson and questions
 * (no AI) and deletes everything it makes.
 *
 *   pnpm test:e2e test/university.e2e-spec.ts
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
const email = `tobi.${stamp}@uni.test.ng`;
const adminEmail = `ow.uni.${stamp}@test.ng`;

let courseId = '';
let unitId = '';
let sectionId = '';
let section2Id = '';
let lessonId = '';
let reviewLessonId = '';
let token = '';

const slides = [
  { kind: 'teach', heading: 'Three stores', body: 'Memory has **three** stores.', visual: { type: 'flow', nodes: ['Sensory', 'Short-term', 'Long-term'] } },
  { kind: 'check', question: 'How many stores?', options: ['One', 'Two', 'Three', 'Four'], answerIndex: 2, why: 'Sensory, short-term and long-term.' },
  { kind: 'check', question: 'Which comes first?', options: ['Sensory', 'Short-term', 'Long-term', 'None'], answerIndex: 0, why: 'Everything enters through the senses.' },
  { kind: 'recap', points: ['Three stores', 'Sensory first'] },
];

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(mod.createNestApplication());
  await app.init();

  courseId = (await prisma.examSubject.findUniqueOrThrow({ where: { exam_slug: { exam: 'UNIVERSITY', slug: 'psy-316' } } })).id;
  unitId = (await prisma.syllabusTopic.create({ data: { examSubjectId: courseId, name: `Memory systems ${stamp}`, order: 900, examinerNotes: 'How memory is organised.' } })).id;
  sectionId = (await prisma.syllabusTopic.create({ data: { examSubjectId: courseId, parentId: unitId, name: 'The three stores', order: 0 } })).id;
  section2Id = (await prisma.syllabusTopic.create({ data: { examSubjectId: courseId, parentId: unitId, name: 'Capacity', order: 1 } })).id;
  lessonId = (await prisma.courseLesson.create({ data: { topicId: sectionId, title: 'Three stores of memory', minutes: 6, hook: 'Why do you forget a number seconds after hearing it?', slides, status: 'APPROVED' } })).id;
  reviewLessonId = (await prisma.courseLesson.create({ data: { topicId: section2Id, title: 'How much fits', minutes: 6, hook: 'Seven, give or take two.', slides, status: 'IN_REVIEW' } })).id;
  await prisma.examQuestion.createMany({
    data: Array.from({ length: 8 }, (_, i) => ({
      examSubjectId: courseId,
      topicId: sectionId,
      difficulty: 1,
      stem: `Uni ${stamp}: which store holds item ${i}?`,
      options: [
        { id: 'a', label: 'Short-term' },
        { id: 'b', label: 'Long-term' },
        { id: 'c', label: 'Sensory' },
        { id: 'd', label: 'None' },
      ],
      answerId: 'a',
      explanation: 'It is being held for a few seconds.',
      origin: 'AUTHORED' as const,
      status: 'APPROVED' as const,
    })),
  });
  await prisma.examQuestion.create({
    data: { examSubjectId: courseId, topicId: section2Id, difficulty: 2, stem: `Uni ${stamp}: capacity?`, options: [{ id: 'a', label: '7±2' }, { id: 'b', label: '100' }], answerId: 'a', explanation: 'Miller (1956).', origin: 'AUTHORED', status: 'IN_REVIEW' },
  });
});

afterAll(async () => {
  await prisma.examQuestion.deleteMany({ where: { topicId: { in: [sectionId, section2Id] } } });
  await prisma.syllabusTopic.deleteMany({ where: { id: unitId } }); // sections, lessons and progress go with it
  const users = await prisma.user.findMany({ where: { email: { in: [email, adminEmail] } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app?.close();
  await prisma.$disconnect();
});

describe('signing up', () => {
  it('a university student signs up for themselves and lands on the university side', async () => {
    const res = await http().post('/auth/register').send({ firstName: 'Tobi', lastName: 'Ade', email, password: 'password-123', role: 'UNI_STUDENT' }).expect(201);
    token = res.body.accessToken;
    expect(res.body.user.studentLevel).toBe('TERTIARY');
    expect(res.body.user.memberships.map((m: { role: string }) => m.role)).toEqual(['STUDENT']);
  });

  it('parents never see the university level when adding a child', async () => {
    const catalog = await http().get('/catalog').expect(200);
    expect(catalog.body.levels.map((l: { level: string }) => l.level)).not.toContain('TERTIARY');
  });

  it('lists Psychology 300 Level second semester with its six courses', async () => {
    const res = await http().get('/university/departments').expect(200);
    const psy = res.body.find((d: { slug: string }) => d.slug === 'psychology');
    expect(psy.semesters[0]).toMatchObject({ level: 300, semester: 2 });
    expect(psy.semesters[0].courses.map((c: { code: string }) => c.code)).toEqual(['POS 314', 'PSY 310', 'PSY 316', 'PSY 318', 'PSY 387', 'SOC 314']);
  });

  it('has no courses until they set up their semester', async () => {
    const me = await http().get('/me/university').set(auth(token)).expect(200);
    expect(me.body).toMatchObject({ department: null, courses: [], continue: null });
  });

  it('refuses courses from outside the semester', async () => {
    const jamb = await prisma.examSubject.findUniqueOrThrow({ where: { exam_slug: { exam: 'JAMB', slug: 'physics' } } });
    await http().put('/me/university').set(auth(token)).send({ department: 'psychology', level: 300, semester: 2, courseIds: [jamb.id] }).expect(400);
    await http().put('/me/university').set(auth(token)).send({ department: 'law', level: 300, semester: 2, courseIds: [courseId] }).expect(400);
  });

  it('saves the department and courses', async () => {
    const me = await http().put('/me/university').set(auth(token)).send({ department: 'psychology', level: 300, semester: 2, courseIds: [courseId] }).expect(200);
    expect(me.body.department).toMatchObject({ slug: 'psychology', name: 'Psychology' });
    expect(me.body.level).toBe('300 Level · Second semester');
    expect(me.body.courses).toHaveLength(1);
    expect(me.body.courses[0]).toMatchObject({ code: 'PSY 316', title: 'Human Memory', lessonsDone: 0 });
    expect(me.body.courses[0].lessons).toBeGreaterThanOrEqual(1);
    expect(me.body.continue).toMatchObject({ courseCode: 'PSY 316' });
  });
});

describe('the classroom', () => {
  it('the course page shows units with their lessons; lessons waiting review stay hidden', async () => {
    const res = await http().get(`/me/university/courses/${courseId}`).set(auth(token)).expect(200);
    const unit = res.body.units.find((u: { id: string }) => u.id === unitId);
    expect(unit.summary).toBe('How memory is organised.');
    expect(unit.sections[0]).toMatchObject({ name: 'The three stores', lesson: { id: lessonId, done: false, slide: 0 }, practice: { level: 1, unlocked: true, fresh: 8 } });
    expect(unit.sections[1].lesson).toBeNull();
    await http().get(`/me/university/lessons/${reviewLessonId}`).set(auth(token)).expect(404);
  });

  it('a lesson comes with its slides', async () => {
    const res = await http().get(`/me/university/lessons/${lessonId}`).set(auth(token)).expect(200);
    expect(res.body).toMatchObject({ title: 'Three stores of memory', course: { code: 'PSY 316' }, section: { id: sectionId }, progress: { slide: 0, done: false } });
    expect(res.body.slides).toHaveLength(4);
  });

  it('saves how far they got, and "continue" points back to it', async () => {
    const res = await http().post(`/me/university/lessons/${lessonId}/progress`).set(auth(token)).send({ slide: 2, checksRight: 1, checksTotal: 1, completed: false }).expect(200);
    expect(res.body.xpEarned).toBe(0);
    const me = await http().get('/me/university').set(auth(token)).expect(200);
    expect(me.body.continue).toMatchObject({ lessonId, slide: 2 });
  });

  it('finishing gives XP once, with a little more per quick check right', async () => {
    const first = await http().post(`/me/university/lessons/${lessonId}/progress`).set(auth(token)).send({ slide: 4, checksRight: 2, checksTotal: 2, completed: true }).expect(200);
    expect(first.body.xpEarned).toBe(24);
    const again = await http().post(`/me/university/lessons/${lessonId}/progress`).set(auth(token)).send({ slide: 4, checksRight: 2, checksTotal: 2, completed: true }).expect(200);
    expect(again.body.xpEarned).toBe(0);
    const me = await http().get('/me/university').set(auth(token)).expect(200);
    expect(me.body.courses[0].lessonsDone).toBe(1);
    expect(me.body.xp).toBe(24);
  });

  it('claims can’t go past what the lesson has', async () => {
    await http().post(`/me/university/lessons/${lessonId}/progress`).set(auth(token)).send({ slide: 4, checksRight: 50, checksTotal: 50, completed: true }).expect(200);
    const row = await prisma.lessonProgress.findFirstOrThrow({ where: { lessonId } });
    expect(row.checksTotal).toBeLessThanOrEqual(2);
  });
});

describe('practice', () => {
  it('uses the same rounds as exam practice, with explanations after', async () => {
    const round = await http().post('/me/student/practice/rounds').set(auth(token)).send({ topicId: sectionId }).expect(200);
    expect(round.body.questions.length).toBeGreaterThanOrEqual(5);
    expect(round.body.questions[0].answerId).toBeUndefined();
    const answers = Object.fromEntries(round.body.questions.map((q: { id: string }) => [q.id, 'a']));
    const res = await http().post('/me/student/practice/rounds/submit').set(auth(token)).send({ topicId: sectionId, answers }).expect(200);
    expect(res.body).toMatchObject({ score: 1, levelBefore: 1, levelAfter: 2 });
    expect(res.body.results[0].explanation).toBe('It is being held for a few seconds.');
  });

  it('a school child can’t use the university endpoints', async () => {
    await http().get('/me/university').expect(401);
  });
});

describe('Overwatch', () => {
  let admin = '';
  it('sees every course and approves a lesson with its questions', async () => {
    await prisma.user.create({ data: { email: adminEmail, firstName: 'Over', lastName: 'Watch', passwordHash: await bcrypt.hash('password-123', 4), memberships: { create: { role: 'PLATFORM_ADMIN' } } } });
    admin = (await http().post('/auth/login').send({ identifier: adminEmail, password: 'password-123' }).expect(200)).body.accessToken;
    await http().get('/admin/university').set(auth(token)).expect(403);

    const overview = await http().get('/admin/university').set(auth(admin)).expect(200);
    const psy = overview.body.find((c: { code: string }) => c.code === 'PSY 316');
    const unit = psy.units.find((u: { id: string }) => u.id === unitId);
    expect(unit.sections[1]).toMatchObject({ lesson: { id: reviewLessonId, status: 'IN_REVIEW', slides: 4 }, questions: { IN_REVIEW: 1 } });

    const detail = await http().get(`/admin/university/lessons/${reviewLessonId}`).set(auth(admin)).expect(200);
    expect(detail.body).toMatchObject({ course: 'PSY 316', section: 'Capacity' });

    const res = await http().post('/admin/university/lessons/status').set(auth(admin)).send({ ids: [reviewLessonId], status: 'APPROVED', withQuestions: true }).expect(200);
    expect(res.body).toEqual({ lessons: 1, questions: 1 });
    await http().get(`/me/university/lessons/${reviewLessonId}`).set(auth(token)).expect(200);
  });

  it('the first lesson now points to the second as "next"', async () => {
    const res = await http().get(`/me/university/lessons/${lessonId}`).set(auth(token)).expect(200);
    expect(res.body.next).toEqual({ id: reviewLessonId, title: 'How much fits' });
  });
});
