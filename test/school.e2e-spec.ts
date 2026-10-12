/**
 * A school's whole first term through the real HTTP API and Postgres (nexus_test):
 * Overwatch creates the school → owner sets up the session, classes, staff and students →
 * a teacher marks attendance and scores → the bursar bills fees → a parent pays in the app.
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
  verify: async () => ({ success: true, status: 'success', raw: { gateway_transaction_ref: 'GW-TEST' } }),
  refund: async () => ({ refundReference: 'REFUND-TEST', status: 'pending' }),
  isValidSignature: () => false,
};

let app: INestApplication;
const http = () => request(app.getHttpServer());
const stamp = Date.now().toString(36);
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const today = new Date().toISOString().slice(0, 10);
const year = new Date().getFullYear();

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SquadService).useValue(squad).compile();
  app = configureApp(mod.createNestApplication({ rawBody: true }));
  await app.init();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('A school on Nexus', () => {
  let admin: string;
  let owner: string;
  let teacher: string;
  let parent: string;
  let schoolId: string;
  let classA: string;
  let classB: string;
  let mathsId: string;
  let studentId: string;
  let otherStudentId: string;
  let invoiceId: string;

  it('Overwatch turns a demo enquiry into a live school', async () => {
    const email = `overwatch.${stamp}@test.ng`;
    await prisma.user.create({ data: { email, firstName: 'Over', lastName: 'Watch', passwordHash: await bcrypt.hash('password-123', 4), memberships: { create: { role: 'PLATFORM_ADMIN' } } } });
    admin = (await http().post('/auth/login').send({ identifier: email, password: 'password-123' }).expect(200)).body.accessToken;

    await http().post('/schools/enquiries').send({ contactName: 'Mrs Bisi Ade', role: 'Proprietor / Owner', schoolName: `Bright Future ${stamp}`, email: `bisi.${stamp}@test.ng`, phone: '0803 111 2222', levels: ['PRIMARY'] }).expect(201);
    const enquiries = await http().get('/admin/school-enquiries?handled=false').set(auth(admin)).expect(200);
    const enquiry = enquiries.body.find((e: { email: string }) => e.email === `bisi.${stamp}@test.ng`);
    expect(enquiry).toBeTruthy();

    const created = await http()
      .post('/admin/schools')
      .set(auth(admin))
      .send({ enquiryId: enquiry.id, name: `Bright Future ${stamp}`, state: 'Lagos', owner: { firstName: 'Bisi', lastName: 'Ade', email: `bisi.${stamp}@test.ng` } })
      .expect(201);
    schoolId = created.body.id;
    expect(created.body.ownerInvited).toBe(false); // no email provider in tests…
    expect(created.body.code).toMatch(/^\d{6}$/); // …so Overwatch gets the code to pass on

    // The owner sets their password with the invite code and is signed straight in.
    const session = await http().post('/auth/reset-password').send({ identifier: `bisi.${stamp}@test.ng`, code: created.body.code, password: 'owner-pass-1' }).expect(200);
    owner = session.body.accessToken;
    expect(session.body.user.memberships.some((m: { role: string; schoolId: string }) => m.role === 'SCHOOL_OWNER' && m.schoolId === schoolId)).toBe(true);
  });

  it('the owner sets up the session, subjects, classes and a teacher', async () => {
    const setup = (await http().get('/school').set(auth(owner)).expect(200)).body;
    expect(setup.setup.hasYear).toBe(false);

    await http()
      .post('/school/years')
      .set(auth(owner))
      .send({
        name: `${year}/${year + 1}`,
        terms: [
          { name: 'FIRST', startDate: `${year}-01-01`, endDate: `${year}-04-30` },
          { name: 'SECOND', startDate: `${year}-05-01`, endDate: `${year}-08-31` },
          { name: 'THIRD', startDate: `${year}-09-01`, endDate: `${year}-12-31` },
        ],
      })
      .expect(201);
    const overlap = await http()
      .post('/school/years')
      .set(auth(owner))
      .send({ name: `${year + 1}/${year + 2}`, terms: [{ name: 'FIRST', startDate: `${year}-01-01`, endDate: `${year}-03-01` }, { name: 'SECOND', startDate: `${year}-02-01`, endDate: `${year}-04-01` }] })
      .expect(400);
    expect(overlap.body.message).toMatch(/overlap/);

    const subjects = await http().post('/school/subjects').set(auth(owner)).send({ names: ['Mathematics', 'English Language', 'Mathematics'] }).expect(201);
    expect(subjects.body).toHaveLength(2);
    mathsId = subjects.body.find((s: { name: string }) => s.name === 'Mathematics').id;

    const invite = await http().post('/school/staff').set(auth(owner)).send({ firstName: 'Tolu', lastName: 'Bello', email: `tolu.${stamp}@test.ng`, role: 'TEACHER' }).expect(201);
    const t = await http().post('/auth/reset-password').send({ identifier: `tolu.${stamp}@test.ng`, code: invite.body.code, password: 'teacher-pass-1' }).expect(200);
    teacher = t.body.accessToken;

    classA = (await http().post('/school/classes').set(auth(owner)).send({ level: 'PRIMARY', gradeName: 'Primary 4', armName: 'Gold', formTeacherId: invite.body.userId }).expect(201)).body.id;
    classB = (await http().post('/school/classes').set(auth(owner)).send({ level: 'PRIMARY', gradeName: 'Primary 5' }).expect(201)).body.id;
    await http().post('/school/classes').set(auth(owner)).send({ level: 'PRIMARY', gradeName: 'Primary 4', armName: 'Gold' }).expect(409);
    await http().put(`/school/classes/${classA}/subjects`).set(auth(owner)).send({ subjects: [{ subjectId: mathsId, teacherId: invite.body.userId }] }).expect(200);

    // Teachers can't change school setup.
    await http().post('/school/classes').set(auth(teacher)).send({ level: 'PRIMARY', gradeName: 'Primary 6' }).expect(403);
  });

  it('the owner enrols students with their parents; parents get a code and see their child', async () => {
    const res = await http()
      .post('/school/students')
      .set(auth(owner))
      .send({ firstName: 'Ada', lastName: 'Obi', admissionNo: `A-${stamp}`, classId: classA, parent: { firstName: 'Ngozi', lastName: 'Obi', email: `ngozi.obi.${stamp}@test.ng`, relationship: 'MOTHER' } })
      .expect(201);
    studentId = res.body.id;
    expect(res.body.username).toMatch(/^adao\d+$/);
    expect(res.body.pin).toMatch(/^\d{4}$/);

    // The child can sign in to the app with the slip the school prints.
    await http().post('/auth/student-login').send({ username: res.body.username, pin: res.body.pin }).expect(200);

    const imported = await http()
      .post('/school/students/import')
      .set(auth(owner))
      .send({ students: [{ firstName: 'Bayo', lastName: 'Ola', classId: classB }, { firstName: 'Dup', lastName: 'Licate', admissionNo: `A-${stamp}`, classId: classB }] })
      .expect(201);
    expect(imported.body.added).toBe(1);
    expect(imported.body.results[1].error).toMatch(/already used/);
    otherStudentId = (await http().get(`/school/students?classId=${classB}`).set(auth(owner)).expect(200)).body[0].id;

    // The parent account was created by the school; they set a password with an emailed code.
    const reset = await prisma.passwordReset.findFirst({ where: { user: { email: `ngozi.obi.${stamp}@test.ng` } } });
    expect(reset).toBeTruthy();
    await http().post('/auth/forgot-password').send({ identifier: `ngozi.obi.${stamp}@test.ng` }).expect(200);
    const login = await http().post('/auth/login').send({ identifier: `ngozi.obi.${stamp}@test.ng`, password: 'nope-nope' }).expect(401);
    expect(login.body.message).toBeTruthy();
  });

  it('a teacher only sees their own class, marks attendance and enters scores', async () => {
    const classes = await http().get('/school/classes').set(auth(teacher)).expect(200);
    expect(classes.body.map((c: { id: string }) => c.id)).toEqual([classA]);
    await http().get(`/school/students/${otherStudentId}`).set(auth(teacher)).expect(403);
    await http().get(`/school/classes/${classB}/attendance`).set(auth(teacher)).expect(403);

    const sheet = await http().get(`/school/classes/${classA}/attendance?date=${today}`).set(auth(teacher)).expect(200);
    expect(sheet.body.students).toHaveLength(1);
    await http().put(`/school/classes/${classA}/attendance`).set(auth(teacher)).send({ date: today, entries: [{ studentId, status: 'PRESENT' }] }).expect(200);
    await http().put(`/school/classes/${classA}/attendance`).set(auth(teacher)).send({ date: today, entries: [{ studentId: otherStudentId, status: 'PRESENT' }] }).expect(400);

    const subjects = await http().get(`/school/classes/${classA}/assessments`).set(auth(teacher)).expect(200);
    const maths = subjects.body.subjects[0];
    expect(maths.canEdit).toBe(true);
    const test = await http().post('/school/assessments').set(auth(teacher)).send({ classSubjectId: maths.classSubjectId, title: 'Fractions test', type: 'TEST', maxScore: 20, topics: ['fractions'], heldOn: today }).expect(201);
    await http().put(`/school/assessments/${test.body.id}/results`).set(auth(teacher)).send({ results: [{ studentId, score: 25 }] }).expect(400);
    await http().put(`/school/assessments/${test.body.id}/results`).set(auth(teacher)).send({ results: [{ studentId, score: 17 }] }).expect(200);

    const broadsheet = await http().get(`/school/classes/${classA}/broadsheet`).set(auth(teacher)).expect(200);
    expect(broadsheet.body.rows[0].scores.Mathematics).toBe(85);
    expect(broadsheet.body.rows[0].position).toBe(1);

    await http().post(`/school/students/${studentId}/notes`).set(auth(teacher)).send({ category: 'ACHIEVEMENT', body: 'Explained equivalent fractions to the class.', visibleToParent: true }).expect(201);
    const detail = await http().get(`/school/students/${studentId}`).set(auth(teacher)).expect(200);
    expect(detail.body.attendance.present).toBe(1);
    expect(detail.body.results[0].score).toBe(17);
    expect(detail.body.invoices).toEqual([]); // teachers don't see fees
  });

  it('the bursar bills the term; the parent pays part in the app and the school records cash for the rest', async () => {
    const overview = await http().get('/school').set(auth(owner)).expect(200);
    const termId = overview.body.term.id;
    const bill = await http()
      .post('/school/fees')
      .set(auth(owner))
      .send({ termId, classIds: [classA, classB], items: [{ label: 'Tuition', amountKobo: 15_000_000 }, { label: 'Books', amountKobo: 2_500_000 }], dueDate: today })
      .expect(201);
    expect(bill.body.created).toBe(2);
    const again = await http().post('/school/fees').set(auth(owner)).send({ termId, classIds: [classA], items: [{ label: 'Tuition', amountKobo: 100 }], dueDate: today }).expect(201);
    expect(again.body.created).toBe(0); // one invoice per child per term
    await http().get('/school/fees').set(auth(teacher)).expect(403);

    // The parent signs in (we set their password the way the invite email would) and sees the bill.
    const code = '123456';
    const parentUser = await prisma.user.findUniqueOrThrow({ where: { email: `ngozi.obi.${stamp}@test.ng` } });
    const { createHash } = await import('node:crypto');
    await prisma.passwordReset.create({ data: { userId: parentUser.id, tokenHash: createHash('sha256').update(`${parentUser.id}:${code}`).digest('hex'), expiresAt: new Date(Date.now() + 60_000) } });
    parent = (await http().post('/auth/reset-password').send({ identifier: `ngozi.obi.${stamp}@test.ng`, code, password: 'parent-pass-1' }).expect(200)).body.accessToken;

    const invoices = await http().get(`/parent/children/${studentId}/invoices`).set(auth(parent)).expect(200);
    expect(invoices.body).toHaveLength(1);
    invoiceId = invoices.body[0].id;
    expect(invoices.body[0].totalKobo).toBe('17500000');
    await http().get(`/parent/children/${otherStudentId}/invoices`).set(auth(parent)).expect(404);

    await http().post(`/parent/invoices/${invoiceId}/pay`).set(auth(parent)).send({ amountKobo: 50_000 }).expect(400); // under ₦1,000
    const pay = await http().post(`/parent/invoices/${invoiceId}/pay`).set(auth(parent)).send({ amountKobo: 10_000_000 }).expect(201);
    await http().post(`/payments/${pay.body.reference}/verify`).set(auth(parent)).expect(200);

    const fees = await http().get('/school/fees').set(auth(owner)).expect(200);
    const mine = fees.body.invoices.find((i: { id: string }) => i.id === invoiceId);
    expect(mine.status).toBe('PART_PAID');
    expect(mine.paidKobo).toBe('10000000');

    // Online money is owed to the school, attributed for revenue share.
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { schoolId_type: { schoolId, type: 'SCHOOL_REVENUE' } } });
    expect(wallet.balanceKobo).toBe(10_000_000n);

    await http().post(`/school/fees/${invoiceId}/payments`).set(auth(owner)).send({ amountKobo: 9_000_000, method: 'CASH' }).expect(400); // more than owed
    const cash = await http().post(`/school/fees/${invoiceId}/payments`).set(auth(owner)).send({ amountKobo: 7_500_000, method: 'CASH' }).expect(200);
    expect(cash.body.status).toBe('PAID');
    const after = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(after.balanceKobo).toBe(10_000_000n); // cash went straight to the school, not through Nexus
  });

  it('Overwatch sets the agreement privately and calculates the school’s share', async () => {
    await http().post(`/admin/schools/${schoolId}/agreements`).set(auth(admin)).send({ planName: 'Standard', revenueShareBp: 2000, sharedStreams: ['SCHOOL_FEES', 'TUTORING'], startsAt: `${year}-01-01` }).expect(400);
    await http().post(`/admin/schools/${schoolId}/agreements`).set(auth(admin)).send({ planName: 'Standard', revenueShareBp: 2000, sharedStreams: ['SCHOOL_FEES'], startsAt: `${year}-01-01` }).expect(201);
    const st = await http().post(`/admin/schools/${schoolId}/statements`).set(auth(admin)).send({ from: `${year}-01-01`, to: `${year + 1}-01-01` }).expect(200);
    expect(st.body.grossKobo).toBe('10000000');
    expect(st.body.schoolKobo).toBe('2000000');

    // Schools never see the agreement through their own API.
    const ov = await http().get('/school').set(auth(owner)).expect(200);
    expect(JSON.stringify(ov.body)).not.toMatch(/revenueShare|agreement/i);
    await http().get(`/admin/schools/${schoolId}`).set(auth(owner)).expect(403);

    await http().patch(`/admin/schools/${schoolId}`).set(auth(admin)).send({ status: 'SUSPENDED' }).expect(200);
    const relog = await http().post('/auth/login').send({ identifier: `bisi.${stamp}@test.ng`, password: 'owner-pass-1' }).expect(200);
    await http().get('/school').set(auth(relog.body.accessToken)).expect(403);
    await http().patch(`/admin/schools/${schoolId}`).set(auth(admin)).send({ status: 'ACTIVE' }).expect(200);
  });
});
