import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { ExamBody, MockExam, MockSitting, Prisma } from '@prisma/client';

import { addDays, lagosMidnightInstant, weekStart } from '../common/dates.js';
import { EXAM_BODIES, EXAM_CATALOG } from '../exams/exam-catalog.js';
import { GamificationService } from '../gamification/gamification.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Friday, 4pm–9pm Lagos. Everyone sits in the same window so national rankings are fair. */
const OPEN_HOUR = 16;
const CLOSE_HOUR = 21;
const FRIDAY = 4; // days after Monday
const GRACE_MS = 30_000; // late answer saves allowed for slow networks
const DEFAULT_PER_SUBJECT = 40;
const XP_FINISH = 30;
const REVIEW_AFTER_DAYS = 2;

type Option = { id: string; label: string };
type Questions = Record<string, string[]>; // examSubjectId → question ids, fixed at start
type Answers = Record<string, string>; // questionId → optionId
export type SubjectScore = { name: string; correct: number; total: number; score: number };

const LABEL = (exam: ExamBody) => EXAM_CATALOG[exam].label;
const OUT_OF = (exam: ExamBody, subjects: number) => (exam === 'JAMB' ? subjects * 100 : 100);
const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });

export function mockState(m: Pick<MockExam, 'opensAt' | 'closesAt' | 'status'>, now = new Date()) {
  if (m.status === 'RESULTS_OUT') return 'RESULTS_OUT' as const;
  if (now < m.opensAt) return 'UPCOMING' as const;
  if (now < m.closesAt) return 'OPEN' as const;
  return 'MARKING' as const;
}

/**
 * The Friday mock: a full, timed paper in each exam's real format. Questions follow the exam's
 * past-paper topic mix and come from the approved bank, unseen ones first. Answers and explanations
 * stay hidden until the window closes, so nobody can pass them round while others are still writing.
 */
@Injectable()
export class MocksService implements OnApplicationBootstrap {
  private readonly log = new Logger(MocksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly game: GamificationService,
    private readonly messaging: MessagingService,
    private readonly settings: SettingsService,
  ) {}

  async onApplicationBootstrap() {
    await this.schedule();
  }

  /** This week's and next week's Friday mocks for every exam that has one. Safe to run any number of times. */
  @Cron('5 0 * * 1', { timeZone: 'Africa/Lagos' })
  async schedule() {
    for (const offset of [0, 7]) {
      const friday = addDays(weekStart(), FRIDAY + offset);
      const midnight = lagosMidnightInstant(friday);
      const opensAt = new Date(midnight.getTime() + OPEN_HOUR * 3_600_000);
      const closesAt = new Date(midnight.getTime() + CLOSE_HOUR * 3_600_000);
      for (const exam of EXAM_BODIES.filter((e) => EXAM_CATALOG[e].fridayMock)) {
        await this.prisma.mockExam.upsert({
          where: { exam_opensAt: { exam, opensAt } },
          create: { exam, opensAt, closesAt, durationMinutes: EXAM_CATALOG[exam].mockMinutes, title: `${LABEL(exam)} Friday Mock · ${shortDate(opensAt)}` },
          update: {},
        });
      }
    }
  }

  async studentByUser(userId: string) {
    const p = await this.prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!p) throw new ForbiddenException('This account is not a student account.');
    return p.id;
  }

  /** The student's Friday mocks: the current or next one for each exam they're preparing for, and past results. */
  async overview(studentId: string) {
    const exams = await this.prisma.studentExam.findMany({
      where: { studentId, exam: { in: EXAM_BODIES.filter((e) => EXAM_CATALOG[e].fridayMock) } },
      include: { subjects: { include: { examSubject: true } } },
    });
    const now = new Date();
    const upcoming = await Promise.all(
      exams.map(async (e) => {
        const mock = await this.prisma.mockExam.findFirst({ where: { exam: e.exam, closesAt: { gt: now } }, orderBy: { opensAt: 'asc' } });
        if (!mock) return null;
        const sitting = await this.prisma.mockSitting.findUnique({ where: { mockId_studentId: { mockId: mock.id, studentId } } });
        const subjects = await this.readiness(e.subjects.map((s) => s.examSubject));
        return {
          id: mock.id,
          exam: mock.exam,
          title: mock.title,
          opensAt: mock.opensAt,
          closesAt: mock.closesAt,
          durationMinutes: mock.durationMinutes,
          state: mockState(mock, now),
          outOf: OUT_OF(mock.exam, subjects.length),
          subjects,
          ready: subjects.every((s) => s.available > 0),
          sitting: sitting ? { id: sitting.id, submitted: !!sitting.submittedAt, deadlineAt: sitting.deadlineAt } : null,
        };
      }),
    );
    const past = await this.prisma.mockSitting.findMany({
      where: { studentId, OR: [{ submittedAt: { not: null } }, { deadlineAt: { lt: now } }] },
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: { mock: { include: { _count: { select: { sittings: true } } } } },
    });
    return {
      upcoming: upcoming.filter(Boolean),
      past: past.map((s) => this.summary(s, s.mock, s.mock._count.sittings)),
    };
  }

  /** How many approved questions each subject has against what a full paper needs. */
  private async readiness(subjects: { id: string; name: string; mockQuestions: number | null }[]) {
    const counts = await this.prisma.examQuestion.groupBy({ by: ['examSubjectId'], where: { examSubjectId: { in: subjects.map((s) => s.id) }, status: 'APPROVED' }, _count: true });
    const by = new Map(counts.map((c) => [c.examSubjectId, c._count]));
    return subjects.map((s) => {
      const needed = s.mockQuestions ?? DEFAULT_PER_SUBJECT;
      return { id: s.id, name: s.name, needed, available: Math.min(needed, by.get(s.id) ?? 0) };
    });
  }

  private summary(s: MockSitting, mock: MockExam, sat: number) {
    const subjects = (s.subjectScores as Record<string, SubjectScore> | null) ?? {};
    return {
      sittingId: s.id,
      mockId: mock.id,
      exam: mock.exam,
      title: mock.title,
      opensAt: mock.opensAt,
      score: s.score,
      outOf: OUT_OF(mock.exam, Object.keys(subjects).length || Object.keys(s.questions as Questions).length),
      subjects: Object.values(subjects),
      nationalRank: s.nationalRank,
      percentile: s.percentile,
      sat,
      resultsOut: mock.status === 'RESULTS_OUT',
    };
  }

  /** Starts the student's sitting (or returns the one already started). The questions are fixed now. */
  async start(studentId: string, mockId: string) {
    const mock = await this.prisma.mockExam.findUnique({ where: { id: mockId } });
    if (!mock) throw new NotFoundException('Mock not found.');
    const existing = await this.prisma.mockSitting.findUnique({ where: { mockId_studentId: { mockId, studentId } } });
    if (existing) return { sittingId: existing.id };

    const state = mockState(mock);
    if (state === 'UPCOMING') throw new BadRequestException(`This mock opens at ${OPEN_HOUR - 12}pm on Friday.`);
    if (state !== 'OPEN') throw new BadRequestException('This mock has closed. The next one is on Friday.');

    const exam = await this.prisma.studentExam.findUnique({
      where: { studentId_exam: { studentId, exam: mock.exam } },
      include: { subjects: { include: { examSubject: true } } },
    });
    if (!exam?.subjects.length) throw new BadRequestException(`Choose your ${LABEL(mock.exam)} subjects first.`);
    // English (the compulsory subject) first, like the real paper; it also sets the order results are shown in.
    const subjects = exam.subjects.map((s) => s.examSubject).sort((a, b) => Number(b.isCompulsory) - Number(a.isCompulsory) || a.name.localeCompare(b.name));
    const notReady = (await this.readiness(subjects)).filter((s) => s.available === 0);
    if (notReady.length) throw new BadRequestException(`We don’t have questions for ${notReady.map((s) => s.name).join(' and ')} yet, so this mock can’t start.`);

    const questions: Questions = {};
    for (const s of subjects) questions[s.id] = await this.pick(studentId, s.id, s.mockQuestions ?? DEFAULT_PER_SUBJECT);

    const now = new Date();
    const deadlineAt = new Date(Math.min(now.getTime() + mock.durationMinutes * 60_000, mock.closesAt.getTime()));
    try {
      const sitting = await this.prisma.mockSitting.create({ data: { mockId, studentId, startedAt: now, deadlineAt, questions } });
      return { sittingId: sitting.id };
    } catch {
      // Two taps at once: the other request already created it.
      const again = await this.prisma.mockSitting.findUniqueOrThrow({ where: { mockId_studentId: { mockId, studentId } } });
      return { sittingId: again.id };
    }
  }

  /**
   * A paper for one subject, mirroring the exam's topic mix: each topic gets a share of the
   * questions by how much of past papers it took. Unseen questions first, then the least recently seen.
   */
  private async pick(studentId: string, examSubjectId: string, count: number) {
    const [pool, topics, seen] = await Promise.all([
      this.prisma.examQuestion.findMany({ where: { examSubjectId, status: 'APPROVED' }, select: { id: true, topic: { select: { id: true, parentId: true } } } }),
      this.prisma.syllabusTopic.findMany({ where: { examSubjectId, parentId: null }, select: { id: true, weight: true } }),
      this.prisma.questionSeen.findMany({ where: { studentId, question: { examSubjectId } }, select: { questionId: true, lastSeenAt: true } }),
    ]);
    const seenAt = new Map(seen.map((s) => [s.questionId, s.lastSeenAt.getTime()]));
    const rank = (id: string) => seenAt.get(id) ?? -1; // unseen sorts first
    const byTopic = new Map<string, string[]>();
    for (const q of pool) {
      const root = q.topic.parentId ?? q.topic.id;
      byTopic.set(root, [...(byTopic.get(root) ?? []), q.id]);
    }
    for (const ids of byTopic.values()) ids.sort((a, b) => rank(a) - rank(b) || Math.random() - 0.5);

    const total = topics.reduce((sum, t) => sum + (t.weight ?? 0), 0);
    const chosen: string[] = [];
    for (const t of topics) {
      const share = total > 0 ? (t.weight ?? 0) / total : 1 / Math.max(1, topics.length);
      chosen.push(...(byTopic.get(t.id) ?? []).splice(0, Math.round(share * count)));
    }
    // Top up from whatever is left (topics without weights, rounding), still unseen first.
    const rest = [...byTopic.values()].flat().sort((a, b) => rank(a) - rank(b));
    chosen.push(...rest.slice(0, Math.max(0, count - chosen.length)));
    return chosen.slice(0, count).sort(() => Math.random() - 0.5);
  }

  private async own(studentId: string, sittingId: string) {
    const s = await this.prisma.mockSitting.findUnique({ where: { id: sittingId }, include: { mock: true } });
    if (!s || s.studentId !== studentId) throw new NotFoundException('Sitting not found.');
    return s;
  }

  /** The paper, without answers, plus what they've answered so far (so a crash or a dead battery loses nothing). */
  async paper(studentId: string, sittingId: string) {
    const s = await this.own(studentId, sittingId);
    const qs = s.questions as Questions;
    const ids = Object.values(qs).flat();
    const [rows, subjects] = await Promise.all([
      this.prisma.examQuestion.findMany({ where: { id: { in: ids } }, select: { id: true, stem: true, options: true } }),
      this.prisma.examSubject.findMany({ where: { id: { in: Object.keys(qs) } }, select: { id: true, name: true, isCompulsory: true } }),
    ]);
    const byId = new Map(rows.map((q) => [q.id, q]));
    subjects.sort((a, b) => Number(b.isCompulsory) - Number(a.isCompulsory)); // English first, like the real CBT
    return {
      sittingId: s.id,
      title: s.mock.title,
      exam: s.mock.exam,
      deadlineAt: s.deadlineAt,
      serverNow: new Date(),
      submitted: !!s.submittedAt || s.deadlineAt.getTime() + GRACE_MS < Date.now(),
      answers: s.answers as Answers,
      subjects: subjects.map((sub) => ({
        id: sub.id,
        name: sub.name,
        questions: qs[sub.id].flatMap((id) => {
          const q = byId.get(id);
          return q ? [{ id: q.id, prompt: q.stem, options: q.options as Option[] }] : [];
        }),
      })),
    };
  }

  /** Saves answers as they go. Only questions on their paper, and only until the deadline. */
  async save(studentId: string, sittingId: string, answers: Answers) {
    const s = await this.own(studentId, sittingId);
    if (s.submittedAt) throw new BadRequestException('You’ve already submitted this mock.');
    if (s.deadlineAt.getTime() + GRACE_MS < Date.now()) throw new BadRequestException('Time is up. Your answers up to the deadline were kept.');
    const allowed = new Set(Object.values(s.questions as Questions).flat());
    const clean = Object.fromEntries(Object.entries(answers).filter(([q, o]) => allowed.has(q) && typeof o === 'string' && o.length <= 8));
    await this.prisma.mockSitting.update({ where: { id: s.id }, data: { answers: { ...(s.answers as Answers), ...clean } } });
    return { saved: Object.keys(clean).length };
  }

  async submit(studentId: string, sittingId: string, answers: Answers) {
    const s = await this.own(studentId, sittingId);
    if (!s.submittedAt && s.deadlineAt.getTime() + GRACE_MS >= Date.now()) await this.save(studentId, sittingId, answers);
    await this.grade(s.id);
    return this.result(studentId, sittingId);
  }

  /** Marks a sitting once (submitted, or time ran out): scores, seen questions with reviews, XP. */
  private async grade(sittingId: string) {
    const s = await this.prisma.mockSitting.findUniqueOrThrow({ where: { id: sittingId }, include: { mock: true } });
    if (s.submittedAt) return;
    const qs = s.questions as Questions;
    const answers = s.answers as Answers;
    const [rows, subjects] = await Promise.all([
      this.prisma.examQuestion.findMany({ where: { id: { in: Object.values(qs).flat() } }, select: { id: true, answerId: true } }),
      this.prisma.examSubject.findMany({ where: { id: { in: Object.keys(qs) } }, select: { id: true, name: true } }),
    ]);
    const key = new Map(rows.map((q) => [q.id, q.answerId]));
    const names = new Map(subjects.map((x) => [x.id, x.name]));
    const subjectScores: Record<string, SubjectScore> = {};
    let correct = 0;
    let total = 0;
    for (const [sid, ids] of Object.entries(qs)) {
      const right = ids.filter((id) => answers[id] && answers[id] === key.get(id)).length;
      subjectScores[sid] = { name: names.get(sid) ?? 'Subject', correct: right, total: ids.length, score: ids.length ? Math.round((right / ids.length) * 100) : 0 };
      correct += right;
      total += ids.length;
    }
    // JAMB: each subject out of 100, added up (out of 400). Others: a percentage.
    const score = s.mock.exam === 'JAMB' ? Object.values(subjectScores).reduce((sum, x) => sum + x.score, 0) : total ? Math.round((correct / total) * 100) : 0;

    const now = new Date();
    const reviewDue = new Date(now.getTime() + REVIEW_AFTER_DAYS * 86_400_000);
    const { coinsPerMock } = await this.settings.get();
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.mockSitting.updateMany({ where: { id: s.id, submittedAt: null }, data: { submittedAt: now, score, subjectScores } });
      if (!claimed.count) return; // marked by another request
      for (const id of Object.values(qs).flat()) {
        const ok = !!answers[id] && answers[id] === key.get(id);
        await tx.questionSeen.upsert({
          where: { studentId_questionId: { studentId: s.studentId, questionId: id } },
          create: { studentId: s.studentId, questionId: id, lastCorrect: ok, reviewDueAt: ok ? null : reviewDue },
          update: { lastSeenAt: now, lastCorrect: ok, timesSeen: { increment: 1 }, reviewDueAt: ok ? null : reviewDue },
        });
        await tx.examQuestion.update({ where: { id }, data: { timesServed: { increment: 1 }, timesCorrect: { increment: ok ? 1 : 0 } } });
      }
      await this.game.awardXp(tx, s.studentId, XP_FINISH + correct, 'ACTIVITY', s.id, { amount: coinsPerMock, reason: 'MOCK' });
    });
  }

  /** Score straight away; rank, and the answers with explanations, once the window has closed. */
  async result(studentId: string, sittingId: string) {
    let s = await this.own(studentId, sittingId);
    if (!s.submittedAt && s.deadlineAt.getTime() + GRACE_MS < Date.now()) {
      await this.grade(s.id);
      s = await this.own(studentId, sittingId);
    }
    if (!s.submittedAt) throw new BadRequestException('Finish the mock to see your result.');
    const sat = await this.prisma.mockSitting.count({ where: { mockId: s.mockId } });
    const closed = Date.now() >= s.mock.closesAt.getTime();
    let review = null;
    if (closed) {
      const qs = s.questions as Questions;
      const answers = s.answers as Answers;
      const rows = await this.prisma.examQuestion.findMany({ where: { id: { in: Object.values(qs).flat() } }, select: { id: true, stem: true, options: true, answerId: true, explanation: true } });
      const byId = new Map(rows.map((q) => [q.id, q]));
      const scores = (s.subjectScores as Record<string, SubjectScore> | null) ?? {};
      review = Object.entries(qs).map(([sid, ids]) => ({
        subjectId: sid,
        name: scores[sid]?.name ?? 'Subject',
        questions: ids.flatMap((id) => {
          const q = byId.get(id);
          return q ? [{ id, prompt: q.stem, options: q.options as Option[], chosen: answers[id] ?? null, answerId: q.answerId, explanation: q.explanation }] : [];
        }),
      }));
    }
    return { ...this.summary(s, s.mock, sat), closesAt: s.mock.closesAt, review };
  }

  /** Every few minutes: mark sittings whose time ran out, and once a window closes, rank everyone and tell families. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async finalise() {
    const due = await this.prisma.mockExam.findMany({ where: { closesAt: { lte: new Date() }, status: { not: 'RESULTS_OUT' } } });
    for (const mock of due) {
      try {
        await this.release(mock);
      } catch (e) {
        this.log.error(`Releasing ${mock.title} failed: ${(e as Error).message}`);
      }
    }
  }

  async release(mock: MockExam) {
    const open = await this.prisma.mockSitting.findMany({ where: { mockId: mock.id, submittedAt: null }, select: { id: true } });
    for (const s of open) await this.grade(s.id);

    const sittings = await this.prisma.mockSitting.findMany({
      where: { mockId: mock.id },
      orderBy: { score: 'desc' },
      include: { student: { include: { user: true, guardians: { where: { confirmedAt: { not: null } }, select: { parentId: true } } } } },
    });
    const n = sittings.length;
    // Sorted best first. Ties share a rank (1, 2, 2, 4). Percentile: the share of other candidates they beat.
    const ranks: number[] = [];
    sittings.forEach((s, i) => ranks.push(i > 0 && s.score === sittings[i - 1].score ? ranks[i - 1] : i + 1));
    const updates: Prisma.PrismaPromise<unknown>[] = sittings.map((s, i) => {
      let below = n - i - 1;
      for (let j = i + 1; j < n && sittings[j].score === s.score; j++) below--;
      const percentile = n > 1 ? Math.round((below / (n - 1)) * 1000) / 10 : 100;
      return this.prisma.mockSitting.update({ where: { id: s.id }, data: { nationalRank: ranks[i], percentile } });
    });
    updates.push(this.prisma.mockExam.update({ where: { id: mock.id }, data: { status: 'RESULTS_OUT' } }));
    await this.prisma.$transaction(updates);
    this.log.log(`${mock.title}: results out for ${n} candidates`);
    // Ranks are final: hand out mock stickers. The app celebrates them next time each child opens it.
    for (const s of sittings) {
      await this.prisma.$transaction((tx) => this.game.checkStickers(tx, s.studentId)).catch((e: Error) => this.log.error(`Mock stickers for ${s.studentId} failed: ${e.message}`));
    }

    for (const [i, s] of sittings.entries()) {
      const subjects = Object.keys((s.subjectScores as Record<string, SubjectScore> | null) ?? {}).length;
      const line = `${s.score}/${OUT_OF(mock.exam, subjects)} · ranked ${ranks[i].toLocaleString()} of ${n.toLocaleString()}`;
      this.messaging.notify([s.student.userId], 'examResults', { title: `Your ${mock.title} result is out`, body: `${line}. See which questions to review.`, url: '/student/mocks' });
      const parents = s.student.guardians.map((g) => g.parentId);
      if (parents.length) this.messaging.notify(parents, 'examResults', { title: `${s.student.user.firstName}'s ${LABEL(mock.exam)} mock result`, body: `${s.student.user.firstName} scored ${line}.`, url: `/parent/children/${s.studentId}` });
    }
  }
}
