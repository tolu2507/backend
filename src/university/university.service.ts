import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { QuestionStatus } from '@prisma/client';

import { ExamsService } from '../exams/exams.service.js';
import { GamificationService } from '../gamification/gamification.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PracticeService } from '../question-bank/practice.service.js';
import { courseCode, UNI_COURSES, UNI_DEPARTMENTS, uniDepartment } from '../exams/university.js';

/** XP for finishing a lesson the first time, plus a little for each quick check got right. */
const LESSON_XP = 20;
const CHECK_XP = 2;

const titleOf = (slug: string) => UNI_COURSES.find((c) => c.slug === slug)?.title ?? slug;

/**
 * The university side: a student picks a department, level and semester, then the courses they registered.
 * Each course has units; each unit has sections, and each section has a ready-made classroom lesson and its
 * practice questions (the same level 1–5 + boss practice as the exam side).
 */
@Injectable()
export class UniversityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exams: ExamsService,
    private readonly practice: PracticeService,
    private readonly game: GamificationService,
  ) {}

  async studentByUser(userId: string) {
    const p = await this.prisma.studentProfile.findUnique({ where: { userId }, select: { id: true, level: true, department: true, gradeName: true } });
    if (!p || p.level !== 'TERTIARY') throw new ForbiddenException('This is for university student accounts.');
    return p;
  }

  private async courseRows() {
    return this.prisma.examSubject.findMany({ where: { exam: 'UNIVERSITY', isActive: true } });
  }

  /** Departments → semesters → courses, with how much of each course is ready. */
  async departments() {
    const rows = await this.courseRows();
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    const [lessons, questions] = await Promise.all([
      this.prisma.courseLesson.groupBy({ by: ['topicId'], where: { status: 'APPROVED', topic: { examSubject: { exam: 'UNIVERSITY' } } }, _count: true }),
      this.prisma.examQuestion.groupBy({ by: ['examSubjectId'], where: { status: 'APPROVED', examSubject: { exam: 'UNIVERSITY' } }, _count: true }),
    ]);
    const topics = await this.prisma.syllabusTopic.findMany({ where: { id: { in: lessons.map((l) => l.topicId) } }, select: { id: true, examSubjectId: true } });
    const lessonsBy = new Map<string, number>();
    for (const t of topics) lessonsBy.set(t.examSubjectId, (lessonsBy.get(t.examSubjectId) ?? 0) + 1);
    const questionsBy = new Map(questions.map((q) => [q.examSubjectId, q._count]));

    return UNI_DEPARTMENTS.map((d) => ({
      slug: d.slug,
      name: d.name,
      faculty: d.faculty,
      semesters: d.semesters.map((s) => ({
        level: s.level,
        semester: s.semester,
        courses: s.courses.flatMap((slug) => {
          const row = bySlug.get(slug);
          return row ? [{ id: row.id, slug, code: courseCode(slug), title: titleOf(slug), lessons: lessonsBy.get(row.id) ?? 0, questions: questionsBy.get(row.id) ?? 0 }] : [];
        }),
      })),
    }));
  }

  /** The student's department, level and courses, each with progress. */
  async me(userId: string) {
    const p = await this.studentByUser(userId);
    const chosen = (await this.exams.chosen(p.id)).find((e) => e.exam === 'UNIVERSITY');
    const courses = await Promise.all((chosen?.subjects ?? []).map((s) => this.courseSummary(p.id, s.id)));
    const profile = await this.prisma.studentProfile.findUniqueOrThrow({ where: { id: p.id }, select: { xpTotal: true, currentStreak: true, longestStreak: true } });
    const dept = uniDepartment(p.department);
    return {
      department: dept ? { slug: dept.slug, name: dept.name, faculty: dept.faculty } : null,
      level: p.gradeName,
      courses,
      continue: await this.continueLesson(p.id, courses.map((c) => c.id)),
      xp: profile.xpTotal,
      streak: profile.currentStreak,
      longestStreak: profile.longestStreak,
    };
  }

  /** "Pick up where you stopped": the lesson they last opened and didn't finish, else the first lesson they haven't done. */
  private async continueLesson(studentId: string, courseIds: string[]) {
    if (!courseIds.length) return null;
    const pick = (l: { id: string; title: string; topic: { name: string; examSubject: { id: string; slug: string } } }, slide: number) => ({
      lessonId: l.id,
      title: l.title,
      section: l.topic.name,
      courseId: l.topic.examSubject.id,
      courseCode: courseCode(l.topic.examSubject.slug),
      slide,
    });
    const include = { topic: { select: { name: true, examSubject: { select: { id: true, slug: true } } } } } as const;
    const open = await this.prisma.lessonProgress.findFirst({
      where: { studentId, completedAt: null, lesson: { status: 'APPROVED', topic: { examSubjectId: { in: courseIds } } } },
      orderBy: { updatedAt: 'desc' },
      include: { lesson: { include } },
    });
    if (open) return pick(open.lesson, open.slide);
    for (const examSubjectId of courseIds) {
      const next = await this.prisma.courseLesson.findFirst({
        where: { status: 'APPROVED', topic: { examSubjectId }, progress: { none: { studentId, completedAt: { not: null } } } },
        orderBy: [{ topic: { parent: { order: 'asc' } } }, { topic: { order: 'asc' } }],
        include,
      });
      if (next) return pick(next, 0);
    }
    return null;
  }

  /** Saves the department, level/semester and registered courses. */
  async setup(userId: string, input: { department: string; level: number; semester: number; courseIds: string[] }) {
    const p = await this.studentByUser(userId);
    const dept = uniDepartment(input.department);
    if (!dept) throw new BadRequestException('We don’t have that department yet.');
    const sem = dept.semesters.find((s) => s.level === input.level && s.semester === input.semester);
    if (!sem) throw new BadRequestException(`${dept.name} ${input.level} Level, semester ${input.semester}, isn’t on BrainBox yet.`);
    const rows = await this.prisma.examSubject.findMany({ where: { id: { in: input.courseIds }, exam: 'UNIVERSITY', isActive: true } });
    if (rows.length !== new Set(input.courseIds).size || rows.some((r) => !sem.courses.includes(r.slug))) {
      throw new BadRequestException('Some of those courses aren’t on this semester’s list.');
    }
    await this.prisma.studentProfile.update({ where: { id: p.id }, data: { department: dept.slug, gradeName: `${input.level} Level · ${input.semester === 1 ? 'First' : 'Second'} semester` } });
    await this.exams.choose(p.id, 'UNIVERSITY', rows.map((r) => r.id));
    return this.me(userId);
  }

  private async courseSummary(studentId: string, examSubjectId: string) {
    const subject = await this.prisma.examSubject.findUniqueOrThrow({ where: { id: examSubjectId } });
    const [sections, lessonsDone, map] = await Promise.all([
      this.prisma.courseLesson.count({ where: { status: 'APPROVED', topic: { examSubjectId } } }),
      this.prisma.lessonProgress.count({ where: { studentId, completedAt: { not: null }, lesson: { status: 'APPROVED', topic: { examSubjectId } } } }),
      this.practice.map(studentId, examSubjectId),
    ]);
    return {
      id: subject.id,
      slug: subject.slug,
      code: courseCode(subject.slug),
      title: titleOf(subject.slug),
      units: map.topics.length,
      lessons: sections,
      lessonsDone,
      sectionsConquered: map.conquered,
      sections: map.leaves,
      mastery: map.mastery,
      reviewsDue: map.reviewsDue,
    };
  }

  /** A course's units, each with its sections: the lesson (and how far they got) plus the practice level. */
  async course(userId: string, examSubjectId: string) {
    const p = await this.studentByUser(userId);
    const map = await this.practice.map(p.id, examSubjectId);
    if (map.subject.exam !== 'UNIVERSITY') throw new NotFoundException('Course not found.');
    const leafIds = map.topics.flatMap((t) => t.subtopics.map((s) => s.id));
    const [lessons, units] = await Promise.all([
      this.prisma.courseLesson.findMany({
        where: { topicId: { in: leafIds }, status: 'APPROVED' },
        select: { id: true, topicId: true, title: true, minutes: true, progress: { where: { studentId: p.id } } },
      }),
      this.prisma.syllabusTopic.findMany({ where: { examSubjectId, parentId: null }, select: { id: true, order: true, examinerNotes: true } }),
    ]);
    const lessonBy = new Map(lessons.map((l) => [l.topicId, l]));
    const unitBy = new Map(units.map((u) => [u.id, u]));
    // University units follow the manual's order, not past-paper weight.
    const ordered = [...map.topics].sort((a, b) => (unitBy.get(a.id)?.order ?? 0) - (unitBy.get(b.id)?.order ?? 0));
    return {
      id: map.subject.id,
      code: courseCode(map.subject.slug),
      title: titleOf(map.subject.slug),
      mastery: map.mastery,
      reviewsDue: map.reviewsDue,
      units: ordered.map((t, i) => ({
        id: t.id,
        number: i + 1,
        name: t.name,
        summary: unitBy.get(t.id)?.examinerNotes ?? null,
        sections: t.subtopics.map((s) => {
          const l = lessonBy.get(s.id);
          const prog = l?.progress[0];
          return {
            id: s.id,
            name: s.name,
            lesson: l ? { id: l.id, title: l.title, minutes: l.minutes, slide: prog?.slide ?? 0, done: !!prog?.completedAt } : null,
            practice: { level: s.level, mastery: s.mastery, answered: s.answered, bossBeaten: s.bossBeaten, fresh: s.fresh, unlocked: s.unlocked },
          };
        }),
      })),
    };
  }

  /** One lesson with everything the classroom player needs, and what comes next. */
  async lesson(userId: string, lessonId: string) {
    const p = await this.studentByUser(userId);
    const lesson = await this.prisma.courseLesson.findFirst({
      where: { id: lessonId, status: 'APPROVED' },
      include: { topic: { include: { parent: true, examSubject: true } }, progress: { where: { studentId: p.id } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found.');
    await this.assertTaking(p.id, lesson.topic.examSubjectId);

    // Next lesson in course order: the next section of this unit, else the first of the next unit.
    const units = await this.prisma.syllabusTopic.findMany({
      where: { examSubjectId: lesson.topic.examSubjectId, parentId: null },
      orderBy: { order: 'asc' },
      include: { children: { orderBy: { order: 'asc' }, include: { lessons: { where: { status: 'APPROVED' }, select: { id: true, title: true } } } } },
    });
    const flat = units.flatMap((u) => u.children.flatMap((c) => c.lessons.map((l) => ({ ...l, sectionId: c.id }))));
    const at = flat.findIndex((l) => l.id === lesson.id);
    const unitNumber = units.findIndex((u) => u.id === lesson.topic.parentId) + 1;

    return {
      id: lesson.id,
      title: lesson.title,
      minutes: lesson.minutes,
      hook: lesson.hook,
      slides: lesson.slides,
      sources: lesson.sources,
      course: { id: lesson.topic.examSubjectId, code: courseCode(lesson.topic.examSubject.slug), title: titleOf(lesson.topic.examSubject.slug) },
      unit: { number: unitNumber, name: lesson.topic.parent?.name ?? '' },
      section: { id: lesson.topicId, name: lesson.topic.name },
      progress: lesson.progress[0] ? { slide: lesson.progress[0].slide, done: !!lesson.progress[0].completedAt } : { slide: 0, done: false },
      next: at >= 0 && flat[at + 1] ? { id: flat[at + 1].id, title: flat[at + 1].title } : null,
    };
  }

  private async assertTaking(studentId: string, examSubjectId: string) {
    const link = await this.prisma.studentExamSubject.findFirst({ where: { examSubjectId, studentExam: { studentId, exam: 'UNIVERSITY' } }, select: { examSubjectId: true } });
    if (!link) throw new NotFoundException('Add this course to your courses first.');
  }

  /** Saves how far they got. Finishing the first time gives XP (and counts towards the streak). */
  async saveProgress(userId: string, lessonId: string, input: { slide: number; checksRight: number; checksTotal: number; completed: boolean }) {
    const p = await this.studentByUser(userId);
    const lesson = await this.prisma.courseLesson.findFirst({ where: { id: lessonId, status: 'APPROVED' }, select: { id: true, slides: true, topic: { select: { examSubjectId: true } } } });
    if (!lesson) throw new NotFoundException('Lesson not found.');
    await this.assertTaking(p.id, lesson.topic.examSubjectId);
    const slides = Array.isArray(lesson.slides) ? lesson.slides.length : 0;
    const checks = Array.isArray(lesson.slides) ? (lesson.slides as { kind?: string }[]).filter((s) => s?.kind === 'check').length : 0;
    const slide = Math.max(0, Math.min(input.slide, slides));
    const checksTotal = Math.min(Math.max(0, input.checksTotal), checks);
    const checksRight = Math.min(Math.max(0, input.checksRight), checksTotal);

    return this.prisma.$transaction(async (tx) => {
      const before = await tx.lessonProgress.findUnique({ where: { studentId_lessonId: { studentId: p.id, lessonId } } });
      const firstFinish = input.completed && !before?.completedAt;
      await tx.lessonProgress.upsert({
        where: { studentId_lessonId: { studentId: p.id, lessonId } },
        create: { studentId: p.id, lessonId, slide, checksRight, checksTotal, completedAt: input.completed ? new Date() : null },
        update: {
          slide: Math.max(slide, before?.slide ?? 0),
          ...(firstFinish ? { checksRight, checksTotal, completedAt: new Date() } : {}),
        },
      });
      const xp = firstFinish ? LESSON_XP + checksRight * CHECK_XP : 0;
      const rewards = await this.game.awardXp(tx, p.id, xp, 'ACTIVITY', lessonId);
      return { xpEarned: xp, rewards };
    });
  }

  // ── Overwatch ──────────────────────────────────────────

  /** Every university course with its units, sections and the state of each lesson and its questions. */
  async adminOverview() {
    const rows = await this.courseRows();
    const order = UNI_COURSES.map((c) => c.slug);
    rows.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
    return Promise.all(
      rows.map(async (r) => {
        const units = await this.prisma.syllabusTopic.findMany({
          where: { examSubjectId: r.id, parentId: null },
          orderBy: { order: 'asc' },
          include: { children: { orderBy: { order: 'asc' }, include: { lessons: { select: { id: true, title: true, status: true, checkNotes: true, minutes: true, slides: true } } } } },
        });
        const qs = await this.prisma.examQuestion.groupBy({ by: ['topicId', 'status'], where: { examSubjectId: r.id }, _count: true });
        const qBy = new Map<string, Partial<Record<QuestionStatus, number>>>();
        for (const q of qs) qBy.set(q.topicId, { ...qBy.get(q.topicId), [q.status]: q._count });
        return {
          id: r.id,
          code: courseCode(r.slug),
          title: titleOf(r.slug),
          units: units.map((u) => ({
            id: u.id,
            name: u.name,
            sections: u.children.map((c) => {
              const l = c.lessons[0];
              return {
                id: c.id,
                name: c.name,
                lesson: l ? { id: l.id, title: l.title, status: l.status, checkNotes: l.checkNotes, minutes: l.minutes, slides: Array.isArray(l.slides) ? l.slides.length : 0 } : null,
                questions: qBy.get(c.id) ?? {},
              };
            }),
          })),
        };
      }),
    );
  }

  async adminLesson(id: string) {
    const lesson = await this.prisma.courseLesson.findUnique({ where: { id }, include: { topic: { include: { parent: true, examSubject: true } } } });
    if (!lesson) throw new NotFoundException('Lesson not found.');
    return { ...lesson, course: courseCode(lesson.topic.examSubject.slug), unit: lesson.topic.parent?.name ?? null, section: lesson.topic.name };
  }

  /** Approve (or retire, or send back) lessons. With `withQuestions`, the sections' IN_REVIEW questions move too. */
  async adminSetStatus(adminId: string, ids: string[], status: QuestionStatus, withQuestions: boolean) {
    const lessons = await this.prisma.courseLesson.findMany({ where: { id: { in: ids } }, select: { id: true, topicId: true } });
    await this.prisma.courseLesson.updateMany({ where: { id: { in: lessons.map((l) => l.id) } }, data: { status, reviewedAt: new Date() } });
    let questions = 0;
    if (withQuestions && (status === 'APPROVED' || status === 'RETIRED')) {
      const r = await this.prisma.examQuestion.updateMany({ where: { topicId: { in: lessons.map((l) => l.topicId) }, status: 'IN_REVIEW' }, data: { status, reviewedAt: new Date(), reviewedById: adminId } });
      questions = r.count;
    }
    return { lessons: lessons.length, questions };
  }
}
