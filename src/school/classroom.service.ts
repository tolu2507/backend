import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { lagosDay } from '../common/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SchoolActor } from './school.context.js';
import type { AssessmentDto, AttendanceDto, NoteDto, ResultsDto } from './school.dto.js';
import { SchoolService } from './school.service.js';

/** Day-to-day teaching records: attendance, scores and notes. These feed the weekly parent reports. */
@Injectable()
export class ClassroomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly school: SchoolService,
  ) {}

  private async roster(classId: string, schoolId: string) {
    const { year } = await this.school.currentTerm(schoolId);
    const rows = await this.prisma.enrollment.findMany({ where: { classId, academicYearId: year?.id ?? '-' }, include: { student: { include: { user: true } } } });
    return rows
      .map((e) => ({ id: e.studentId, firstName: e.student.user.firstName, lastName: e.student.user.lastName, admissionNo: e.student.admissionNo }))
      .sort((x, y) => x.lastName.localeCompare(y.lastName) || x.firstName.localeCompare(y.firstName));
  }

  // ── Attendance ──────────────────────────────────────────

  async attendance(a: SchoolActor, classId: string, date: string) {
    await this.school.assertClass(a, classId);
    const d = lagosDay(new Date(date));
    const [students, marks] = await Promise.all([this.roster(classId, a.schoolId), this.prisma.attendance.findMany({ where: { classId, date: d } })]);
    return {
      date: d,
      saved: marks.length > 0,
      students: students.map((s) => {
        const m = marks.find((x) => x.studentId === s.id);
        return { ...s, status: m?.status ?? null, note: m?.note ?? null };
      }),
    };
  }

  async saveAttendance(a: SchoolActor, classId: string, dto: AttendanceDto) {
    await this.school.assertClass(a, classId);
    const d = lagosDay(new Date(dto.date));
    if (d > lagosDay()) throw new BadRequestException('You can’t mark attendance for a future day.');
    const roster = new Set((await this.roster(classId, a.schoolId)).map((s) => s.id));
    const stray = dto.entries.find((e) => !roster.has(e.studentId));
    if (stray) throw new BadRequestException('One of those students isn’t in this class.');
    await this.prisma.$transaction(
      dto.entries.map((e) =>
        this.prisma.attendance.upsert({
          where: { studentId_date: { studentId: e.studentId, date: d } },
          update: { status: e.status, note: e.note ?? null, classId, recordedById: a.userId },
          create: { studentId: e.studentId, classId, date: d, status: e.status, note: e.note ?? null, recordedById: a.userId },
        }),
      ),
    );
    return { saved: dto.entries.length };
  }

  // ── Assessments & scores ────────────────────────────────

  /** Teachers manage scores for the subjects they teach; form teachers and admins for the whole class. */
  private async assertClassSubject(a: SchoolActor, classSubjectId: string) {
    const cs = await this.prisma.classSubject.findFirst({ where: { id: classSubjectId, class: { schoolId: a.schoolId } }, include: { class: true, subject: true } });
    if (!cs) throw new NotFoundException('Subject not found for this class.');
    if (!a.isAdmin && cs.teacherId !== a.userId && cs.class.formTeacherId !== a.userId) throw new ForbiddenException('You don’t teach this subject.');
    return cs;
  }

  async assessments(a: SchoolActor, classId: string) {
    await this.school.assertClass(a, classId);
    const { term } = await this.school.currentTerm(a.schoolId);
    if (!term) return { term: null, subjects: [] };
    const subjects = await this.prisma.classSubject.findMany({
      where: { classId },
      include: { subject: true, teacher: { select: { firstName: true, lastName: true } }, assessments: { where: { termId: term.id }, include: { _count: { select: { results: true } } }, orderBy: { heldOn: 'asc' } } },
      orderBy: { subject: { name: 'asc' } },
    });
    return {
      term: { id: term.id, name: term.name },
      subjects: subjects.map((s) => ({
        classSubjectId: s.id,
        name: s.subject.name,
        teacher: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : null,
        canEdit: a.isAdmin || s.teacherId === a.userId,
        assessments: s.assessments.map((x) => ({ id: x.id, title: x.title, type: x.type, maxScore: x.maxScore, weight: x.weight, heldOn: x.heldOn, topics: x.topics, resultCount: x._count.results })),
      })),
    };
  }

  async createAssessment(a: SchoolActor, dto: AssessmentDto) {
    await this.assertClassSubject(a, dto.classSubjectId);
    const { term } = await this.school.currentTerm(a.schoolId);
    if (!term) throw new BadRequestException('Set up the current session and terms in Settings first.');
    const x = await this.prisma.assessment.create({
      data: {
        classSubjectId: dto.classSubjectId,
        termId: term.id,
        title: dto.title,
        type: dto.type,
        maxScore: dto.maxScore,
        weight: dto.weight ?? 1,
        topics: (dto.topics ?? []).map((t) => t.trim()).filter(Boolean),
        heldOn: lagosDay(new Date(dto.heldOn)),
      },
    });
    return { id: x.id };
  }

  private async assertAssessment(a: SchoolActor, id: string) {
    const x = await this.prisma.assessment.findFirst({ where: { id, classSubject: { class: { schoolId: a.schoolId } } } });
    if (!x) throw new NotFoundException('Assessment not found.');
    const cs = await this.assertClassSubject(a, x.classSubjectId);
    return { ...x, classSubject: cs };
  }

  async scoreSheet(a: SchoolActor, id: string) {
    const x = await this.assertAssessment(a, id);
    const [students, results] = await Promise.all([this.roster(x.classSubject.classId, a.schoolId), this.prisma.assessmentResult.findMany({ where: { assessmentId: id } })]);
    return {
      assessment: { id: x.id, title: x.title, type: x.type, maxScore: x.maxScore, heldOn: x.heldOn, topics: x.topics, subject: x.classSubject.subject.name },
      students: students.map((s) => {
        const r = results.find((y) => y.studentId === s.id);
        return { ...s, score: r?.score ?? null, remark: r?.remark ?? null };
      }),
    };
  }

  async saveScores(a: SchoolActor, id: string, dto: ResultsDto) {
    const x = await this.assertAssessment(a, id);
    const roster = new Set((await this.roster(x.classSubject.classId, a.schoolId)).map((s) => s.id));
    for (const r of dto.results) {
      if (!roster.has(r.studentId)) throw new BadRequestException('One of those students isn’t in this class.');
      if (r.score > x.maxScore) throw new BadRequestException(`Scores can’t be more than ${x.maxScore}.`);
    }
    await this.prisma.$transaction(
      dto.results.map((r) =>
        this.prisma.assessmentResult.upsert({
          where: { assessmentId_studentId: { assessmentId: id, studentId: r.studentId } },
          update: { score: r.score, remark: r.remark ?? null },
          create: { assessmentId: id, studentId: r.studentId, score: r.score, remark: r.remark ?? null },
        }),
      ),
    );
    return { saved: dto.results.length };
  }

  async deleteAssessment(a: SchoolActor, id: string) {
    await this.assertAssessment(a, id);
    await this.prisma.assessment.delete({ where: { id } });
    return { ok: true };
  }

  /** End-of-term broadsheet: each student's weighted % per subject, their average and class position. */
  async broadsheet(a: SchoolActor, classId: string) {
    await this.school.assertClass(a, classId);
    const { term } = await this.school.currentTerm(a.schoolId);
    if (!term) return { term: null, subjects: [], rows: [] };
    const [students, subjects] = await Promise.all([
      this.roster(classId, a.schoolId),
      this.prisma.classSubject.findMany({ where: { classId }, include: { subject: true, assessments: { where: { termId: term.id }, include: { results: true } } }, orderBy: { subject: { name: 'asc' } } }),
    ]);
    const rows = students.map((s) => {
      const scores: Record<string, number | null> = {};
      for (const cs of subjects) {
        let got = 0;
        let possible = 0;
        for (const x of cs.assessments) {
          const r = x.results.find((y) => y.studentId === s.id);
          if (!r) continue;
          got += (r.score / x.maxScore) * x.weight;
          possible += x.weight;
        }
        scores[cs.subject.name] = possible ? Math.round((got / possible) * 1000) / 10 : null;
      }
      const vals = Object.values(scores).filter((v): v is number => v !== null);
      return { ...s, scores, average: vals.length ? Math.round((vals.reduce((n, v) => n + v, 0) / vals.length) * 10) / 10 : null, position: 0 };
    });
    const ranked = rows.filter((r) => r.average !== null).sort((x, y) => y.average! - x.average!);
    ranked.forEach((r, i) => (r.position = i > 0 && r.average === ranked[i - 1].average ? ranked[i - 1].position : i + 1));
    return { term: { id: term.id, name: term.name }, subjects: subjects.map((s) => s.subject.name), rows };
  }

  // ── Teacher notes ───────────────────────────────────────

  async addNote(a: SchoolActor, studentId: string, dto: NoteDto) {
    const s = await this.prisma.studentProfile.findFirst({ where: { id: studentId, schoolId: a.schoolId } });
    if (!s) throw new NotFoundException('Student not found.');
    // Reuses the class check: teachers only write notes for children they teach.
    await this.school.student(a, studentId);
    const n = await this.prisma.teacherNote.create({ data: { studentId, authorId: a.userId, category: dto.category, body: dto.body, visibleToParent: dto.visibleToParent ?? false } });
    return { id: n.id };
  }

  async deleteNote(a: SchoolActor, noteId: string) {
    const n = await this.prisma.teacherNote.findFirst({ where: { id: noteId, student: { schoolId: a.schoolId } } });
    if (!n) throw new NotFoundException('Note not found.');
    if (!a.isAdmin && n.authorId !== a.userId) throw new ForbiddenException('You can only delete your own notes.');
    await this.prisma.teacherNote.delete({ where: { id: noteId } });
    return { ok: true };
  }
}
