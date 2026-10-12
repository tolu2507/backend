import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ActivityType, Curriculum, EducationLevel, Prisma, TermName } from '@prisma/client';

import { AiService, lagosMonthStart, microUsdToKobo, type QuizQuestion } from '../ai/ai.service.js';
import { GRADES, SUBJECTS } from '../catalog/catalog.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Questions as Overwatch edits them: four options and the index of the right one. */
export type EditableQuestion = { prompt: string; options: string[]; answerIndex: number };
export type ActivityInput = {
  schoolId?: string | null;
  subject: string;
  level: EducationLevel;
  gradeName?: string | null;
  topic?: string | null;
  title: string;
  type: ActivityType;
  xpReward: number;
  isPublished: boolean;
  questions: EditableQuestion[];
};
export type TopicInput = { level: EducationLevel; gradeName?: string | null; subject: string; term: TermName; topics: { week?: number | null; topic: string; objectives?: string | null }[] };

const toStored = (qs: EditableQuestion[]): QuizQuestion[] =>
  qs.map((q, i) => ({ id: `q${i + 1}`, prompt: q.prompt.trim(), options: q.options.map((label, j) => ({ id: 'abcd'[j], label: label.trim() })), answerId: 'abcd'[q.answerIndex] }));
const toEditable = (qs: QuizQuestion[]): EditableQuestion[] => qs.map((q) => ({ prompt: q.prompt, options: q.options.map((o) => o.label), answerIndex: Math.max(0, q.options.findIndex((o) => o.id === q.answerId)) }));

function checkQuestions(qs: EditableQuestion[]) {
  if (qs.length < 3) throw new BadRequestException('A quest needs at least 3 questions.');
  qs.forEach((q, i) => {
    if (!q.prompt.trim()) throw new BadRequestException(`Question ${i + 1} has no question text.`);
    if (q.options.some((o) => !o.trim())) throw new BadRequestException(`Question ${i + 1} has an empty answer option.`);
    if (new Set(q.options.map((o) => o.trim().toLowerCase())).size < 4) throw new BadRequestException(`Question ${i + 1} has two options that are the same.`);
  });
}

/** Overwatch's write side for learning: each school's AI setup, its scheme of work, and student quests. */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  // ── School AI profile ──────────────────────────────────

  async schoolAi(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, aiProfile: true, subjects: { select: { name: true }, orderBy: { name: 'asc' } }, classes: { select: { level: true, gradeName: true } } },
    });
    if (!school) throw new NotFoundException('School not found.');
    const [topics, month, byFeature, blocked] = await Promise.all([
      this.prisma.curriculumTopic.findMany({ where: { schoolId }, orderBy: [{ subject: 'asc' }, { level: 'asc' }, { gradeName: 'asc' }, { term: 'asc' }, { week: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.aiUsage.aggregate({ where: { schoolId, createdAt: { gte: lagosMonthStart() } }, _sum: { costMicroUsd: true }, _count: true }),
      this.prisma.aiUsage.groupBy({ by: ['feature'], where: { schoolId, createdAt: { gte: lagosMonthStart() } }, _count: true, _sum: { costMicroUsd: true } }),
      this.ai.blockedReason(schoolId),
    ]);
    const p = school.aiProfile;
    const catalogSubjects = [...new Set(Object.values(SUBJECTS).flat())];
    return {
      school: { id: school.id, name: school.name },
      profile: {
        curriculum: p?.curriculum ?? 'NIGERIAN',
        instructions: p?.instructions ?? '',
        aiEnabled: p?.aiEnabled ?? true,
        monthlyBudgetKobo: p?.monthlyBudgetKobo === null || p?.monthlyBudgetKobo === undefined ? null : Number(p.monthlyBudgetKobo),
        updatedAt: p?.updatedAt ?? null,
        saved: !!p,
      },
      status: blocked,
      month: {
        calls: month._count,
        costKobo: Number(microUsdToKobo(month._sum.costMicroUsd ?? 0)),
        byFeature: byFeature.map((f) => ({ feature: f.feature, calls: f._count, costKobo: Number(microUsdToKobo(f._sum.costMicroUsd ?? 0)) })),
      },
      topics,
      subjects: [...new Set([...school.subjects.map((s) => s.name), ...catalogSubjects])].sort(),
      grades: GRADES,
    };
  }

  async saveSchoolAi(adminId: string, schoolId: string, dto: { curriculum: Curriculum; instructions?: string; aiEnabled: boolean; monthlyBudgetKobo?: number | null }) {
    if (!(await this.prisma.school.findUnique({ where: { id: schoolId } }))) throw new NotFoundException('School not found.');
    const data = {
      curriculum: dto.curriculum,
      instructions: dto.instructions?.trim() || null,
      aiEnabled: dto.aiEnabled,
      monthlyBudgetKobo: dto.monthlyBudgetKobo === null || dto.monthlyBudgetKobo === undefined ? null : BigInt(dto.monthlyBudgetKobo),
      updatedById: adminId,
    };
    await this.prisma.schoolAiProfile.upsert({ where: { schoolId }, update: data, create: { schoolId, ...data } });
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: 'ai.profile.update', entityType: 'SchoolAiProfile', entityId: schoolId, schoolId, meta: { curriculum: dto.curriculum, aiEnabled: dto.aiEnabled } } });
    return this.schoolAi(schoolId);
  }

  async addTopics(adminId: string, schoolId: string, dto: TopicInput) {
    if (!(await this.prisma.school.findUnique({ where: { id: schoolId } }))) throw new NotFoundException('School not found.');
    const rows = dto.topics.filter((t) => t.topic.trim());
    if (!rows.length) throw new BadRequestException('Add at least one topic.');
    const created = await this.prisma.curriculumTopic.createMany({
      data: rows.map((t) => ({ schoolId, level: dto.level, gradeName: dto.gradeName || null, subject: dto.subject.trim(), term: dto.term, week: t.week ?? null, topic: t.topic.trim(), objectives: t.objectives?.trim() || null })),
    });
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: 'ai.topics.add', entityType: 'CurriculumTopic', entityId: schoolId, schoolId, meta: { subject: dto.subject, level: dto.level, count: created.count } } });
    return { added: created.count };
  }

  async deleteTopic(adminId: string, id: string) {
    const t = await this.prisma.curriculumTopic.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Topic not found.');
    await this.prisma.curriculumTopic.delete({ where: { id } });
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: 'ai.topics.delete', entityType: 'CurriculumTopic', entityId: id, schoolId: t.schoolId, meta: { topic: t.topic } } });
    return { ok: true };
  }

  /** Shows exactly what the AI is told for this school, and a sample quest written with it. */
  async testSchoolAi(schoolId: string, dto: { subject: string; level: EducationLevel; gradeName?: string; topic: string }) {
    const guidance = await this.ai.schoolGuidance({ schoolId, subject: dto.subject, level: dto.level, grade: dto.gradeName });
    const draft = await this.ai.draftActivity({ subject: dto.subject, level: dto.level, grade: dto.gradeName, topic: dto.topic, count: 5 }, { schoolId });
    if (!draft) throw new BadRequestException((await this.ai.blockedReason(schoolId)) ?? 'The AI couldn’t write a sample just now. Try again.');
    return { guidance: guidance || '(No school context yet: the AI uses its general Nigerian-school instructions.)', title: draft.title, questions: toEditable(draft.questions) };
  }

  // ── Student quests ─────────────────────────────────────

  async activities(f: { level?: EducationLevel; subject?: string; schoolId?: string; q?: string; published?: boolean; page?: number; pageSize?: number }) {
    const where: Prisma.LearningActivityWhereInput = {
      ...(f.level ? { level: f.level } : {}),
      ...(f.subject ? { subject: f.subject } : {}),
      ...(f.schoolId === 'global' ? { schoolId: null } : f.schoolId ? { schoolId: f.schoolId } : {}),
      ...(f.published !== undefined ? { isPublished: f.published } : {}),
      ...(f.q?.trim() ? { OR: [{ title: { contains: f.q.trim(), mode: 'insensitive' } }, { topic: { contains: f.q.trim(), mode: 'insensitive' } }] } : {}),
    };
    const page = Math.max(1, f.page ?? 1);
    const pageSize = Math.min(f.pageSize ?? 25, 200);
    const [total, rows, subjects] = await Promise.all([
      this.prisma.learningActivity.count({ where }),
      this.prisma.learningActivity.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ createdAt: 'desc' }], include: { school: { select: { id: true, name: true } }, _count: { select: { attempts: true } } } }),
      this.prisma.learningActivity.findMany({ distinct: ['subject'], select: { subject: true }, orderBy: { subject: 'asc' } }),
    ]);
    const scores = await this.prisma.activityAttempt.groupBy({ by: ['activityId'], where: { activityId: { in: rows.map((r) => r.id) }, score: { not: null } }, _avg: { score: true } });
    const avg = new Map(scores.map((s) => [s.activityId, s._avg.score]));
    return {
      total,
      subjects: subjects.map((s) => s.subject),
      rows: rows.map((a) => ({
        id: a.id,
        title: a.title,
        subject: a.subject,
        level: a.level,
        gradeName: a.gradeName,
        topic: a.topic,
        type: a.type,
        xpReward: a.xpReward,
        isPublished: a.isPublished,
        school: a.school,
        questions: ((a.content as { questions?: unknown[] })?.questions ?? []).length,
        attempts: a._count.attempts,
        avgScore: avg.get(a.id) === null || avg.get(a.id) === undefined ? null : Math.round(avg.get(a.id)! * 100),
        createdAt: a.createdAt,
      })),
    };
  }

  async activity(id: string) {
    const a = await this.prisma.learningActivity.findUnique({ where: { id }, include: { school: { select: { id: true, name: true } }, _count: { select: { attempts: true } } } });
    if (!a) throw new NotFoundException('Quest not found.');
    return { ...a, attempts: a._count.attempts, questions: toEditable((a.content as { questions: QuizQuestion[] }).questions ?? []) };
  }

  async createActivity(adminId: string, dto: ActivityInput) {
    checkQuestions(dto.questions);
    const a = await this.prisma.learningActivity.create({
      data: {
        schoolId: dto.schoolId || null,
        subject: dto.subject.trim(),
        level: dto.level,
        gradeName: dto.gradeName || null,
        topic: dto.topic?.trim() || null,
        title: dto.title.trim(),
        type: dto.type,
        xpReward: dto.xpReward,
        isPublished: dto.isPublished,
        content: { questions: toStored(dto.questions) },
      },
    });
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: 'quest.create', entityType: 'LearningActivity', entityId: a.id, schoolId: a.schoolId, meta: { title: a.title } } });
    return { id: a.id };
  }

  async updateActivity(adminId: string, id: string, dto: Partial<ActivityInput>) {
    const a = await this.prisma.learningActivity.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Quest not found.');
    if (dto.questions) checkQuestions(dto.questions);
    await this.prisma.learningActivity.update({
      where: { id },
      data: {
        ...(dto.schoolId !== undefined ? { schoolId: dto.schoolId || null } : {}),
        ...(dto.subject ? { subject: dto.subject.trim() } : {}),
        ...(dto.level ? { level: dto.level } : {}),
        ...(dto.gradeName !== undefined ? { gradeName: dto.gradeName || null } : {}),
        ...(dto.topic !== undefined ? { topic: dto.topic?.trim() || null } : {}),
        ...(dto.title ? { title: dto.title.trim() } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.xpReward !== undefined ? { xpReward: dto.xpReward } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        ...(dto.questions ? { content: { questions: toStored(dto.questions) } } : {}),
      },
    });
    const changed = Object.entries(dto).filter(([, v]) => v !== undefined).length;
    const action = dto.isPublished !== undefined && changed === 1 ? (dto.isPublished ? 'quest.publish' : 'quest.unpublish') : 'quest.update';
    await this.prisma.auditLog.create({ data: { actorId: adminId, action, entityType: 'LearningActivity', entityId: id, schoolId: a.schoolId, meta: { title: dto.title ?? a.title } } });
    return { ok: true };
  }

  /** Quests students have already played are unpublished instead, so their history and XP stay intact. */
  async deleteActivity(adminId: string, id: string) {
    const a = await this.prisma.learningActivity.findUnique({ where: { id }, include: { _count: { select: { attempts: true } } } });
    if (!a) throw new NotFoundException('Quest not found.');
    if (a._count.attempts > 0) {
      await this.prisma.learningActivity.update({ where: { id }, data: { isPublished: false } });
      await this.prisma.auditLog.create({ data: { actorId: adminId, action: 'quest.unpublish', entityType: 'LearningActivity', entityId: id, schoolId: a.schoolId, meta: { title: a.title } } });
      return { deleted: false, unpublished: true };
    }
    await this.prisma.learningActivity.delete({ where: { id } });
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: 'quest.delete', entityType: 'LearningActivity', entityId: id, schoolId: a.schoolId, meta: { title: a.title } } });
    return { deleted: true, unpublished: false };
  }

  /** AI writes a draft quest (using the school's curriculum when a school is chosen). Nothing is saved. */
  async draftActivity(dto: { schoolId?: string; subject: string; level: EducationLevel; gradeName?: string; topic: string; count: number }) {
    const draft = await this.ai.draftActivity({ subject: dto.subject, level: dto.level, grade: dto.gradeName, topic: dto.topic, count: dto.count }, { schoolId: dto.schoolId || null });
    if (!draft) throw new BadRequestException((await this.ai.blockedReason(dto.schoolId)) ?? 'The AI couldn’t write this quest just now. Try again, or write the questions yourself.');
    return { title: draft.title, questions: toEditable(draft.questions) };
  }
}
