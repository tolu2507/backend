/**
 * The parent plan: 21-day trial, ₦1,500 for 30 days, and what pauses when it ends. Real HTTP API on nexus_test;
 * only Squad is replaced. Deletes the accounts, payments and ledger rows it makes.
 *
 *   pnpm test:e2e test/plan.e2e-spec.ts
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { vi } from 'vitest';

import { configureApp } from '../src/app.factory.js';
import { AppModule } from '../src/app.module.js';
import { MessagingService } from '../src/messaging/messaging.service.js';
import { SquadService } from '../src/payments/squad.service.js';
import { PlanService } from '../src/plan/plan.service.js';

const prisma = new PrismaClient();
const squad = {
  initiate: async () => 'https://sandbox-pay.squadco.com/fake-checkout',
  verify: async () => ({ success: true, status: 'success', raw: { test: true } }),
  isValidSignature: () => false,
};

let app: INestApplication;
const http = () => request(app.getHttpServer());
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const stamp = Date.now().toString(36);
const DAY = 86_400_000;
const near = (iso: string, ms: number) => expect(Math.abs(new Date(iso).getTime() - ms)).toBeLessThan(60_000);

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SquadService).useValue(squad).compile();
  app = configureApp(mod.createNestApplication({ rawBody: true }));
  await app.init();
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { OR: [{ email: { endsWith: `${stamp}@test.ng` } }, { username: { startsWith: `pl${stamp}` } }] }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const payments = await prisma.payment.findMany({ where: { payerId: { in: ids } }, select: { id: true } });
  const entries = await prisma.ledgerEntry.findMany({ where: { paymentId: { in: payments.map((p) => p.id) } } });
  for (const e of entries) await prisma.wallet.update({ where: { id: e.walletId }, data: { balanceKobo: { decrement: e.amountKobo } } });
  await prisma.ledgerEntry.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
  await prisma.payment.deleteMany({ where: { id: { in: payments.map((p) => p.id) } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app?.close();
  await prisma.$disconnect();
});

async function parentWithChild(name: string) {
  const res = await http().post('/auth/register').send({ firstName: name, lastName: 'Bello', email: `${name.toLowerCase()}.${stamp}@test.ng`, password: 'password-123', role: 'PARENT' }).expect(201);
  const token = res.body.accessToken as string;
  const before = await http().get('/parent/plan').set(auth(token)).expect(200);
  expect(before.body.state).toBe('NO_CHILDREN');

  const username = `pl${stamp}${name.toLowerCase()}`.slice(0, 20);
  const child = await http()
    .post('/parent/children')
    .set(auth(token))
    .send({ firstName: 'Kemi', lastName: 'Bello', level: 'SENIOR_SECONDARY', gradeName: 'SS3', username, pin: '4821', consentDataProcessing: true, consentAiReports: true })
    .expect(201);
  const kid = (await http().post('/auth/student-login').send({ username, pin: '4821' }).expect(200)).body.accessToken as string;
  return { token, userId: res.body.user.id as string, childId: child.body.id as string, kid };
}

describe('Parent plan', () => {
  let p: Awaited<ReturnType<typeof parentWithChild>>;
  const anyTopic = '00000000-0000-4000-8000-000000000000';

  it('the 21-day trial starts when the first child is added, with everything open', async () => {
    p = await parentWithChild('Funke');
    const plan = await http().get('/parent/plan').set(auth(p.token)).expect(200);
    expect(plan.body).toMatchObject({ state: 'TRIAL', daysLeft: 21, priceKobo: '150000', planDays: 30, trialDays: 21 });
    near(plan.body.trialEndsAt, Date.now() + 21 * DAY);

    // Practice isn't blocked by the plan (this topic doesn't exist, so it fails for that reason instead).
    const round = await http().post('/me/student/practice/rounds').set(auth(p.kid)).send({ topicId: anyTopic });
    expect(round.status).not.toBe(402);
    const cards = await http().get('/parent/progress').set(auth(p.token)).expect(200);
    expect(cards.body[0].week).not.toBeNull();
    expect(cards.body[0].locked).toBeUndefined();
  });

  it('when the trial ends the family drops to the free plan: 10 questions a day, mock results kept, no parent view', async () => {
    await prisma.user.update({ where: { id: p.userId }, data: { trialEndsAt: new Date(Date.now() - 1000) } });
    const plan = await http().get('/parent/plan').set(auth(p.token)).expect(200);
    expect(plan.body).toMatchObject({ state: 'FREE', daysLeft: 0, freeDailyQuestions: 10 });

    const home = await http().get('/me/student/home').set(auth(p.kid)).expect(200);
    expect(home.body.practice).toEqual({ limit: 10, left: 10 });
    expect(home.body.coins).toBeNull(); // no rewards, and nothing about paying, on the free plan

    // Still under the limit, so the round fails only because this topic doesn't exist.
    const round = await http().post('/me/student/practice/rounds').set(auth(p.kid)).send({ topicId: anyTopic });
    expect(round.status).toBe(404);

    const cards = await http().get('/parent/progress').set(auth(p.token)).expect(200);
    expect(cards.body[0]).toMatchObject({ week: null, locked: true });
    expect(cards.body[0]).toHaveProperty('lastMock');
    const detail = await http().get(`/parent/children/${p.childId}/progress`).set(auth(p.token)).expect(200);
    expect(detail.body).toMatchObject({ locked: true, subjects: [], weakTopics: [], strongTopics: [] });
    expect(Array.isArray(detail.body.mocks)).toBe(true);
    await http().get(`/parent/children/${p.childId}/reports/latest`).set(auth(p.token)).expect(402);
  });

  it('on the free plan, the 11th question of the day is refused kindly, with nothing about paying', async () => {
    // Ten questions answered today (this run's own, deleted below).
    const physics = await prisma.examSubject.findUniqueOrThrow({ where: { exam_slug: { exam: 'JAMB', slug: 'physics' } } });
    const topic = await prisma.syllabusTopic.create({ data: { examSubjectId: physics.id, name: `Plan test ${stamp}` } });
    const options = [{ id: 'a', label: '1' }, { id: 'b', label: '2' }];
    await prisma.examQuestion.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({ examSubjectId: physics.id, topicId: topic.id, difficulty: 1, stem: `Plan test ${stamp} #${i}`, options, answerId: 'a', explanation: 'x', origin: 'AUTHORED' as const, status: 'APPROVED' as const })),
    });
    const qs = await prisma.examQuestion.findMany({ where: { topicId: topic.id }, select: { id: true } });
    try {
      await prisma.questionSeen.createMany({ data: qs.map((q) => ({ studentId: p.childId, questionId: q.id, lastCorrect: true })) });
      const round = await http().post('/me/student/practice/rounds').set(auth(p.kid)).send({ topicId: anyTopic }).expect(429);
      expect(round.body).toMatchObject({ code: 'DAILY_LIMIT' });
      expect(round.body.message).toMatch(/Come back tomorrow/);
      expect(round.body.message).not.toMatch(/₦|pay|renew|parent/i);
      expect((await http().get('/me/student/home').set(auth(p.kid)).expect(200)).body.practice).toEqual({ limit: 10, left: 0 });
    } finally {
      await prisma.examQuestion.deleteMany({ where: { topicId: topic.id } }); // seen rows cascade
      await prisma.syllabusTopic.delete({ where: { id: topic.id } });
    }
  });

  it('paying ₦1,500 switches everything back on for 30 days and books the money as subscription revenue', async () => {
    const pay = await http().post('/parent/plan/pay').set(auth(p.token)).expect(201);
    expect(pay.body.reference).toMatch(/^NX-SUB-/);
    expect((await http().post(`/payments/${pay.body.reference}/verify`).set(auth(p.token)).expect(200)).body.status).toBe('SUCCESS');
    await http().post(`/payments/${pay.body.reference}/verify`).set(auth(p.token)).expect(200); // idempotent

    const plan = await http().get('/parent/plan').set(auth(p.token)).expect(200);
    expect(plan.body).toMatchObject({ state: 'ACTIVE', daysLeft: 30 });
    near(plan.body.paidUntil, Date.now() + 30 * DAY);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { reference: pay.body.reference }, include: { ledgerEntries: { include: { wallet: true } } } });
    expect(payment).toMatchObject({ purpose: 'SUBSCRIPTION', amountKobo: 150_000n, status: 'SUCCESS' });
    expect(payment.ledgerEntries).toHaveLength(1);
    expect(payment.ledgerEntries[0]).toMatchObject({ stream: 'SUBSCRIPTION', amountKobo: 150_000n });
    expect(payment.ledgerEntries[0].wallet.type).toBe('PLATFORM_REVENUE');

    expect((await http().get('/me/student/home').set(auth(p.kid)).expect(200)).body.practice).toEqual({ limit: null, left: null });
    const cards = await http().get('/parent/progress').set(auth(p.token)).expect(200);
    expect(cards.body[0].locked).toBeUndefined();
  });

  it('paying again adds 30 more days on top', async () => {
    const pay = await http().post('/parent/plan/pay').set(auth(p.token)).expect(201);
    await http().post(`/payments/${pay.body.reference}/verify`).set(auth(p.token)).expect(200);
    const plan = await http().get('/parent/plan').set(auth(p.token)).expect(200);
    near(plan.body.paidUntil, Date.now() + 60 * DAY);
  });

  it('paying during the trial keeps the trial days', async () => {
    const q = await parentWithChild('Chidi');
    await http().get('/parent/plan').set(auth(q.token)).expect(200); // starts the trial
    const pay = await http().post('/parent/plan/pay').set(auth(q.token)).expect(201);
    await http().post(`/payments/${pay.body.reference}/verify`).set(auth(q.token)).expect(200);
    const plan = await http().get('/parent/plan').set(auth(q.token)).expect(200);
    expect(plan.body.state).toBe('ACTIVE');
    near(plan.body.paidUntil, Date.now() + 51 * DAY);
  });

  it('reminds parents 3 days before access ends and on the day it ends, once each', async () => {
    const messaging = app.get(MessagingService);
    const notify = vi.spyOn(messaging, 'notify').mockImplementation(() => undefined);
    const now = new Date();
    const r = await parentWithChild('Bisi');
    await http().get('/parent/plan').set(auth(r.token)).expect(200);
    await prisma.user.update({ where: { id: r.userId }, data: { trialEndsAt: new Date(now.getTime() + 2.5 * DAY) } });

    const plan = app.get(PlanService);
    const forBisi = () => notify.mock.calls.filter(([ids]) => ids.includes(r.userId)).map(([, , msg]) => msg.title);

    await plan.remind(now);
    expect(forBisi()).toEqual(['Your free trial ends in 3 days']);
    await plan.remind(new Date(now.getTime() + DAY)); // next morning: 1.5 days left, nothing new
    expect(forBisi()).toHaveLength(1);
    await plan.remind(new Date(now.getTime() + 3 * DAY)); // ended half a day ago
    expect(forBisi()).toEqual(['Your free trial ends in 3 days', 'Your free trial has ended']);
    await plan.remind(new Date(now.getTime() + 4 * DAY));
    expect(forBisi()).toHaveLength(2);
    notify.mockRestore();
  });
});
