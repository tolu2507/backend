import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { EducationLevel, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';

import { addDays, lagosDay, weekStart } from '../common/dates.js';
import { esc } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InvitesService } from './invites.service.js';
import { requireAdmin, type SchoolActor } from './school.context.js';
import type { AcademicYearDto, ClassDto, ClassSubjectsDto, InviteStaffDto, ParentInputDto, SchoolProfileDto, StudentDto, UpdateStudentDto } from './school.dto.js';

type Tx = Prisma.TransactionClient;
const day = (iso: string) => lagosDay(new Date(iso));
const className = (c: { gradeName: string; armName: string | null }) => (c.armName ? `${c.gradeName} ${c.armName}` : c.gradeName);
/** PINs kids can remember that aren't trivially guessable. */
const WEAK_PINS = new Set(['0000', '1111', '1234', '4321', '2222', '9999', '1212', '0123']);

@Injectable()
export class SchoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invites: InvitesService,
  ) {}

  // ── Overview ────────────────────────────────────────────

  async currentTerm(schoolId: string) {
    const today = lagosDay();
    const year = await this.prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, include: { terms: { orderBy: { startDate: 'asc' } } } });
    if (!year) return { year: null, term: null };
    const term = year.terms.find((t) => t.startDate <= today && t.endDate >= today) ?? year.terms.filter((t) => t.startDate <= today).at(-1) ?? year.terms[0] ?? null;
    return { year, term };
  }

  /** Classes a teacher teaches or is form teacher of. Admins see every class. */
  async visibleClassIds(a: SchoolActor): Promise<string[] | null> {
    if (a.isAdmin) return null;
    const classes = await this.prisma.class.findMany({
      where: { schoolId: a.schoolId, OR: [{ formTeacherId: a.userId }, { subjects: { some: { teacherId: a.userId } } }] },
      select: { id: true },
    });
    return classes.map((c) => c.id);
  }

  async assertClass(a: SchoolActor, classId: string) {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, schoolId: a.schoolId } });
    if (!cls) throw new NotFoundException('Class not found.');
    const visible = await this.visibleClassIds(a);
    if (visible && !visible.includes(classId)) throw new ForbiddenException('You don’t teach this class.');
    return cls;
  }

  async overview(a: SchoolActor) {
    const school = await this.prisma.school.findUniqueOrThrow({ where: { id: a.schoolId } });
    const { year, term } = await this.currentTerm(a.schoolId);
    const visible = await this.visibleClassIds(a);
    const classFilter = visible ? { classId: { in: visible } } : {};
    const today = lagosDay();
    const week = weekStart();

    const [students, staff, classes, todayAttendance, invoices, reports, setup] = await Promise.all([
      this.prisma.enrollment.count({ where: { academicYearId: year?.id ?? '-', ...classFilter } }),
      this.prisma.membership.count({ where: { schoolId: a.schoolId, role: { in: ['SCHOOL_ADMIN', 'TEACHER'] }, status: { in: ['ACTIVE', 'INVITED'] } } }),
      this.prisma.class.count({ where: { schoolId: a.schoolId, ...(visible ? { id: { in: visible } } : {}) } }),
      this.prisma.attendance.groupBy({ by: ['status'], where: { date: today, class: { schoolId: a.schoolId }, ...classFilter }, _count: true }),
      a.isAdmin && term
        ? this.prisma.feeInvoice.aggregate({ where: { schoolId: a.schoolId, termId: term.id, status: { not: 'VOID' } }, _sum: { totalKobo: true, paidKobo: true }, _count: true })
        : null,
      this.prisma.weeklyReport.count({ where: { weekStart: week, status: 'READY', student: { schoolId: a.schoolId } } }),
      Promise.all([this.prisma.subject.count({ where: { schoolId: a.schoolId } }), this.prisma.classSubject.count({ where: { class: { schoolId: a.schoolId } } })]),
    ]);
    const marked = todayAttendance.reduce((n, g) => n + g._count, 0);
    const present = todayAttendance.filter((g) => g.status === 'PRESENT' || g.status === 'LATE').reduce((n, g) => n + g._count, 0);

    return {
      school: { id: school.id, name: school.name, status: school.status, logoUrl: school.logoUrl, brandColor: school.brandColor, address: school.address, state: school.state, lga: school.lga, email: school.email, phone: school.phone },
      me: { role: a.role, isAdmin: a.isAdmin },
      year: year ? { id: year.id, name: year.name } : null,
      term: term ? { id: term.id, name: term.name, startDate: term.startDate, endDate: term.endDate } : null,
      counts: { students, staff, classes },
      attendanceToday: { marked, present },
      fees: invoices ? { invoices: invoices._count, billedKobo: invoices._sum.totalKobo ?? 0n, paidKobo: invoices._sum.paidKobo ?? 0n } : null,
      reportsThisWeek: reports,
      setup: { hasYear: !!year, hasSubjects: setup[0] > 0, hasClasses: classes > 0, hasClassSubjects: setup[1] > 0, hasStudents: students > 0 },
    };
  }

  // ── School profile & calendar ───────────────────────────

  async updateProfile(a: SchoolActor, dto: SchoolProfileDto) {
    requireAdmin(a);
    return this.prisma.school.update({ where: { id: a.schoolId }, data: dto });
  }

  async years(a: SchoolActor) {
    return this.prisma.academicYear.findMany({ where: { schoolId: a.schoolId }, include: { terms: { orderBy: { startDate: 'asc' } } }, orderBy: { startDate: 'desc' } });
  }

  async createYear(a: SchoolActor, dto: AcademicYearDto) {
    requireAdmin(a);
    const terms = dto.terms.map((t) => ({ name: t.name, startDate: day(t.startDate), endDate: day(t.endDate) })).sort((x, y) => +x.startDate - +y.startDate);
    for (const t of terms) if (t.endDate <= t.startDate) throw new BadRequestException(`The ${t.name.toLowerCase()} term must end after it starts.`);
    for (let i = 1; i < terms.length; i++) if (terms[i].startDate <= terms[i - 1].endDate) throw new BadRequestException('Terms can’t overlap.');
    if (new Set(terms.map((t) => t.name)).size !== terms.length) throw new BadRequestException('Each term can only be added once.');
    if (await this.prisma.academicYear.findUnique({ where: { schoolId_name: { schoolId: a.schoolId, name: dto.name } } })) throw new ConflictException(`${dto.name} already exists.`);

    const makeCurrent = dto.makeCurrent ?? !(await this.prisma.academicYear.count({ where: { schoolId: a.schoolId, isCurrent: true } }));
    return this.prisma.$transaction(async (tx) => {
      if (makeCurrent) await tx.academicYear.updateMany({ where: { schoolId: a.schoolId }, data: { isCurrent: false } });
      return tx.academicYear.create({
        data: { schoolId: a.schoolId, name: dto.name, startDate: terms[0].startDate, endDate: terms.at(-1)!.endDate, isCurrent: makeCurrent, terms: { create: terms } },
        include: { terms: true },
      });
    });
  }

  /** Starting a new session: students keep their class until promoted, so their enrolment moves with it. */
  async setCurrentYear(a: SchoolActor, yearId: string) {
    requireAdmin(a);
    const year = await this.prisma.academicYear.findFirst({ where: { id: yearId, schoolId: a.schoolId } });
    if (!year) throw new NotFoundException('Session not found.');
    await this.prisma.$transaction([
      this.prisma.academicYear.updateMany({ where: { schoolId: a.schoolId }, data: { isCurrent: false } }),
      this.prisma.academicYear.update({ where: { id: yearId }, data: { isCurrent: true } }),
    ]);
    return { ok: true };
  }

  // ── Subjects & classes ──────────────────────────────────

  subjects(a: SchoolActor) {
    return this.prisma.subject.findMany({ where: { schoolId: a.schoolId }, orderBy: { name: 'asc' } });
  }

  async addSubjects(a: SchoolActor, names: string[]) {
    requireAdmin(a);
    const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
    await this.prisma.subject.createMany({ data: clean.map((name) => ({ schoolId: a.schoolId, name })), skipDuplicates: true });
    return this.subjects(a);
  }

  async removeSubject(a: SchoolActor, id: string) {
    requireAdmin(a);
    const used = await this.prisma.classSubject.count({ where: { subjectId: id, class: { schoolId: a.schoolId } } });
    if (used) throw new BadRequestException('Remove this subject from its classes first.');
    await this.prisma.subject.deleteMany({ where: { id, schoolId: a.schoolId } });
    return { ok: true };
  }

  async classes(a: SchoolActor) {
    const visible = await this.visibleClassIds(a);
    const { year } = await this.currentTerm(a.schoolId);
    const rows = await this.prisma.class.findMany({
      where: { schoolId: a.schoolId, ...(visible ? { id: { in: visible } } : {}) },
      include: {
        formTeacher: { select: { id: true, firstName: true, lastName: true } },
        subjects: { include: { subject: true, teacher: { select: { id: true, firstName: true, lastName: true } } } },
        _count: { select: { enrollments: { where: { academicYearId: year?.id ?? '-' } } } },
      },
    });
    const levelOrder: EducationLevel[] = ['NURSERY', 'PRIMARY', 'JUNIOR_SECONDARY', 'SENIOR_SECONDARY'];
    return rows
      .sort((x, y) => levelOrder.indexOf(x.level) - levelOrder.indexOf(y.level) || x.gradeName.localeCompare(y.gradeName, 'en', { numeric: true }) || (x.armName ?? '').localeCompare(y.armName ?? ''))
      .map((c) => ({
        id: c.id,
        name: className(c),
        level: c.level,
        gradeName: c.gradeName,
        armName: c.armName,
        formTeacher: c.formTeacher,
        studentCount: c._count.enrollments,
        subjects: c.subjects.map((s) => ({ id: s.id, subjectId: s.subjectId, name: s.subject.name, teacher: s.teacher })),
      }));
  }

  private async assertStaff(schoolId: string, userId: string | null | undefined) {
    if (!userId) return;
    const m = await this.prisma.membership.findFirst({ where: { userId, schoolId, role: { in: ['SCHOOL_OWNER', 'SCHOOL_ADMIN', 'TEACHER'] } } });
    if (!m) throw new BadRequestException('That teacher isn’t on your staff list.');
  }

  async saveClass(a: SchoolActor, dto: ClassDto, id?: string) {
    requireAdmin(a);
    await this.assertStaff(a.schoolId, dto.formTeacherId);
    const data = { level: dto.level, gradeName: dto.gradeName, armName: dto.armName || null, formTeacherId: dto.formTeacherId ?? null };
    const clash = await this.prisma.class.findFirst({ where: { schoolId: a.schoolId, gradeName: data.gradeName, armName: data.armName, ...(id ? { NOT: { id } } : {}) } });
    if (clash) throw new ConflictException(`${className(data)} already exists.`);
    if (id) {
      const res = await this.prisma.class.updateMany({ where: { id, schoolId: a.schoolId }, data });
      if (!res.count) throw new NotFoundException('Class not found.');
      return { id };
    }
    const c = await this.prisma.class.create({ data: { schoolId: a.schoolId, ...data } });
    return { id: c.id };
  }

  async deleteClass(a: SchoolActor, id: string) {
    requireAdmin(a);
    const students = await this.prisma.enrollment.count({ where: { classId: id } });
    if (students) throw new BadRequestException('Move the students to another class first.');
    await this.prisma.class.deleteMany({ where: { id, schoolId: a.schoolId } });
    return { ok: true };
  }

  /** Replaces the class's subject list (and who teaches each). Subjects with saved scores are kept. */
  async setClassSubjects(a: SchoolActor, classId: string, dto: ClassSubjectsDto) {
    requireAdmin(a);
    await this.assertClass(a, classId);
    for (const s of dto.subjects) await this.assertStaff(a.schoolId, s.teacherId);
    const subjects = await this.prisma.subject.findMany({ where: { schoolId: a.schoolId, id: { in: dto.subjects.map((s) => s.subjectId) } } });
    if (subjects.length !== new Set(dto.subjects.map((s) => s.subjectId)).size) throw new BadRequestException('One of those subjects doesn’t exist.');

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.classSubject.findMany({ where: { classId }, include: { _count: { select: { assessments: true } } } });
      const keep = new Set(dto.subjects.map((s) => s.subjectId));
      const blocked = existing.filter((e) => !keep.has(e.subjectId) && e._count.assessments > 0);
      if (blocked.length) throw new BadRequestException('A subject with recorded scores can’t be removed from the class.');
      await tx.classSubject.deleteMany({ where: { classId, subjectId: { notIn: [...keep] } } });
      for (const s of dto.subjects) {
        await tx.classSubject.upsert({
          where: { classId_subjectId: { classId, subjectId: s.subjectId } },
          update: { teacherId: s.teacherId ?? null },
          create: { classId, subjectId: s.subjectId, teacherId: s.teacherId ?? null },
        });
      }
    });
    return { ok: true };
  }

  // ── Staff ───────────────────────────────────────────────

  async staff(a: SchoolActor) {
    const rows = await this.prisma.membership.findMany({
      where: { schoolId: a.schoolId, role: { in: ['SCHOOL_OWNER', 'SCHOOL_ADMIN', 'TEACHER', 'TUCK_SHOP'] }, status: { not: 'LEFT' } },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, lastLoginAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({ membershipId: m.id, role: m.role, status: m.status, ...m.user, hasSignedIn: !!m.user.lastLoginAt }));
  }

  async inviteStaff(a: SchoolActor, dto: InviteStaffDto) {
    requireAdmin(a);
    if (dto.role === 'SCHOOL_ADMIN' && a.role !== 'SCHOOL_OWNER') throw new ForbiddenException('Only the school owner can add administrators.');
    const school = await this.prisma.school.findUniqueOrThrow({ where: { id: a.schoolId } });
    let user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user && dto.phone && (await this.prisma.user.findUnique({ where: { phone: dto.phone } }))) {
      throw new ConflictException('That phone number belongs to another account. Leave it empty or use theirs.');
    }
    user ??= await this.prisma.user.create({ data: { firstName: dto.firstName, lastName: dto.lastName, email: dto.email, phone: dto.phone } });
    const existing = await this.prisma.membership.findFirst({ where: { userId: user.id, schoolId: a.schoolId, role: dto.role } });
    if (existing && existing.status !== 'LEFT') throw new ConflictException(`${user.firstName} is already on your staff.`);
    if (existing) await this.prisma.membership.update({ where: { id: existing.id }, data: { status: 'ACTIVE' } });
    else await this.prisma.membership.create({ data: { userId: user.id, schoolId: a.schoolId, role: dto.role } });

    // People who already have a password just sign in; new people get a code to set one.
    const result = user.passwordHash ? { sent: false, code: undefined as string | undefined, hasAccount: true } : { ...(await this.invites.invite(user.id, { schoolName: school.name, role: dto.role === 'TUCK_SHOP' ? 'app' : 'staff' })), hasAccount: false };
    return { userId: user.id, inviteSent: result.sent, hasAccount: result.hasAccount, code: result.sent ? undefined : result.code };
  }

  async resendInvite(a: SchoolActor, membershipId: string) {
    requireAdmin(a);
    const m = await this.prisma.membership.findFirst({ where: { id: membershipId, schoolId: a.schoolId }, include: { user: true, school: true } });
    if (!m) throw new NotFoundException('Staff member not found.');
    if (m.user.passwordHash) return { inviteSent: false, hasAccount: true };
    const r = await this.invites.invite(m.userId, { schoolName: m.school!.name, role: m.role === 'TUCK_SHOP' ? 'app' : 'staff' });
    return { inviteSent: r.sent, hasAccount: false, code: r.sent ? undefined : r.code };
  }

  async removeStaff(a: SchoolActor, membershipId: string) {
    requireAdmin(a);
    const m = await this.prisma.membership.findFirst({ where: { id: membershipId, schoolId: a.schoolId } });
    if (!m) throw new NotFoundException('Staff member not found.');
    if (m.role === 'SCHOOL_OWNER') throw new BadRequestException('The school owner can’t be removed.');
    if (m.userId === a.userId) throw new BadRequestException('You can’t remove yourself.');
    await this.prisma.$transaction([
      this.prisma.membership.update({ where: { id: m.id }, data: { status: 'LEFT' } }),
      this.prisma.class.updateMany({ where: { schoolId: a.schoolId, formTeacherId: m.userId }, data: { formTeacherId: null } }),
      this.prisma.classSubject.updateMany({ where: { class: { schoolId: a.schoolId }, teacherId: m.userId }, data: { teacherId: null } }),
    ]);
    return { ok: true };
  }

  // ── Students ────────────────────────────────────────────

  async students(a: SchoolActor, q: { classId?: string; search?: string }) {
    const { year } = await this.currentTerm(a.schoolId);
    if (!year) return [];
    const visible = await this.visibleClassIds(a);
    if (q.classId) await this.assertClass(a, q.classId);
    const search = q.search?.trim();
    const rows = await this.prisma.enrollment.findMany({
      where: {
        academicYearId: year.id,
        ...(q.classId ? { classId: q.classId } : visible ? { classId: { in: visible } } : {}),
        ...(search
          ? { student: { OR: [{ admissionNo: { contains: search, mode: 'insensitive' } }, { user: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } }] } }
          : {}),
      },
      include: { class: true, student: { include: { user: true, guardians: { include: { parent: { select: { firstName: true, lastName: true, email: true, phone: true } } } } } } },
      take: 500,
    });
    return rows
      .map((e) => ({
        id: e.student.id,
        firstName: e.student.user.firstName,
        lastName: e.student.user.lastName,
        admissionNo: e.student.admissionNo,
        username: e.student.user.username,
        className: className(e.class),
        classId: e.classId,
        parents: e.student.guardians.map((g) => ({ name: `${g.parent.firstName} ${g.parent.lastName}`, email: g.parent.email, phone: g.parent.phone })),
      }))
      .sort((x, y) => x.className.localeCompare(y.className, 'en', { numeric: true }) || x.lastName.localeCompare(y.lastName));
  }

  private async uniqueUsername(tx: Tx, first: string, last: string) {
    const base = `${first}${last[0] ?? ''}`.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'student';
    for (let i = 0; i < 20; i++) {
      const name = `${base}${randomInt(10, 1000)}`;
      if (!(await tx.user.findUnique({ where: { username: name } }))) return name;
    }
    throw new ConflictException('Couldn’t create a username. Try again.');
  }

  private pin() {
    let p: string;
    do p = String(randomInt(0, 10000)).padStart(4, '0');
    while (WEAK_PINS.has(p));
    return p;
  }

  /** Finds the parent by email or phone, or creates their account. Returns whether they're new. */
  private async parentAccount(tx: Tx, p: ParentInputDto) {
    if (!p.email && !p.phone) throw new BadRequestException(`Add an email or phone number for ${p.firstName}.`);
    const found = await tx.user.findFirst({ where: { OR: [...(p.email ? [{ email: p.email }] : []), ...(p.phone ? [{ phone: p.phone }] : [])] } });
    if (found) {
      // Platform-wide roles have schoolId NULL, which a unique lookup can't match, so check first.
      if (!(await tx.membership.findFirst({ where: { userId: found.id, role: 'PARENT', schoolId: null } }))) await tx.membership.create({ data: { userId: found.id, role: 'PARENT' } });
      return { user: found, isNew: false };
    }
    const user = await tx.user.create({ data: { firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone, memberships: { create: { role: 'PARENT' } } } });
    return { user, isNew: true };
  }

  /** Enrols one student: their login (username + PIN), their class this session, and their parent. */
  async addStudent(a: SchoolActor, dto: StudentDto, opts: { notify?: boolean } = {}) {
    requireAdmin(a);
    const { year } = await this.currentTerm(a.schoolId);
    if (!year) throw new BadRequestException('Set up the current session (e.g. 2026/2027) in Settings first.');
    const cls = await this.prisma.class.findFirst({ where: { id: dto.classId, schoolId: a.schoolId } });
    if (!cls) throw new BadRequestException('Choose one of your classes.');
    if (dto.admissionNo && (await this.prisma.studentProfile.findFirst({ where: { schoolId: a.schoolId, admissionNo: dto.admissionNo } }))) {
      throw new ConflictException(`Admission number ${dto.admissionNo} is already used.`);
    }
    const pin = this.pin();
    const created = await this.prisma.$transaction(async (tx) => {
      const username = await this.uniqueUsername(tx, dto.firstName, dto.lastName);
      const user = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          otherNames: dto.otherNames || null,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          username,
          pinHash: await bcrypt.hash(pin, 10),
          memberships: { create: { role: 'STUDENT', schoolId: a.schoolId } },
        },
      });
      const profile = await tx.studentProfile.create({ data: { userId: user.id, schoolId: a.schoolId, admissionNo: dto.admissionNo || null, level: cls.level, gradeName: cls.gradeName } });
      await tx.enrollment.create({ data: { studentId: profile.id, classId: cls.id, academicYearId: year.id } });
      await tx.wallet.create({ data: { userId: user.id, type: 'STUDENT_SPEND' } });
      let parent: { id: string; isNew: boolean } | null = null;
      if (dto.parent) {
        const p = await this.parentAccount(tx, dto.parent);
        await tx.guardianship.create({ data: { parentId: p.user.id, studentId: profile.id, relationship: dto.parent.relationship ?? 'GUARDIAN', isPrimary: true, verifiedAt: new Date() } });
        parent = { id: p.user.id, isNew: p.isNew };
      }
      return { profile, username, parent };
    });

    let parentInvite: { sent: boolean } | null = null;
    if (created.parent && opts.notify !== false) parentInvite = await this.notifyParent(a.schoolId, created.parent.id, created.parent.isNew, `${dto.firstName} ${dto.lastName}`, created.username, pin);
    return { id: created.profile.id, username: created.username, pin, parentInvited: parentInvite?.sent ?? false };
  }

  /** New parents get a code to set their password; existing ones just learn their child was added. */
  private async notifyParent(schoolId: string, parentId: string, isNew: boolean, childName: string, username: string, pin: string) {
    const school = await this.prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    const extra = {
      text: `${childName} can sign in to the Nexus app with username ${username} and PIN ${pin}. You can change the PIN in your app.\n\nIn the app, open Privacy to switch on weekly AI progress reports for ${childName}.`,
      html: `<p style="background:#F4F2FF;padding:12px;border-radius:12px"><b>${esc(childName)}</b> signs in with username <b>${username}</b> and PIN <b>${pin}</b>. You can change the PIN in your app.</p><p>Then open <b>Privacy</b> in the app to switch on weekly AI progress reports.</p>`,
    };
    if (isNew) return this.invites.invite(parentId, { schoolName: school.name, role: 'app', extra });
    return { sent: false };
  }

  async importStudents(a: SchoolActor, rows: StudentDto[]) {
    requireAdmin(a);
    const results: { row: number; ok: boolean; name: string; username?: string; pin?: string; error?: string }[] = [];
    for (const [i, row] of rows.entries()) {
      try {
        const r = await this.addStudent(a, row);
        results.push({ row: i + 1, ok: true, name: `${row.firstName} ${row.lastName}`, username: r.username, pin: r.pin });
      } catch (e) {
        results.push({ row: i + 1, ok: false, name: `${row.firstName} ${row.lastName}`, error: (e as Error).message });
      }
    }
    return { added: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  }

  private async assertStudent(a: SchoolActor, studentId: string) {
    const s = await this.prisma.studentProfile.findFirst({ where: { id: studentId, schoolId: a.schoolId }, include: { user: true } });
    if (!s) throw new NotFoundException('Student not found.');
    const visible = await this.visibleClassIds(a);
    if (visible) {
      const { year } = await this.currentTerm(a.schoolId);
      const e = await this.prisma.enrollment.findFirst({ where: { studentId, academicYearId: year?.id ?? '-' } });
      if (!e || !visible.includes(e.classId)) throw new ForbiddenException('This student isn’t in one of your classes.');
    }
    return s;
  }

  async student(a: SchoolActor, studentId: string) {
    const s = await this.assertStudent(a, studentId);
    const { year, term } = await this.currentTerm(a.schoolId);
    const [enrollment, guardians, attendance, results, notes, invoices, report] = await Promise.all([
      this.prisma.enrollment.findFirst({ where: { studentId, academicYearId: year?.id ?? '-' }, include: { class: true } }),
      this.prisma.guardianship.findMany({ where: { studentId }, include: { parent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, lastLoginAt: true } } } }),
      term ? this.prisma.attendance.groupBy({ by: ['status'], where: { studentId, date: { gte: term.startDate, lte: term.endDate } }, _count: true }) : [],
      term
        ? this.prisma.assessmentResult.findMany({ where: { studentId, assessment: { termId: term.id } }, include: { assessment: { include: { classSubject: { include: { subject: true } } } } }, orderBy: { assessment: { heldOn: 'desc' } } })
        : [],
      this.prisma.teacherNote.findMany({ where: { studentId }, include: { author: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 30 }),
      a.isAdmin ? this.prisma.feeInvoice.findMany({ where: { studentId }, include: { term: { include: { academicYear: true } } }, orderBy: { createdAt: 'desc' } }) : [],
      this.prisma.weeklyReport.findFirst({ where: { studentId, status: 'READY' }, orderBy: { weekStart: 'desc' } }),
    ]);
    const att = Object.fromEntries((attendance as { status: string; _count: number }[]).map((g) => [g.status, g._count]));
    return {
      id: s.id,
      firstName: s.user.firstName,
      lastName: s.user.lastName,
      otherNames: s.user.otherNames,
      username: s.user.username,
      admissionNo: s.admissionNo,
      level: s.level,
      class: enrollment ? { id: enrollment.classId, name: className(enrollment.class) } : null,
      xp: s.xpTotal,
      streak: s.currentStreak,
      parents: guardians.map((g) => ({ ...g.parent, relationship: g.relationship, hasSignedIn: !!g.parent.lastLoginAt })),
      attendance: { present: att.PRESENT ?? 0, late: att.LATE ?? 0, absent: att.ABSENT ?? 0, excused: att.EXCUSED ?? 0 },
      results: results.map((r) => ({
        id: r.id,
        subject: r.assessment.classSubject.subject.name,
        title: r.assessment.title,
        type: r.assessment.type,
        score: r.score,
        maxScore: r.assessment.maxScore,
        heldOn: r.assessment.heldOn,
      })),
      notes: notes.map((n) => ({ id: n.id, category: n.category, body: n.body, visibleToParent: n.visibleToParent, createdAt: n.createdAt, author: `${n.author.firstName} ${n.author.lastName}` })),
      invoices: invoices.map((i) => ({ id: i.id, term: `${i.term.academicYear.name} · ${i.term.name.toLowerCase()} term`, totalKobo: i.totalKobo, paidKobo: i.paidKobo, status: i.status, dueDate: i.dueDate })),
      latestReport: report ? { weekStart: report.weekStart, headline: report.headline, summary: report.summary } : null,
    };
  }

  async updateStudent(a: SchoolActor, studentId: string, dto: UpdateStudentDto) {
    requireAdmin(a);
    const s = await this.assertStudent(a, studentId);
    const { year } = await this.currentTerm(a.schoolId);
    await this.prisma.$transaction(async (tx) => {
      if (dto.firstName || dto.lastName) await tx.user.update({ where: { id: s.userId }, data: { firstName: dto.firstName, lastName: dto.lastName } });
      if (dto.admissionNo !== undefined) await tx.studentProfile.update({ where: { id: s.id }, data: { admissionNo: dto.admissionNo || null } });
      if (dto.classId && year) {
        const cls = await tx.class.findFirst({ where: { id: dto.classId, schoolId: a.schoolId } });
        if (!cls) throw new BadRequestException('Choose one of your classes.');
        await tx.enrollment.upsert({ where: { studentId_academicYearId: { studentId, academicYearId: year.id } }, update: { classId: cls.id }, create: { studentId, classId: cls.id, academicYearId: year.id } });
        await tx.studentProfile.update({ where: { id: s.id }, data: { level: cls.level, gradeName: cls.gradeName } });
      }
    });
    return { ok: true };
  }

  async resetStudentPin(a: SchoolActor, studentId: string) {
    requireAdmin(a);
    const s = await this.assertStudent(a, studentId);
    const pin = this.pin();
    await this.prisma.user.update({ where: { id: s.userId }, data: { pinHash: await bcrypt.hash(pin, 10) } });
    await this.prisma.refreshToken.updateMany({ where: { userId: s.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return { username: s.user.username, pin };
  }

  async addParent(a: SchoolActor, studentId: string, dto: ParentInputDto) {
    requireAdmin(a);
    const s = await this.assertStudent(a, studentId);
    const p = await this.prisma.$transaction(async (tx) => {
      const acc = await this.parentAccount(tx, dto);
      const linked = await tx.guardianship.findUnique({ where: { parentId_studentId: { parentId: acc.user.id, studentId } } });
      if (linked) throw new ConflictException('That parent is already linked.');
      await tx.guardianship.create({ data: { parentId: acc.user.id, studentId, relationship: dto.relationship ?? 'GUARDIAN', verifiedAt: new Date() } });
      return acc;
    });
    // Existing parents can see the child straight away; new ones get a code. The PIN isn't resent.
    const invite = p.isNew
      ? await this.invites.invite(p.user.id, { schoolName: (await this.prisma.school.findUniqueOrThrow({ where: { id: a.schoolId } })).name, role: 'app', extra: { text: `${s.user.firstName} is now linked to your account.`, html: `<p><b>${esc(s.user.firstName)}</b> is now linked to your account.</p>` } })
      : { sent: false };
    return { parentId: p.user.id, invited: invite.sent };
  }

  async unlinkParent(a: SchoolActor, studentId: string, parentId: string) {
    requireAdmin(a);
    await this.assertStudent(a, studentId);
    await this.prisma.guardianship.deleteMany({ where: { studentId, parentId } });
    return { ok: true };
  }

  /** Weekly report status for the school's students, so staff can see who's covered. */
  async reportStatus(a: SchoolActor) {
    const week = weekStart();
    const students = await this.students(a, {});
    const reports = await this.prisma.weeklyReport.findMany({ where: { weekStart: { gte: addDays(week, -7) }, studentId: { in: students.map((s) => s.id) } }, orderBy: { weekStart: 'desc' } });
    const consents = await this.prisma.consent.findMany({ where: { studentId: { in: students.map((s) => s.id) }, type: 'AI_REPORTS', revokedAt: null } });
    return students.map((s) => {
      const r = reports.find((x) => x.studentId === s.id);
      return {
        studentId: s.id,
        name: `${s.firstName} ${s.lastName}`,
        className: s.className,
        hasParent: s.parents.length > 0,
        consented: consents.some((c) => c.studentId === s.id),
        lastReport: r ? { weekStart: r.weekStart, status: r.status, headline: r.headline } : null,
      };
    });
  }
}
