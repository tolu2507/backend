/**
 * Overwatch deleting parents and children, and privacy requests. Real HTTP API on nexus_test; Squad is replaced.
 * Deletes everything it makes (including the anonymous rows and payments it leaves behind on purpose).
 *
 *   pnpm test:e2e test/accounts.e2e-spec.ts
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';

import { configureApp } from '../src/app.factory.js';
import { AppModule } from '../src/app.module.js';
import { SquadService } from '../src/payments/squad.service.js';

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
const madeUsers: string[] = []; // every account this run creates, by id, so anonymised ones are found too

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SquadService).useValue(squad).compile();
  app = configureApp(mod.createNestApplication({ rawBody: true }));
  await app.init();
});

afterAll(async () => {
  const ids = madeUsers;
  const payments = await prisma.payment.findMany({ where: { payerId: { in: ids } }, select: { id: true } });
  const entries = await prisma.ledgerEntry.findMany({ where: { paymentId: { in: payments.map((p) => p.id) } } });
  for (const e of entries) await prisma.wallet.update({ where: { id: e.walletId }, data: { balanceKobo: { decrement: e.amountKobo } } });
  await prisma.ledgerEntry.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
  await prisma.payment.deleteMany({ where: { id: { in: payments.map((p) => p.id) } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { entityId: { in: ids } }] } });
  await prisma.consent.deleteMany({ where: { givenById: { in: ids } } });
  await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app?.close();
  await prisma.$disconnect();
});

async function parent(name: string) {
  const res = await http().post('/auth/register').send({ firstName: name, lastName: 'Okon', email: `${name.toLowerCase()}.${stamp}@test.ng`, password: 'password-123', role: 'PARENT' }).expect(201);
  madeUsers.push(res.body.user.id);
  return { token: res.body.accessToken as string, id: res.body.user.id as string };
}
async function child(token: string, first: string) {
  const username = `ac${stamp}${first.toLowerCase()}`.slice(0, 20);
  const res = await http()
    .post('/parent/children')
    .set(auth(token))
    .send({ firstName: first, lastName: 'Okon', level: 'JUNIOR_SECONDARY', gradeName: 'JSS3', username, pin: '4821', consentDataProcessing: true, consentAiReports: false })
    .expect(201);
  const profile = await prisma.studentProfile.findUniqueOrThrow({ where: { id: res.body.id }, select: { userId: true } });
  madeUsers.push(profile.userId);
  return { studentId: res.body.id as string, userId: profile.userId, username };
}

describe('Deleting parents and children', () => {
  let admin = '';
  let adminId = '';
  let ada: Awaited<ReturnType<typeof parent>>;
  let bayo: Awaited<ReturnType<typeof parent>>;
  let only: Awaited<ReturnType<typeof child>>; // Ada's alone
  let shared: Awaited<ReturnType<typeof child>>; // Ada's and Bayo's

  it('previews a parent: which children go, which stay with another parent', async () => {
    const email = `ow.${stamp}@test.ng`;
    const a = await prisma.user.create({ data: { email, firstName: 'Over', lastName: 'Watch', passwordHash: await bcrypt.hash('password-123', 4), memberships: { create: { role: 'PLATFORM_ADMIN' } } } });
    adminId = a.id;
    madeUsers.push(a.id);
    admin = (await http().post('/auth/login').send({ identifier: email, password: 'password-123' }).expect(200)).body.accessToken;

    ada = await parent('Ada');
    bayo = await parent('Bayo');
    only = await child(ada.token, 'Femi');
    shared = await child(ada.token, 'Tolu');
    await prisma.guardianship.create({ data: { parentId: bayo.id, studentId: shared.studentId, relationship: 'FATHER', confirmedAt: new Date() } });

    const p = (await http().get(`/admin/people/${ada.id}/delete-preview`).set(auth(admin)).expect(200)).body;
    expect(p).toMatchObject({ kind: 'PARENT', name: 'Ada Okon', keepsRecords: false, rewardsKobo: '0', blockers: [] });
    expect(p.children.map((c: { name: string; otherParents: number }) => [c.name, c.otherParents])).toEqual([
      ['Femi Okon', 0],
      ['Tolu Okon', 1],
    ]);
    await http().get(`/admin/people/${adminId}/delete-preview`).set(auth(admin)).expect(400); // admins can't be deleted here
    await http().get(`/admin/people/${ada.id}/delete-preview`).set(auth(ada.token)).expect(403);
  });

  it('won’t delete a child who still has tuck-shop money', async () => {
    const wallet = await prisma.wallet.upsert({ where: { userId_type: { userId: only.userId, type: 'STUDENT_SPEND' } }, update: { balanceKobo: 50_000n }, create: { userId: only.userId, type: 'STUDENT_SPEND', balanceKobo: 50_000n } });
    const res = await http().post(`/admin/people/${ada.id}/delete`).set(auth(admin)).send({ withChildren: true }).expect(400);
    expect(res.body.message).toMatch(/Femi still has ₦500 in their tuck-shop wallet/);
    await prisma.wallet.update({ where: { id: wallet.id }, data: { balanceKobo: 0n } });
  });

  it('a parent who has paid is stripped of everything personal; the payment stays; their only child goes; a shared child stays', async () => {
    const pay = await http().post('/parent/plan/pay').set(auth(ada.token)).expect(201);
    await http().post(`/payments/${pay.body.reference}/verify`).set(auth(ada.token)).expect(200);
    expect((await http().get(`/admin/people/${ada.id}/delete-preview`).set(auth(admin)).expect(200)).body.keepsRecords).toBe(true);

    const res = await http().post(`/admin/people/${ada.id}/delete`).set(auth(admin)).send({ withChildren: true }).expect(200);
    expect(res.body).toEqual({ deleted: 2, anonymised: true });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: ada.id }, include: { memberships: true, childrenLinks: true } });
    expect(row).toMatchObject({ firstName: 'Deleted', lastName: 'user', email: null, phone: null, passwordHash: null, memberships: [], childrenLinks: [] });
    expect(await prisma.payment.count({ where: { payerId: ada.id } })).toBe(1);
    await http().post('/auth/login').send({ identifier: `ada.${stamp}@test.ng`, password: 'password-123' }).expect(401);

    expect(await prisma.user.findUnique({ where: { id: only.userId } })).toBeNull();
    expect(await prisma.studentProfile.findUnique({ where: { id: only.studentId } })).toBeNull();
    const kept = await prisma.studentProfile.findUniqueOrThrow({ where: { id: shared.studentId }, include: { guardians: true } });
    expect(kept.guardians.map((g) => g.parentId)).toEqual([bayo.id]);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'account.deleted', entityId: ada.id } });
    expect(log.meta).toEqual({ kind: 'PARENT', childrenDeleted: 1, anonymised: true, rewardsForfeitedKobo: '0' });
    expect(JSON.stringify(log.meta)).not.toMatch(/Ada|Femi|test\.ng/);
  });

  it('privacy requests from the app show in Overwatch, and the data can be exported', async () => {
    await http().post('/me/data-requests').set(auth(bayo.token)).send({ type: 'EXPORT' }).expect(201);
    await http().post('/me/data-requests').set(auth(bayo.token)).send({ type: 'DELETE', studentId: shared.studentId }).expect(201);
    const open = (await http().get('/admin/data-requests?open=true').set(auth(admin)).expect(200)).body as { id: string; type: string; parent: { name: string }; child: { name: string } | null }[];
    const mine = open.filter((r) => r.parent.name === 'Bayo Okon');
    expect(mine.map((r) => [r.type, r.child?.name ?? null]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))).toEqual([
      ['DELETE', 'Tolu Okon'],
      ['EXPORT', null],
    ]);

    const data = (await http().get(`/admin/people/${bayo.id}/export`).set(auth(admin)).expect(200)).body;
    expect(data.account).toMatchObject({ firstName: 'Bayo', email: `bayo.${stamp}@test.ng` });
    expect(data.children[0]).toMatchObject({ firstName: 'Tolu', class: 'JSS3' });
    const exportReq = mine.find((r) => r.type === 'EXPORT')!;
    await http().post(`/admin/data-requests/${exportReq.id}/status`).set(auth(admin)).send({ status: 'DONE' }).expect(200);

    // Deleting the child closes the parent's request about them.
    await http().post(`/admin/people/${shared.userId}/delete`).set(auth(admin)).send({ withChildren: false }).expect(200);
    const after = (await http().get('/admin/data-requests?open=true').set(auth(admin)).expect(200)).body as { parent: { name: string } }[];
    expect(after.filter((r) => r.parent.name === 'Bayo Okon')).toHaveLength(0);
  });

  it('a parent with no payments and no children is deleted outright', async () => {
    const res = await http().post(`/admin/people/${bayo.id}/delete`).set(auth(admin)).send({ withChildren: true }).expect(200);
    expect(res.body).toEqual({ deleted: 1, anonymised: false });
    expect(await prisma.user.findUnique({ where: { id: bayo.id } })).toBeNull();
  });
});
