/**
 * The whole BrainBox journey through the real HTTP API and a real Postgres database (nexus_test).
 * Only Squad is replaced, because a test can't type a card number into Squad's checkout page.
 *
 *   createdb nexus_test && DATABASE_URL=…/nexus_test pnpm prisma migrate reset --force
 *   pnpm test:e2e
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

import { configureApp } from '../src/app.factory.js';
import { AppModule } from '../src/app.module.js';
import { SquadService } from '../src/payments/squad.service.js';

const prisma = new PrismaClient();
let lastCallbackUrl = '';
const squad = {
  initiate: async (input: { callbackUrl: string }) => {
    lastCallbackUrl = input.callbackUrl;
    return 'https://sandbox-pay.squadco.com/fake-checkout';
  },
  verify: async () => ({ success: true, status: 'success', raw: { test: true } }),
  isValidSignature: () => false,
};

let app: INestApplication;
const http = () => request(app.getHttpServer());
const stamp = Date.now().toString(36);

beforeAll(async () => {
  // Fresh rows for this run (content tables from the seed are kept).
  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.lessonQuiz.deleteMany(),
    prisma.tutorSession.deleteMany(),
    prisma.tutorBooking.deleteMany(),
    prisma.tutorMatch.deleteMany(),
    prisma.tutorRequest.deleteMany(),
    prisma.weeklyReport.deleteMany(),
    prisma.leagueEntry.deleteMany(),
    prisma.leagueGroup.deleteMany(),
    // Tutors approved in earlier runs share this run's tutor's name, so matching would pick them instead.
    prisma.tutorProfile.updateMany({ where: { user: { email: { endsWith: '@test.ng' } } }, data: { verificationStatus: 'PENDING' } }),
  ]);
  const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SquadService).useValue(squad).compile();
  app = configureApp(mod.createNestApplication({ rawBody: true }));
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('BrainBox journey', () => {
  let parent: string;
  let child: { id: string; username: string };
  let kid: string;
  let tutor: string;
  let tutorEmail: string;
  let refresh: string;

  it('a parent signs up, gets tokens, and can refresh them', async () => {
    const res = await http().post('/auth/register').send({ firstName: 'Ngozi', lastName: 'Okafor', email: `ngozi.${stamp}@test.ng`, password: 'password-123', role: 'PARENT' }).expect(201);
    expect(res.body.user.memberships.map((m: { role: string }) => m.role)).toEqual(['PARENT']);
    parent = res.body.accessToken;
    refresh = res.body.refreshToken;

    const r2 = await http().post('/auth/refresh').send({ refreshToken: refresh }).expect(200);
    parent = r2.body.accessToken;
    await http().post('/auth/refresh').send({ refreshToken: refresh }).expect(401); // rotated: old token is dead
  });

  it('rejects bad input with a readable message', async () => {
    const res = await http().post('/auth/register').send({ firstName: 'A', lastName: 'B', email: 'nope', password: 'x', role: 'PARENT' }).expect(400);
    expect(res.body.message.join(' ')).toMatch(/valid email|8 characters/);
    await http().get('/parent/children').expect(401);
  });

  it('the parent creates a child account — no school needed', async () => {
    const username = `chidera${stamp}`.slice(0, 20);
    const res = await http()
      .post('/parent/children')
      .set(auth(parent))
      .send({ firstName: 'Chidera', lastName: 'Okafor', level: 'SENIOR_SECONDARY', gradeName: 'SS2', username, pin: '4821', consentDataProcessing: true, consentAiReports: true, consentTutorMatching: true })
      .expect(201);
    child = { id: res.body.id, username };
    expect(res.body.className).toBe('SS2');
    const list = await http().get('/parent/children').set(auth(parent)).expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('the child logs in with username + PIN and plays a quest', async () => {
    await http().post('/auth/student-login').send({ username: child.username, pin: '0000' }).expect(401);
    const res = await http().post('/auth/student-login').send({ username: child.username, pin: '4821' }).expect(200);
    kid = res.body.accessToken;

    const home = await http().get('/me/student/home').set(auth(kid)).expect(200);
    expect(home.body.firstName).toBe('Chidera');
    const quest = home.body.quests.find((q: { kind: string }) => q.kind === 'ACTIVITY');
    expect(quest).toBeTruthy();

    const act = await http().get(`/me/student/activities/${quest.id}`).set(auth(kid)).expect(200);
    expect(act.body.questions[0].answerId).toBeUndefined(); // answers never reach the phone
    const stored = await prisma.learningActivity.findUniqueOrThrow({ where: { id: quest.id } });
    const answers = Object.fromEntries((stored.content as { questions: { id: string; answerId: string }[] }).questions.map((q) => [q.id, q.answerId]));
    const done = await http().post(`/me/student/activities/${quest.id}/submit`).set(auth(kid)).send({ answers }).expect(200);
    expect(done.body.score).toBe(1);
    expect(done.body.xpEarned).toBe(quest.xpReward);

    const again = await http().post(`/me/student/activities/${quest.id}/submit`).set(auth(kid)).send({ answers }).expect(200);
    expect(again.body.xpEarned).toBe(0); // no XP farming the same quest twice a day

    const league = await http().get('/me/student/league').set(auth(kid)).expect(200);
    expect(league.body.league.rank).toBe(1);
    const badges = await http().get('/me/student/badges').set(auth(kid)).expect(200);
    expect(badges.body.find((b: { code: string }) => b.code === 'FIRST_QUEST').earned).toBe(true);
  });

  it('a tutor applies, passes the Chemistry test and is approved', async () => {
    tutorEmail = `adebayo.${stamp}@test.ng`;
    const res = await http().post('/auth/register').send({ firstName: 'Adebayo', lastName: 'Ogunleye', email: tutorEmail, password: 'password-123', role: 'TUTOR' }).expect(201);
    tutor = res.body.accessToken;

    let app1 = await http().get('/tutor/application').set(auth(tutor)).expect(200);
    expect(app1.body.stage).toBe('PROFILE');
    await http()
      .put('/tutor/profile')
      .set(auth(tutor))
      .send({ headline: 'Chemistry teacher', bio: 'Nine years teaching SS chemistry in Lekki.', yearsExperience: 9, qualifications: ['B.Sc. Chemistry'], mode: 'BOTH', state: 'Lagos', lga: 'Eti-Osa', rateKobo: 700000, subjects: [{ subject: 'Chemistry', level: 'SENIOR_SECONDARY' }] })
      .expect(200);
    app1 = await http().put('/tutor/id-check').set(auth(tutor)).send({ ninNumber: '12345678901', referees: [{ name: 'A B', phone: '08012345678', relationship: 'Principal' }, { name: 'C D', phone: '08098765432', relationship: 'Colleague' }] }).expect(200);
    expect(app1.body.stage).toBe('SUBJECT_TEST');

    const test = await http().post('/tutor/tests/start').set(auth(tutor)).send({ subject: 'Chemistry', level: 'SENIOR_SECONDARY' }).expect(200);
    const stored = await prisma.vettingTest.findFirstOrThrow({ where: { subject: 'Chemistry', level: 'SENIOR_SECONDARY' } });
    const answers = Object.fromEntries((stored.questions as { id: string; answerId: string }[]).map((q) => [q.id, q.answerId]));
    const graded = await http().post(`/tutor/tests/${test.body.attemptId}/submit`).set(auth(tutor)).send({ answers, appSwitches: 0 }).expect(200);
    expect(graded.body.passed).toBe(true);

    app1 = await http().get('/tutor/application').set(auth(tutor)).expect(200);
    expect(app1.body.stage).toBe('INTERVIEW');
    await http().get('/tutor/bookings').set(auth(tutor)).expect(403); // not approved yet

    const profile = await prisma.tutorProfile.findFirstOrThrow({ where: { user: { email: tutorEmail } } });
    await prisma.tutorProfile.update({ where: { id: profile.id }, data: { verificationStatus: 'VERIFIED', verifiedAt: new Date() } });
    app1 = await http().get('/tutor/application').set(auth(tutor)).expect(200);
    expect(app1.body.stage).toBe('APPROVED');
  });

  let sessionId: string;

  it('the parent asks for a Chemistry teacher, gets matched and books a free trial', async () => {
    const reqRes = await http()
      .post('/parent/tutor-requests')
      .set(auth(parent))
      .send({ studentId: child.id, subject: 'Chemistry', goals: 'Pass WAEC', mode: 'BOTH', state: 'Lagos', lga: 'Eti-Osa', budgetMaxKobo: 1_000_000, days: ['Sat'], preferences: ['Patient'] })
      .expect(201);
    expect(reqRes.body.criteria[0]).toBe('Chemistry · SS2');

    const matches = await http().get(`/parent/tutor-requests/${reqRes.body.id}/matches`).set(auth(parent)).expect(200);
    const mine = matches.body.find((m: { name: string }) => m.name.startsWith('Adebayo'));
    expect(mine).toBeTruthy();
    expect(mine.rateKobo).toBe('805000'); // ₦7,000 + 15% service charge
    await http().post('/parent/bookings').set(auth(parent)).send({ matchId: mine.id }).expect(201);
    await http().post('/parent/bookings').set(auth(parent)).send({ matchId: mine.id }).expect(409);

    const bookings = await http().get('/tutor/bookings').set(auth(tutor)).expect(200);
    const booking = bookings.body[0];
    expect(booking.parent.phone).toBeNull(); // contact details only after accepting
    await http().post(`/tutor/bookings/${booking.id}/accept`).set(auth(tutor)).expect(200);

    const trial = await http().post(`/tutor/bookings/${booking.id}/sessions`).set(auth(tutor)).send({ scheduledAt: new Date(Date.now() + 60_000).toISOString(), durationMinutes: 60 }).expect(201);
    expect(trial.body.isTrial).toBe(true);
    const paid = await http().post(`/tutor/bookings/${booking.id}/sessions`).set(auth(tutor)).send({ scheduledAt: new Date(Date.now() + 120_000).toISOString(), durationMinutes: 60 }).expect(201);
    expect(paid.body.totalKobo).toBe('805000');
    sessionId = paid.body.id;
  });

  it('the parent pays into escrow; the kid’s lesson quiz releases it to the tutor', async () => {
    await http().post(`/tutor/sessions/${sessionId}/complete`).set(auth(tutor)).send({ topics: ['Titration'] }).expect(400); // not paid / not started

    // Behind ngrok the phone reaches us on the tunnel's address, so Squad must send it back there, not to localhost.
    const pay = await http().post(`/parent/sessions/${sessionId}/pay`).set(auth(parent)).set('X-Forwarded-Proto', 'https').set('X-Forwarded-Host', 'abcd.ngrok-free.app').expect(201);
    expect(pay.body.checkoutUrl).toContain('squadco');
    expect(lastCallbackUrl).toBe(`https://abcd.ngrok-free.app/payments/return?ref=${pay.body.reference}`);
    const verified = await http().post(`/payments/${pay.body.reference}/verify`).set(auth(parent)).expect(200);
    expect(verified.body.status).toBe('SUCCESS');
    await http().post(`/payments/${pay.body.reference}/verify`).set(auth(parent)).expect(200); // idempotent

    let escrow = await prisma.wallet.findFirstOrThrow({ where: { type: 'ESCROW', userId: null } });
    const heldBefore = escrow.balanceKobo;
    expect(heldBefore).toBeGreaterThanOrEqual(805000n);

    await prisma.tutorSession.update({ where: { id: sessionId }, data: { scheduledAt: new Date(Date.now() - 3_600_000) } }); // the lesson time has passed
    const done = await http().post(`/tutor/sessions/${sessionId}/complete`).set(auth(tutor)).send({ topics: ['Acid-base titration'], notes: 'Good effort' }).expect(200);
    expect(done.body.quizCreated).toBe(true);
    expect(done.body.quizSource).toBe('question-bank'); // AI is off in tests

    const home = await http().get('/me/student/home').set(auth(kid)).expect(200);
    const quiz = home.body.quests.find((q: { kind: string }) => q.kind === 'LESSON_QUIZ');
    expect(quiz.subtitle).toContain('Adebayo');
    const stored = await prisma.lessonQuiz.findUniqueOrThrow({ where: { id: quiz.id } });
    const answers = Object.fromEntries((stored.questions as { id: string; answerId: string }[]).map((q) => [q.id, q.answerId]));
    const result = await http().post(`/me/student/quizzes/${quiz.id}/submit`).set(auth(kid)).send({ answers }).expect(200);
    expect(result.body.score).toBe(1);

    const session = await prisma.tutorSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(session.escrowStatus).toBe('RELEASED');
    escrow = await prisma.wallet.findFirstOrThrow({ where: { type: 'ESCROW', userId: null } });
    expect(heldBefore - escrow.balanceKobo).toBe(805000n);

    const earnings = await http().get('/tutor/earnings').set(auth(tutor)).expect(200);
    expect(earnings.body.balanceKobo).toBe('700000');
  });

  it('the parent sees a real weekly report and can top up the wallet', async () => {
    const report = await http().get(`/parent/children/${child.id}/reports/latest`).set(auth(parent)).expect(200);
    expect(report.body.headline).toContain('Chidera');
    expect(report.body.subjects.find((s: { name: string }) => s.name === 'Chemistry')).toBeTruthy();
    expect(report.body.writtenBy).toBe('summary');

    const top = await http().post(`/parent/children/${child.id}/wallet/topup`).set(auth(parent)).send({ amountKobo: 200000 }).expect(201);
    await http().post(`/payments/${top.body.reference}/verify`).set(auth(parent)).expect(200);
    const wallet = await http().get(`/parent/children/${child.id}/wallet`).set(auth(parent)).expect(200);
    expect(wallet.body.balanceKobo).toBe('200000');
    const kidWallet = await http().get('/me/student/wallet').set(auth(kid)).expect(200);
    expect(kidWallet.body.balanceKobo).toBe('200000');
  });

  it('a parent can also become a lesson teacher on the same account', async () => {
    const res = await http().post('/me/roles').set(auth(parent)).send({ role: 'TUTOR' }).expect(201);
    expect(res.body.user.memberships.map((m: { role: string }) => m.role).sort()).toEqual(['PARENT', 'TUTOR']);
    const app2 = await http().get('/tutor/application').set(auth(res.body.accessToken)).expect(200);
    expect(app2.body.stage).toBe('PROFILE');
  });

  it('roles are enforced', async () => {
    await http().get('/parent/children').set(auth(kid)).expect(403);
    await http().get('/me/student/home').set(auth(parent)).expect(403);
    await http().get('/admin/tutor-applications').set(auth(parent)).expect(403);
  });
});
