import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, type OnApplicationBootstrap } from '@nestjs/common';
import type { ExamBody } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { EXAM_BODIES, EXAM_CATALOG } from './exam-catalog.js';

export type ChosenExam = { exam: ExamBody; targetYear: number | null; subjects: { id: string; slug: string; name: string }[] };

@Injectable()
export class ExamsService implements OnApplicationBootstrap {
  private readonly log = new Logger(ExamsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Keeps ExamSubject in step with the catalog. Subjects dropped from the catalog are hidden, never deleted. */
  async onApplicationBootstrap() {
    for (const exam of EXAM_BODIES) {
      const { subjects, compulsory } = EXAM_CATALOG[exam];
      for (const sub of subjects) {
        const data = { name: sub.name, isCompulsory: compulsory.includes(sub.slug), mockQuestions: sub.mockQuestions ?? null, isActive: true };
        await this.prisma.examSubject.upsert({ where: { exam_slug: { exam, slug: sub.slug } }, create: { exam, slug: sub.slug, ...data }, update: data });
      }
      const { count } = await this.prisma.examSubject.updateMany({ where: { exam, slug: { notIn: subjects.map((x) => x.slug) }, isActive: true }, data: { isActive: false } });
      if (count) this.log.log(`${exam}: hid ${count} subjects no longer in the catalog`);
    }
  }

  /** Every exam with its subjects and rules, for the pickers. */
  async catalog() {
    const rows = await this.prisma.examSubject.findMany({ where: { isActive: true } });
    return EXAM_BODIES.map((exam) => {
      const rules = EXAM_CATALOG[exam];
      const bySlug = new Map(rows.filter((r) => r.exam === exam).map((r) => [r.slug, r]));
      const subjects = rules.subjects.flatMap((x) => {
        const row = bySlug.get(x.slug);
        return row ? [{ id: row.id, slug: row.slug, name: row.name, compulsory: row.isCompulsory }] : [];
      });
      return {
        exam,
        label: rules.label,
        fullName: rules.fullName,
        level: rules.level,
        pick: rules.pick,
        fridayMock: rules.fridayMock,
        subjects,
        courses: (rules.courses ?? []).map((c) => ({ course: c.course, subjectIds: c.subjects.map((slug) => bySlug.get(slug)?.id).filter(Boolean) })),
      };
    });
  }

  async studentByUser(userId: string) {
    const p = await this.prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!p) throw new ForbiddenException('This account is not a student account.');
    return p.id;
  }

  /** Throws unless this parent is confirmed as the child's guardian. */
  async assertGuardian(parentId: string, studentId: string) {
    const link = await this.prisma.guardianship.findFirst({ where: { parentId, studentId, confirmedAt: { not: null } }, select: { id: true } });
    if (!link) throw new NotFoundException('Child not found on your account.');
  }

  async chosen(studentId: string): Promise<ChosenExam[]> {
    const exams = await this.prisma.studentExam.findMany({
      where: { studentId },
      orderBy: { createdAt: 'asc' },
      include: { subjects: { include: { examSubject: true } } },
    });
    return exams.map((e) => {
      const order = EXAM_CATALOG[e.exam].subjects.map((x) => x.slug);
      return {
        exam: e.exam,
        targetYear: e.targetYear,
        subjects: e.subjects
          .map(({ examSubject: x }) => ({ id: x.id, slug: x.slug, name: x.name }))
          .sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug)),
      };
    });
  }

  /** Sets (or replaces) a student's subject combination for one exam, enforcing that exam's rules. */
  async choose(studentId: string, exam: ExamBody, subjectIds: string[], targetYear?: number | null) {
    const rules = EXAM_CATALOG[exam];
    if (!rules) throw new BadRequestException('We don’t prepare for that exam yet.');
    const student = await this.prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId }, select: { level: true } });
    if (student.level !== rules.level) {
      const who = { NURSERY: 'nursery pupils', PRIMARY: 'primary school pupils', JUNIOR_SECONDARY: 'junior secondary students', SENIOR_SECONDARY: 'senior secondary students' }[rules.level];
      throw new BadRequestException(`${rules.label} is for ${who}.`);
    }
    const ids = [...new Set(subjectIds)];
    const subjects = await this.prisma.examSubject.findMany({ where: { id: { in: ids }, exam, isActive: true } });
    if (subjects.length !== ids.length) throw new BadRequestException(`Some of those subjects aren’t ${rules.label} subjects.`);

    const slugs = new Set(subjects.map((x) => x.slug));
    const missing = rules.compulsory.filter((slug) => !slugs.has(slug));
    if (missing.length) {
      const names = rules.subjects.filter((x) => missing.includes(x.slug)).map((x) => x.name);
      throw new BadRequestException(`${names.join(' and ')} ${names.length === 1 ? 'is' : 'are'} compulsory for ${rules.label}.`);
    }
    const { min, max } = rules.pick;
    if (ids.length < min || ids.length > max) {
      throw new BadRequestException(
        min === max
          ? `${rules.label} needs exactly ${max} subjects: ${rules.compulsory.length === 1 ? 'English plus 3 others' : `${max} in total`}.`
          : `Choose between ${min} and ${max} subjects for ${rules.label}.`,
      );
    }
    const thisYear = new Date().getFullYear();
    if (targetYear != null && (targetYear < thisYear || targetYear > thisYear + 6)) throw new BadRequestException('Choose a year from now to six years ahead.');

    await this.prisma.$transaction(async (tx) => {
      const row = await tx.studentExam.upsert({
        where: { studentId_exam: { studentId, exam } },
        create: { studentId, exam, targetYear: targetYear ?? null },
        update: { targetYear: targetYear ?? null },
      });
      await tx.studentExamSubject.deleteMany({ where: { studentExamId: row.id } });
      await tx.studentExamSubject.createMany({ data: ids.map((examSubjectId) => ({ studentExamId: row.id, examSubjectId })) });
    });
    return this.chosen(studentId);
  }

  async drop(studentId: string, exam: ExamBody) {
    await this.prisma.studentExam.deleteMany({ where: { studentId, exam } });
    return this.chosen(studentId);
  }
}
