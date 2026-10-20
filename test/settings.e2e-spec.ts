/**
 * Overwatch settings: prices, trial, free plan and coins change without a deploy, are checked, and are logged.
 * Real HTTP API on nexus_test. Puts every setting back to its default afterwards.
 *
 *   pnpm test:e2e test/settings.e2e-spec.ts
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { configureApp } from '../src/app.factory.js';
import { AppModule } from '../src/app.module.js';
import { SettingsService } from '../src/settings/settings.service.js';

const prisma = new PrismaClient();
let app: INestApplication;
const http = () => request(app.getHttpServer());
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const stamp = Date.now().toString(36);

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(mod.createNestApplication());
  await app.init();
});

afterAll(async () => {
  await prisma.platformSetting.deleteMany();
  const settings = app.get(SettingsService) as unknown as { cache: unknown; syncStickerCoins: () => Promise<void> };
  settings.cache = null;
  await settings.syncStickerCoins(); // sticker coins back to the defaults
  const users = await prisma.user.findMany({ where: { OR: [{ email: { endsWith: `${stamp}@test.ng` } }, { username: { startsWith: `st${stamp}`.slice(0, 20) } }] }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app?.close();
  await prisma.$disconnect();
});

describe('Overwatch settings', () => {
  let admin = '';
  let parent = '';

  it('lists every setting with its default, limits and help text', async () => {
    const email = `ow.${stamp}@test.ng`;
    await prisma.user.create({ data: { email, firstName: 'Over', lastName: 'Watch', passwordHash: await bcrypt.hash('password-123', 4), memberships: { create: { role: 'PLATFORM_ADMIN' } } } });
    admin = (await http().post('/auth/login').send({ identifier: email, password: 'password-123' }).expect(200)).body.accessToken;
    parent = (await http().post('/auth/register').send({ firstName: 'Sade', lastName: 'Ade', email: `sade.${stamp}@test.ng`, password: 'password-123', role: 'PARENT' }).expect(201)).body.accessToken;

    const list = (await http().get('/admin/settings').set(auth(admin)).expect(200)).body as { key: string; value: unknown; group: string; min?: number; changed: boolean }[];
    const by = Object.fromEntries(list.map((s) => [s.key, s]));
    expect(by.planPriceNaira).toMatchObject({ value: 1_500, group: 'Plan', min: 100, changed: false });
    expect(by.trialDays.value).toBe(21);
    expect(by.coinsPerReward.value).toBe(10_000);
    expect(by.rewardNaira.value).toBe(1_000);
    expect(by.rewardsEnabled.value).toBe(true);
    await http().get('/admin/settings').set(auth(parent)).expect(403);
  });

  it('a change applies straight away and is logged with the old value', async () => {
    const saved = (await http().put('/admin/settings').set(auth(admin)).send({ changes: { planPriceNaira: 2_000, trialDays: 14, freeDailyQuestions: 5 } }).expect(200)).body as { key: string; value: unknown; changed: boolean; updatedBy: string }[];
    expect(saved.find((s) => s.key === 'planPriceNaira')).toMatchObject({ value: 2_000, changed: true, updatedBy: 'Over Watch' });

    const plan = (await http().get('/parent/plan').set(auth(parent)).expect(200)).body;
    expect(plan).toMatchObject({ priceKobo: '200000', trialDays: 14, freeDailyQuestions: 5 });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'settings.updated' }, orderBy: { createdAt: 'desc' } });
    expect(log.meta).toMatchObject({ from: { planPriceNaira: 1_500, trialDays: 21 }, to: { planPriceNaira: 2_000, trialDays: 14 } });
  });

  it('refuses values out of range and saves none of a bad batch', async () => {
    const res = await http().put('/admin/settings').set(auth(admin)).send({ changes: { planPriceNaira: 3_000, trialDays: -1 } }).expect(400);
    expect(res.body.message).toMatch(/Free trial must be between 0 and 90 days/);
    await http().put('/admin/settings').set(auth(admin)).send({ changes: { rewardsEnabled: 'yes' } }).expect(400);
    await http().put('/admin/settings').set(auth(admin)).send({ changes: { madeUp: 1 } }).expect(400);
    expect((await http().get('/parent/plan').set(auth(parent)).expect(200)).body.priceKobo).toBe('200000'); // the 3,000 wasn't saved
  });

  it('the trial length controls every trial, including ones already running', async () => {
    await http().put('/admin/settings').set(auth(admin)).send({ changes: { trialDays: 21 } }).expect(200);
    const username = `st${stamp}`.slice(0, 20);
    await http()
      .post('/parent/children')
      .set(auth(parent))
      .send({ firstName: 'Kunle', lastName: 'Ade', level: 'PRIMARY', gradeName: 'Primary 5', username, pin: '4821', consentDataProcessing: true, consentAiReports: false })
      .expect(201);
    const started = (await http().get('/parent/plan').set(auth(parent)).expect(200)).body;
    expect(started).toMatchObject({ state: 'TRIAL', daysLeft: 21 });
    const start = new Date(started.trialEndsAt).getTime() - 21 * 86_400_000;

    await http().put('/admin/settings').set(auth(admin)).send({ changes: { trialDays: 30 } }).expect(200);
    const longer = (await http().get('/parent/plan').set(auth(parent)).expect(200)).body;
    expect(longer.daysLeft).toBe(30);
    expect(new Date(longer.trialEndsAt).getTime()).toBe(start + 30 * 86_400_000);

    await http().put('/admin/settings').set(auth(admin)).send({ changes: { trialDays: 14 } }).expect(200);
    const shorter = (await http().get('/parent/plan').set(auth(parent)).expect(200)).body;
    expect(shorter.daysLeft).toBe(14);

    await http().put('/admin/settings').set(auth(admin)).send({ changes: { trialDays: 0 } }).expect(200);
    expect((await http().get('/parent/plan').set(auth(parent)).expect(200)).body.state).toBe('FREE');
  });

  it('sticker coins follow the rarity settings', async () => {
    await http().put('/admin/settings').set(auth(admin)).send({ changes: { coinsEpic: 2_000 } }).expect(200);
    const epic = await prisma.badge.findMany({ where: { rarity: 'EPIC' }, select: { coins: true } });
    expect(epic.length).toBeGreaterThan(0);
    expect(epic.every((b) => b.coins === 2_000)).toBe(true);
  });
});
