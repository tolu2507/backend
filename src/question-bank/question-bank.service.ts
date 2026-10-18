import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ExamBody, Prisma, QuestionOrigin, QuestionStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

export type QuestionFilter = {
  exam?: ExamBody;
  subjectId?: string;
  topicId?: string;
  status?: QuestionStatus;
  origin?: QuestionOrigin;
  difficulty?: number;
  reported?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type QuestionEdit = {
  stem?: string;
  options?: { id: string; label: string }[];
  answerId?: string;
  explanation?: string;
  difficulty?: number;
  topicId?: string;
};

/** Overwatch's view of the question bank: every question students can get, by exam, subject and topic. */
@Injectable()
export class QuestionBankService {
  constructor(private readonly prisma: PrismaService) {}

  /** One row per exam subject that has anything in it: question counts by status, topics and past questions analysed. */
  async summary() {
    const [subjects, byStatus, reports] = await Promise.all([
      this.prisma.examSubject.findMany({
        where: { isActive: true },
        select: { id: true, exam: true, name: true, _count: { select: { topics: true, pastQuestions: true } } },
        orderBy: [{ exam: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.examQuestion.groupBy({ by: ['examSubjectId', 'status'], _count: true }),
      this.prisma.questionReport.groupBy({ by: ['questionId'], where: { status: 'OPEN' }, _count: true }),
    ]);
    const counts = new Map<string, Record<QuestionStatus, number>>();
    for (const row of byStatus) {
      const c = counts.get(row.examSubjectId) ?? { DRAFT: 0, IN_REVIEW: 0, APPROVED: 0, RETIRED: 0 };
      c[row.status] = row._count;
      counts.set(row.examSubjectId, c);
    }
    return {
      openReports: reports.length,
      subjects: subjects.map((s) => ({
        id: s.id,
        exam: s.exam,
        name: s.name,
        topics: s._count.topics,
        pastQuestions: s._count.pastQuestions,
        questions: counts.get(s.id) ?? { DRAFT: 0, IN_REVIEW: 0, APPROVED: 0, RETIRED: 0 },
      })),
    };
  }

  /** A subject's topic tree, for the filter and for moving a question to another topic. */
  async topics(subjectId: string) {
    const rows = await this.prisma.syllabusTopic.findMany({
      where: { examSubjectId: subjectId, parentId: null },
      orderBy: [{ order: 'asc' }],
      include: { children: { orderBy: { order: 'asc' }, select: { id: true, name: true, _count: { select: { questions: true } } } } },
    });
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      weight: t.weight,
      yearsSeen: t.yearsSeen,
      subtopics: t.children.map((c) => ({ id: c.id, name: c.name, questions: c._count.questions })),
    }));
  }

  private where(f: QuestionFilter): Prisma.ExamQuestionWhereInput {
    return {
      ...(f.subjectId ? { examSubjectId: f.subjectId } : f.exam ? { examSubject: { exam: f.exam } } : {}),
      ...(f.topicId ? { OR: [{ topicId: f.topicId }, { topic: { parentId: f.topicId } }] } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.origin ? { origin: f.origin } : {}),
      ...(f.difficulty ? { difficulty: f.difficulty } : {}),
      ...(f.reported ? { reports: { some: { status: 'OPEN' } } } : {}),
      ...(f.q ? { stem: { contains: f.q, mode: 'insensitive' as const } } : {}),
    };
  }

  async list(f: QuestionFilter) {
    const page = f.page ?? 1;
    const pageSize = f.pageSize ?? 25;
    const where = this.where(f);
    const [total, rows] = await Promise.all([
      this.prisma.examQuestion.count({ where }),
      this.prisma.examQuestion.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          examSubject: { select: { exam: true, name: true } },
          topic: { select: { id: true, name: true, parent: { select: { name: true } } } },
          reviewedBy: { select: { firstName: true, lastName: true } },
          reports: { where: { status: 'OPEN' }, select: { id: true, reason: true, note: true, createdAt: true } },
          template: { select: { id: true, spec: true, status: true, _count: { select: { questions: true } } } },
        },
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      items: rows.map((q) => ({
        id: q.id,
        exam: q.examSubject.exam,
        subject: q.examSubject.name,
        topicId: q.topic.id,
        topic: q.topic.parent ? `${q.topic.parent.name} › ${q.topic.name}` : q.topic.name,
        difficulty: q.difficulty,
        stem: q.stem,
        options: q.options as { id: string; label: string }[],
        answerId: q.answerId,
        explanation: q.explanation,
        origin: q.origin,
        status: q.status,
        checkNotes: q.checkNotes,
        reviewedBy: q.reviewedBy ? `${q.reviewedBy.firstName} ${q.reviewedBy.lastName}` : null,
        reviewedAt: q.reviewedAt,
        timesServed: q.timesServed,
        timesCorrect: q.timesCorrect,
        reports: q.reports,
        template: q.template ? { id: q.template.id, key: (q.template.spec as { key?: string }).key ?? null, status: q.template.status, questions: q.template._count.questions } : null,
        createdAt: q.createdAt,
      })),
    };
  }

  /** Approve, send back to review or retire. Retiring also closes the question's open reports. */
  async setStatus(adminId: string, ids: string[], status: QuestionStatus) {
    const found = await this.prisma.examQuestion.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) throw new NotFoundException('Some of those questions no longer exist.');
    const reviewed = status === 'APPROVED' || status === 'RETIRED';
    await this.prisma.$transaction(async (tx) => {
      await tx.examQuestion.updateMany({
        where: { id: { in: ids } },
        data: { status, ...(reviewed ? { reviewedById: adminId, reviewedAt: new Date() } : {}) },
      });
      if (status === 'RETIRED') await tx.questionReport.updateMany({ where: { questionId: { in: ids }, status: 'OPEN' }, data: { status: 'RESOLVED' } });
      await tx.auditLog.create({
        data: { actorId: adminId, action: `question.${status.toLowerCase()}`, entityType: 'ExamQuestion', entityId: ids[0], meta: { ids, count: ids.length } },
      });
    });
    return { updated: ids.length };
  }

  /**
   * Approve, send back or retire a whole template. Its questions follow (except ones retired on their own),
   * and questions generated later take the template's status.
   */
  async setTemplateStatus(adminId: string, templateId: string, status: QuestionStatus) {
    const t = await this.prisma.questionTemplate.findUnique({ where: { id: templateId } });
    if (!t) throw new NotFoundException('Template not found.');
    const reviewed = status === 'APPROVED' || status === 'RETIRED';
    const { count } = await this.prisma.$transaction(async (tx) => {
      await tx.questionTemplate.update({ where: { id: templateId }, data: { status } });
      const res = await tx.examQuestion.updateMany({
        where: { templateId, ...(status === 'RETIRED' ? {} : { status: { not: 'RETIRED' } }) },
        data: { status, ...(reviewed ? { reviewedById: adminId, reviewedAt: new Date() } : {}) },
      });
      await tx.auditLog.create({ data: { actorId: adminId, action: `template.${status.toLowerCase()}`, entityType: 'QuestionTemplate', entityId: templateId, meta: { key: (t.spec as { key?: string }).key ?? null, questions: res.count } } });
      return res;
    });
    return { updated: count };
  }

  /** Fix a question's wording, options, answer, explanation, difficulty or topic. Fixing it closes its open reports. */
  async edit(adminId: string, id: string, dto: QuestionEdit) {
    const q = await this.prisma.examQuestion.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Question not found.');
    const options = dto.options ?? (q.options as { id: string; label: string }[]);
    const answerId = dto.answerId ?? q.answerId;
    if (new Set(options.map((o) => o.id)).size !== options.length) throw new BadRequestException('Each option needs its own id.');
    if (!options.some((o) => o.id === answerId)) throw new BadRequestException('The answer must be one of the options.');
    if (dto.topicId) {
      const topic = await this.prisma.syllabusTopic.findFirst({ where: { id: dto.topicId, examSubjectId: q.examSubjectId } });
      if (!topic) throw new BadRequestException('That topic belongs to a different subject.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.examQuestion.update({
        where: { id },
        data: {
          stem: dto.stem ?? undefined,
          options: dto.options ?? undefined,
          answerId,
          explanation: dto.explanation ?? undefined,
          difficulty: dto.difficulty ?? undefined,
          topicId: dto.topicId ?? undefined,
        },
      });
      await tx.questionReport.updateMany({ where: { questionId: id, status: 'OPEN' }, data: { status: 'RESOLVED' } });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'question.edit', entityType: 'ExamQuestion', entityId: id, meta: { fields: Object.keys(dto) } } });
    });
    return { ok: true };
  }

  /** Close a report without changing the question (the question was fine). */
  async dismissReport(adminId: string, reportId: string) {
    const r = await this.prisma.questionReport.findUnique({ where: { id: reportId } });
    if (!r) throw new NotFoundException('Report not found.');
    await this.prisma.questionReport.update({ where: { id: reportId }, data: { status: 'RESOLVED' } });
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: 'question.report.dismiss', entityType: 'QuestionReport', entityId: reportId, meta: { questionId: r.questionId } } });
    return { ok: true };
  }
}
