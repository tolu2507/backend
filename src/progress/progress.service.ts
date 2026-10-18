import { Injectable } from '@nestjs/common';
import type { ExamBody } from '@prisma/client';

import { addDays, lagosDay, lagosMidnightInstant, weekStart } from '../common/dates.js';
import { EXAM_CATALOG } from '../exams/exam-catalog.js';
import { mockState, type SubjectScore } from '../mocks/mocks.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const MIN_ANSWERED = 5; // a topic needs this many answers before we call it strong or weak
const outOf = (exam: ExamBody, subjects: Record<string, SubjectScore> | null) => (exam === 'JAMB' ? Object.keys(subjects ?? {}).length * 100 : 100);

/** What a child has actually done: practice, topics, Friday mocks. Every number comes from their own activity. */
@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  /** This week (Monday to now, Lagos) and last week's XP, for "up or down" comparisons. */
  private async week(studentId: string) {
    const start = lagosMidnightInstant(weekStart());
    const lastStart = lagosMidnightInstant(addDays(weekStart(), -7));
    const [seen, xp, lastXp] = await Promise.all([
      this.prisma.questionSeen.findMany({ where: { studentId, lastSeenAt: { gte: start } }, select: { lastCorrect: true } }),
      this.prisma.xpEvent.findMany({ where: { studentId, createdAt: { gte: start } }, select: { amount: true, createdAt: true } }),
      this.prisma.xpEvent.aggregate({ where: { studentId, createdAt: { gte: lastStart, lt: start } }, _sum: { amount: true } }),
    ]);
    return {
      questions: seen.length,
      correct: seen.filter((s) => s.lastCorrect).length,
      activeDays: new Set(xp.map((e) => lagosDay(e.createdAt).getTime())).size,
      xp: xp.reduce((sum, e) => sum + e.amount, 0),
      lastWeekXp: lastXp._sum.amount ?? 0,
    };
  }

  private async mocks(studentId: string, take: number) {
    const rows = await this.prisma.mockSitting.findMany({
      where: { studentId, submittedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      take,
      include: { mock: { include: { _count: { select: { sittings: true } } } } },
    });
    return rows.map((s) => {
      const subjects = s.subjectScores as Record<string, SubjectScore> | null;
      const out = s.mock.status === 'RESULTS_OUT';
      return {
        title: s.mock.title,
        exam: s.mock.exam,
        date: s.mock.opensAt,
        score: s.score,
        outOf: outOf(s.mock.exam, subjects),
        subjects: Object.values(subjects ?? {}),
        rank: out ? s.nationalRank : null,
        sat: out ? s.mock._count.sittings : null,
        percentile: out ? s.percentile : null,
      };
    });
  }

  private async nextMock(studentId: string) {
    const exams = await this.prisma.studentExam.findMany({ where: { studentId }, select: { exam: true } });
    const withMock = exams.map((e) => e.exam).filter((e) => EXAM_CATALOG[e].fridayMock);
    if (!withMock.length) return null;
    const mock = await this.prisma.mockExam.findFirst({ where: { exam: { in: withMock }, closesAt: { gt: new Date() } }, orderBy: { opensAt: 'asc' } });
    if (!mock) return null;
    const sitting = await this.prisma.mockSitting.findUnique({ where: { mockId_studentId: { mockId: mock.id, studentId } }, select: { submittedAt: true } });
    return { title: mock.title, exam: mock.exam, opensAt: mock.opensAt, closesAt: mock.closesAt, state: mockState(mock), taken: !!sitting?.submittedAt };
  }

  /** One card per child on the parent's home screen. */
  async cards(studentIds: string[]) {
    return Promise.all(
      studentIds.map(async (studentId) => {
        const [profile, week, mocks, nextMock, exams] = await Promise.all([
          this.prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId }, select: { currentStreak: true, lastActiveDate: true } }),
          this.week(studentId),
          this.mocks(studentId, 1),
          this.nextMock(studentId),
          this.prisma.studentExam.findMany({ where: { studentId }, orderBy: { createdAt: 'asc' }, select: { exam: true, targetYear: true } }),
        ]);
        // A streak only counts if they were active today or yesterday.
        const alive = !!profile.lastActiveDate && lagosDay().getTime() - profile.lastActiveDate.getTime() <= 86_400_000;
        return {
          studentId,
          streak: alive ? profile.currentStreak : 0,
          lastActive: profile.lastActiveDate,
          week,
          lastMock: mocks[0] ?? null,
          nextMock,
          exams: exams.map((e) => ({ exam: e.exam, label: EXAM_CATALOG[e.exam].label, targetYear: e.targetYear })),
        };
      }),
    );
  }

  /** Everything on a child's progress page. */
  async detail(studentId: string) {
    const [card] = await this.cards([studentId]);
    const [chosen, progress, mocks, profile] = await Promise.all([
      this.prisma.studentExamSubject.findMany({ where: { studentExam: { studentId } }, include: { examSubject: true, studentExam: { select: { exam: true } } } }),
      this.prisma.topicProgress.findMany({ where: { studentId }, include: { topic: { include: { parent: true, examSubject: true } } } }),
      this.mocks(studentId, 8),
      this.prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId }, select: { xpTotal: true, longestStreak: true } }),
    ]);

    const subjectIds = chosen.map((c) => c.examSubjectId);
    const leaves = await this.prisma.syllabusTopic.findMany({
      where: { examSubjectId: { in: subjectIds }, children: { none: {} } },
      select: { examSubjectId: true },
    });
    const maxYears = await this.prisma.syllabusTopic.groupBy({ by: ['examSubjectId'], where: { examSubjectId: { in: subjectIds } }, _max: { yearsSeen: true } });
    const yearsBy = new Map(maxYears.map((m) => [m.examSubjectId, m._max.yearsSeen ?? 0]));

    const subjects = chosen.map((c) => {
      const rows = progress.filter((p) => p.topic.examSubjectId === c.examSubjectId);
      const total = leaves.filter((l) => l.examSubjectId === c.examSubjectId).length;
      const answered = rows.reduce((sum, p) => sum + p.answered, 0);
      const correct = rows.reduce((sum, p) => sum + p.correct, 0);
      return {
        id: c.examSubjectId,
        exam: c.studentExam.exam,
        name: c.examSubject.name,
        topics: total,
        started: rows.length,
        conquered: rows.filter((p) => p.bossBeaten).length,
        mastery: total ? rows.reduce((sum, p) => sum + p.mastery, 0) / total : 0,
        answered,
        accuracy: answered ? correct / answered : null,
      };
    });

    const rated = progress
      .filter((p) => p.answered >= MIN_ANSWERED && subjectIds.includes(p.topic.examSubjectId))
      .map((p) => {
        const root = p.topic.parent ?? p.topic;
        return {
          topicId: p.topicId,
          subject: p.topic.examSubject.name,
          topic: p.topic.parent ? `${p.topic.parent.name} › ${p.topic.name}` : p.topic.name,
          accuracy: p.correct / p.answered,
          answered: p.answered,
          level: p.level,
          // "Comes up every year" is only said when it's true of the papers we analysed.
          everyPaper: !!root.yearsSeen && root.yearsSeen === yearsBy.get(p.topic.examSubjectId),
        };
      });
    const byAccuracy = [...rated].sort((a, b) => a.accuracy - b.accuracy);

    return {
      ...card,
      xpTotal: profile.xpTotal,
      longestStreak: profile.longestStreak,
      subjects,
      weakTopics: byAccuracy.filter((t) => t.accuracy < 0.6).slice(0, 3),
      strongTopics: byAccuracy.reverse().filter((t) => t.accuracy >= 0.75).slice(0, 3),
      mocks,
    };
  }
}
