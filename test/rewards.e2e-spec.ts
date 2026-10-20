/**
 * Earn while you learn: stickers, coins, ₦1,000 for the family at 10,000 coins, and collecting it as airtime or data.
 * Real HTTP API on nexus_test; only Squad is replaced. Deletes everything it makes.
 *
 *   pnpm test:e2e test/rewards.e2e-spec.ts
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { vi } from 'vitest';

import { configureApp } from '../src/app.factory.js';
import { AppModule } from '../src/app.module.js';
import { GamificationService } from '../src/gamification/gamification.service.js';
import { MessagingService } from '../src/messaging/messaging.service.js';
import { SquadService, type VendResult } from '../src/payments/squad.service.js';

const prisma = new PrismaClient();
let nextVend: VendResult = { outcome: 'SUCCESS', reference: 'app_ref_1' };
const vends: { kind: string; phone: string; amountKobo: bigint; planCode?: string }[] = [];
const squad = {
  initiate: async () => 'https://sandbox-pay.squadco.com/fake-checkout',
  verify: async () => ({ success: true, status: 'success', raw: { test: true } }),
  isValidSignature: () => false,
  assertReady: () => undefined,
  vend: async (input: (typeof vends)[number]) => {
    vends.push(input);
    return nextVend;
  },
  dataBundles: async () => [
    { planCode: '1001', name: '1.5GB, 30 days', priceKobo: 100_000n },
    { planCode: '1004', name: '3GB, 30 days', priceKobo: 200_000n },
  ],
  vendStatus: async () => 'success' as const,
};

let app: INestApplication;
const http = () => request(app.getHttpServer());
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const stamp = Date.now().toString(36);
let topicId = '';
let subtopicId = '';

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SquadService).useValue(squad).compile();
  app = configureApp(mod.createNestApplication({ rawBody: true }));
  await app.init();
  vi.spyOn(app.get(MessagingService), 'notify').mockImplementation(() => undefined);

  const physics = await prisma.examSubject.findUniqueOrThrow({ where: { exam_slug: { exam: 'JAMB', slug: 'physics' } } });
  topicId = (await prisma.syllabusTopic.create({ data: { examSubjectId: physics.id, name: `Rewards ${stamp}` } })).id;
  subtopicId = (await prisma.syllabusTopic.create({ data: { examSubjectId: physics.id, parentId: topicId, name: 'Waves', order: 0 } })).id;
  const options = [{ id: 'a', label: 'right' }, { id: 'b', label: 'wrong' }];
  await prisma.examQuestion.createMany({
    data: Array.from({ length: 10 }, (_, i) => ({ examSubjectId: physics.id, topicId: subtopicId, difficulty: 1, stem: `Rewards ${stamp} #${i}`, options, answerId: 'a', explanation: 'x', origin: 'AUTHORED' as const, status: 'APPROVED' as const })),
  });
});

afterAll(async () => {
  await prisma.examQuestion.deleteMany({ where: { topicId: subtopicId } });
  await prisma.syllabusTopic.deleteMany({ where: { id: { in: [subtopicId, topicId] } } });
  const users = await prisma.user.findMany({ where: { OR: [{ email: { endsWith: `${stamp}@test.ng` } }, { username: { startsWith: `rw${stamp}` } }] }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const wallets = await prisma.wallet.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  await prisma.ledgerEntry.deleteMany({ where: { walletId: { in: wallets.map((w) => w.id) } } });
  await prisma.wallet.deleteMany({ where: { id: { in: wallets.map((w) => w.id) } } });
  await prisma.rewardRedemption.deleteMany({ where: { parentId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.leagueEntry.deleteMany({ where: { student: { userId: { in: ids } } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app?.close();
  await prisma.$disconnect();
});

describe('Earn while you learn', () => {
  let parent = '';
  let parentId = '';
  let kid = '';
  let childId = '';
  let admin = '';
  const balance = async () => (await http().get('/parent/rewards').set(auth(parent)).expect(200)).body.balanceKobo as string;
  const give = (coins: number) => prisma.$transaction((tx) => app.get(GamificationService).awardCoins(tx, childId, coins, 'STICKER'));

  it('a child on the trial earns coins and stickers from a practice round', async () => {
    const res = await http().post('/auth/register').send({ firstName: 'Amaka', lastName: 'Obi', email: `amaka.${stamp}@test.ng`, password: 'password-123', role: 'PARENT' }).expect(201);
    parent = res.body.accessToken;
    parentId = res.body.user.id;
    const username = `rw${stamp}`.slice(0, 20);
    const child = await http()
      .post('/parent/children')
      .set(auth(parent))
      .send({ firstName: 'Ife', lastName: 'Obi', level: 'SENIOR_SECONDARY', gradeName: 'SS3', username, pin: '4821', consentDataProcessing: true, consentAiReports: true })
      .expect(201);
    childId = child.body.id;
    kid = (await http().post('/auth/student-login').send({ username, pin: '4821' }).expect(200)).body.accessToken;
    const catalog = (await http().get('/exams').expect(200)).body.find((e: { exam: string }) => e.exam === 'JAMB');
    const pick = ['english-language', 'physics', 'chemistry', 'mathematics'].map((slug) => catalog.subjects.find((s: { slug: string }) => s.slug === slug).id);
    await http().put(`/parent/children/${childId}/exams/JAMB`).set(auth(parent)).send({ subjectIds: pick }).expect(200);

    const home = await http().get('/me/student/home').set(auth(kid)).expect(200);
    expect(home.body.coins).toEqual({ balance: 0, target: 10_000, rewardKobo: '100000', earnedKobo: '0' });

    const round = await http().post('/me/student/practice/rounds').set(auth(kid)).send({ topicId: subtopicId }).expect(200);
    expect(round.body.questions).toHaveLength(10);
    const answers = Object.fromEntries(round.body.questions.map((q: { id: string }) => [q.id, 'a']));
    const result = await http().post('/me/student/practice/rounds/submit').set(auth(kid)).send({ topicId: subtopicId, answers }).expect(200);

    // 10 new right × 10 coins, plus First quest (200) and Flawless (200): both Common.
    expect(result.body.rewards.newBadges.map((b: { code: string }) => b.code)).toEqual(['FIRST_QUEST', 'PERFECT_1']);
    expect(result.body.rewards.newBadges[0]).toMatchObject({ rarity: 'COMMON', coins: 200, icon: 'rocket' });
    expect(result.body.rewards.coins).toEqual({ earned: 500, balance: 500, target: 10_000, sentKobo: 0 });
  });

  it('the sticker book shows all 40, what is new, and how close the rest are', async () => {
    const book = (await http().get('/me/student/badges').set(auth(kid)).expect(200)).body as { id: string; code: string; earned: boolean; seen: boolean; progress: { current: number; target: number | null } | null }[];
    expect(book).toHaveLength(40);
    const first = book.find((b) => b.code === 'FIRST_QUEST')!;
    expect(first).toMatchObject({ earned: true, seen: false, progress: null });
    expect(book.find((b) => b.code === 'RIGHT_25')!.progress).toEqual({ current: 10, target: 25 });
    expect(book.find((b) => b.code === 'MOCK_TOP_10')!.progress).toEqual({ current: 0, target: null });

    await http().post('/me/student/badges/seen').set(auth(kid)).send({ ids: book.filter((b) => b.earned).map((b) => b.id) }).expect(200);
    const after = (await http().get('/me/student/badges').set(auth(kid)).expect(200)).body as typeof book;
    expect(after.filter((b) => b.earned).every((b) => b.seen)).toBe(true);
  });

  it('practice coins stop at 400 a day; sticker coins are not capped', async () => {
    const capped = await prisma.$transaction((tx) => app.get(GamificationService).awardCoins(tx, childId, 1_000, 'PRACTICE'));
    expect(capped?.earned).toBe(300); // 100 already earned from practice today
    const again = await prisma.$transaction((tx) => app.get(GamificationService).awardCoins(tx, childId, 50, 'PRACTICE'));
    expect(again?.earned).toBe(0);
    expect((await give(50))?.earned).toBe(50);
  });

  it('10,000 coins become ₦1,000 in the parent’s rewards wallet', async () => {
    await prisma.studentProfile.update({ where: { id: childId }, data: { coins: 9_900 } });
    const r = await give(250);
    expect(r).toMatchObject({ balance: 150, sentKobo: 100_000 });
    const overview = (await http().get('/parent/rewards').set(auth(parent)).expect(200)).body;
    expect(overview).toMatchObject({ balanceKobo: '100000', planState: 'TRIAL', earning: true, canCollect: false });
    expect(overview.children[0]).toMatchObject({ firstName: 'Ife', coins: 150, earnedKobo: '100000' });
    expect(overview.activity[0]).toMatchObject({ amountKobo: '100000', description: 'Ife earned ₦1,000 by practising' });
  });

  it('collecting needs the paid plan, so free trials can’t be farmed for airtime', async () => {
    const res = await http().post('/parent/rewards/redeem').set(auth(parent)).send({ kind: 'AIRTIME', network: 'MTN', phone: '08031234567', amountKobo: '100000' }).expect(402);
    expect(res.body.message).toMatch(/stays in your rewards balance/);
    expect(vends).toHaveLength(0);
  });

  it('on the plan, the parent collects ₦1,000 airtime and the wallet goes down', async () => {
    await prisma.user.update({ where: { id: parentId }, data: { paidUntil: new Date(Date.now() + 30 * 86_400_000) } });
    await http().post('/parent/rewards/redeem').set(auth(parent)).send({ kind: 'AIRTIME', network: 'MTN', phone: '0123456789012', amountKobo: '100000' }).expect(400); // not a Nigerian mobile number
    const sent = await http().post('/parent/rewards/redeem').set(auth(parent)).send({ kind: 'AIRTIME', network: 'MTN', phone: '+2348031234567', amountKobo: '100000' }).expect(200);
    expect(sent.body).toMatchObject({ kind: 'AIRTIME', status: 'SUCCESS', phone: '08031234567', amountKobo: '100000' });
    expect(vends.at(-1)).toMatchObject({ kind: 'AIRTIME', phone: '08031234567', amountKobo: 100_000n });
    expect(await balance()).toBe('0');

    const broke = await http().post('/parent/rewards/redeem').set(auth(parent)).send({ kind: 'AIRTIME', network: 'MTN', phone: '08031234567', amountKobo: '100000' }).expect(400);
    expect(broke.body.message).toMatch(/You have ₦0 in rewards/);
    await http().post('/parent/rewards/redeem').set(auth(parent)).send({ kind: 'AIRTIME', network: 'MTN', phone: '08031234567', amountKobo: '7000' }).expect(400); // not an offered amount
  });

  it('data: the price comes from the plan Squad sells', async () => {
    await prisma.studentProfile.update({ where: { id: childId }, data: { coins: 9_999 } });
    await give(1);
    const plans = await http().get('/parent/rewards/data-plans?network=MTN').set(auth(parent)).expect(200);
    expect(plans.body[0]).toEqual({ planCode: '1001', name: '1.5GB, 30 days', priceKobo: '100000' });
    nextVend = { outcome: 'PENDING', reference: 'app_ref_data' };
    const sent = await http().post('/parent/rewards/redeem').set(auth(parent)).send({ kind: 'DATA', network: 'MTN', phone: '08031234567', planCode: '1001' }).expect(200);
    expect(sent.body).toMatchObject({ kind: 'DATA', status: 'PENDING', planName: '1.5GB, 30 days', amountKobo: '100000' });

    // The 10-minute follow-up asks Squad and marks it delivered.
    await app.get((await import('../src/rewards/rewards.service.js')).RewardsService).followUp();
    expect((await prisma.rewardRedemption.findUniqueOrThrow({ where: { id: sent.body.id } })).status).toBe('SUCCESS');
  });

  it('if Squad says no, the money goes straight back', async () => {
    await prisma.studentProfile.update({ where: { id: childId }, data: { coins: 9_999 } });
    await give(1);
    nextVend = { outcome: 'FAILED', error: 'Invalid phone number' };
    const res = await http().post('/parent/rewards/redeem').set(auth(parent)).send({ kind: 'AIRTIME', network: 'GLO', phone: '08051234567', amountKobo: '100000' }).expect(200);
    expect(res.body.status).toBe('FAILED');
    expect(await balance()).toBe('100000');
  });

  it('if Squad never answers, it waits for Overwatch, which can settle it either way', async () => {
    nextVend = { outcome: 'UNKNOWN', error: 'timeout' };
    const res = await http().post('/parent/rewards/redeem').set(auth(parent)).send({ kind: 'AIRTIME', network: 'MTN', phone: '08031234567', amountKobo: '100000' }).expect(200);
    expect(res.body.status).toBe('CHECK');
    expect(await balance()).toBe('0'); // held until someone checks the Squad dashboard

    const email = `ow.${stamp}@test.ng`;
    await prisma.user.create({ data: { email, firstName: 'Over', lastName: 'Watch', passwordHash: await bcrypt.hash('password-123', 4), memberships: { create: { role: 'PLATFORM_ADMIN' } } } });
    admin = (await http().post('/auth/login').send({ identifier: email, password: 'password-123' }).expect(200)).body.accessToken;
    const ow = await http().get('/admin/rewards?status=CHECK').set(auth(admin)).expect(200);
    expect(ow.body.redemptions.find((r: { id: string }) => r.id === res.body.id)).toMatchObject({ parent: 'Amaka Obi', error: 'timeout' });
    expect(Number(ow.body.month.budgetKobo)).toBe(3_000_000); // ₦30,000 for everyone, every month

    await http().post(`/admin/rewards/${res.body.id}/resolve`).set(auth(admin)).send({ outcome: 'FAILED' }).expect(200);
    expect(await balance()).toBe('100000');
    await http().post(`/admin/rewards/${res.body.id}/resolve`).set(auth(admin)).send({ outcome: 'SUCCESS' }).expect(400); // already settled
  });

  it('stops at the monthly budget, keeping the parent’s balance safe', async () => {
    const before = process.env.REWARDS_MONTHLY_BUDGET_NAIRA;
    process.env.REWARDS_MONTHLY_BUDGET_NAIRA = '0';
    try {
      const res = await http().post('/parent/rewards/redeem').set(auth(parent)).send({ kind: 'AIRTIME', network: 'MTN', phone: '08031234567', amountKobo: '100000' }).expect(503);
      expect(res.body.message).toMatch(/your balance is safe/);
      expect(await balance()).toBe('100000');
    } finally {
      if (before === undefined) delete process.env.REWARDS_MONTHLY_BUDGET_NAIRA;
      else process.env.REWARDS_MONTHLY_BUDGET_NAIRA = before;
    }
  });

  it('on the free plan children earn no coins and see nothing about rewards', async () => {
    await prisma.user.update({ where: { id: parentId }, data: { paidUntil: null, trialEndsAt: new Date(Date.now() - 1000) } });
    expect(await give(500)).toBeNull();
    expect((await http().get('/me/student/home').set(auth(kid)).expect(200)).body.coins).toBeNull();
  });
});
