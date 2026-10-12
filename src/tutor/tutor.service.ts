import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { EducationLevel, Prisma } from '@prisma/client';

import { AiService, type QuizQuestion } from '../ai/ai.service.js';
import { isSubject, LEVEL_LABEL } from '../catalog/catalog.js';
import { addDays, lagosTime } from '../common/dates.js';
import { applyBp } from '../common/money.js';
import { grade, publicQuestions, type StoredQuestion } from '../common/quiz.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CompleteSessionDto, IdCheckDto, ScheduleDto, TutorProfileDto } from './tutor.dto.js';

const RETAKE_DAYS = 7;
type Stage = 'PROFILE' | 'ID_CHECK' | 'SUBJECT_TEST' | 'INTERVIEW' | 'APPROVED' | 'REJECTED';
type TestStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'NO_TEST_YET';

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly messaging: MessagingService,
  ) {}

  private async load(userId: string) {
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { userId },
      include: { subjects: true, applications: { orderBy: { createdAt: 'desc' }, take: 1, include: { attempts: { include: { test: true }, orderBy: { startedAt: 'desc' } } } } },
    });
    if (!profile || !profile.applications[0]) throw new ForbiddenException('Start a lesson-teacher application first.');
    return { profile, app: profile.applications[0] };
  }

  async application(userId: string) {
    const { profile, app } = await this.load(userId);
    const applied = (app.subjectsApplied as { subject: string; level: EducationLevel }[]) ?? [];
    const tests = await this.prisma.vettingTest.findMany({ where: { isActive: true }, select: { subject: true, level: true } });
    const hasTest = (s: string, l: EducationLevel) => tests.some((t) => t.subject === s && t.level === l);

    const subjects = applied.map(({ subject, level }) => {
      const attempts = app.attempts.filter((a) => a.test.subject === subject && a.test.level === level);
      const latest = attempts[0];
      let testStatus: TestStatus = hasTest(subject, level) ? 'NOT_STARTED' : 'NO_TEST_YET';
      if (latest) {
        if (latest.status === 'GRADED') testStatus = latest.passed ? 'PASSED' : 'FAILED';
        else if (latest.expiresAt > new Date()) testStatus = 'IN_PROGRESS';
      }
      const retakeAt = testStatus === 'FAILED' && latest?.gradedAt ? addDays(latest.gradedAt, RETAKE_DAYS) : null;
      return { subject, level, testStatus, score: latest?.finalScore ?? null, retakeAt: retakeAt && retakeAt > new Date() ? retakeAt : null };
    });

    const refs = (app.referees as unknown[] | null) ?? [];
    let stage: Stage;
    if (profile.verificationStatus === 'VERIFIED') stage = 'APPROVED';
    else if (app.status === 'REJECTED') stage = 'REJECTED';
    else if (!profile.headline || profile.rateKobo === 0n || !applied.length) stage = 'PROFILE';
    else if (!app.ninNumber || refs.length < 2) stage = 'ID_CHECK';
    else if (subjects.some((s) => s.testStatus === 'PASSED') && !subjects.some((s) => s.testStatus === 'IN_PROGRESS')) stage = 'INTERVIEW';
    else stage = 'SUBJECT_TEST';

    const status = { PROFILE: 'SUBMITTED', ID_CHECK: 'SUBMITTED', SUBJECT_TEST: 'TEST_ASSIGNED', INTERVIEW: 'INTERVIEW', APPROVED: 'APPROVED', REJECTED: 'REJECTED' } as const;
    if (app.status !== status[stage]) await this.prisma.tutorApplication.update({ where: { id: app.id }, data: { status: status[stage] } });

    return {
      id: app.id,
      stage,
      decisionReason: stage === 'REJECTED' ? 'Your application was not approved this time.' : null,
      interviewAt: app.interviewAt,
      profile: {
        headline: profile.headline,
        bio: profile.bio,
        yearsExperience: profile.yearsExperience,
        qualifications: profile.qualifications,
        mode: profile.mode,
        state: profile.state,
        lga: profile.lga,
        rateKobo: profile.rateKobo,
        isAcceptingStudents: profile.isAcceptingStudents,
      },
      idCheck: { ninProvided: !!app.ninNumber, refereeCount: refs.length },
      subjects,
    };
  }

  async saveProfile(userId: string, dto: TutorProfileDto) {
    const { profile, app } = await this.load(userId);
    for (const s of dto.subjects) if (!isSubject(s.subject, s.level)) throw new BadRequestException(`${s.subject} isn't a ${LEVEL_LABEL[s.level]} subject.`);
    const unique = [...new Map(dto.subjects.map((s) => [`${s.subject}|${s.level}`, s])).values()];

    await this.prisma.$transaction([
      this.prisma.tutorProfile.update({
        where: { id: profile.id },
        data: { headline: dto.headline, bio: dto.bio, yearsExperience: dto.yearsExperience, qualifications: dto.qualifications, mode: dto.mode, state: dto.state, lga: dto.lga || null, rateKobo: BigInt(dto.rateKobo) },
      }),
      this.prisma.tutorApplication.update({ where: { id: app.id }, data: { subjectsApplied: unique.map((s) => ({ subject: s.subject, level: s.level })) } }),
      ...unique.map((s) =>
        this.prisma.tutorSubject.upsert({
          where: { tutorId_subject_level: { tutorId: profile.id, subject: s.subject, level: s.level } },
          update: {},
          create: { tutorId: profile.id, subject: s.subject, level: s.level },
        }),
      ),
    ]);
    return this.application(userId);
  }

  async saveIdCheck(userId: string, dto: IdCheckDto) {
    const { app } = await this.load(userId);
    await this.prisma.tutorApplication.update({ where: { id: app.id }, data: { ninNumber: dto.ninNumber, referees: dto.referees.map((r) => ({ ...r })) } });
    return this.application(userId);
  }

  /** Resumes an unfinished attempt or starts a new one for this subject. */
  async startTest(userId: string, subject: string, level: EducationLevel) {
    const state = await this.application(userId);
    if (state.stage === 'PROFILE' || state.stage === 'ID_CHECK') throw new BadRequestException('Finish your profile and ID check before taking a test.');
    const entry = state.subjects.find((s) => s.subject === subject && s.level === level);
    if (!entry) throw new BadRequestException('Add this subject to your profile first.');
    if (entry.testStatus === 'PASSED') throw new BadRequestException('You already passed this test.');
    if (entry.retakeAt) throw new BadRequestException(`You can retake this test from ${entry.retakeAt.toDateString()}.`);

    const { app } = await this.load(userId);
    const test = await this.prisma.vettingTest.findFirst({ where: { subject, level, isActive: true }, orderBy: { version: 'desc' } });
    if (!test) throw new NotFoundException(`We don't have a ${subject} test for this level yet. We'll message you when it's ready.`);

    let attempt = app.attempts.find((a) => a.testId === test.id && a.status !== 'GRADED' && a.expiresAt > new Date());
    attempt ??= await this.prisma.tutorTestAttempt.create({
      data: { applicationId: app.id, testId: test.id, status: 'IN_PROGRESS', startedAt: new Date(), expiresAt: new Date(Date.now() + test.durationMinutes * 60_000) },
      include: { test: true },
    });
    return { attemptId: attempt.id, title: `${subject} · ${LEVEL_LABEL[level]}`, passMark: test.passMark, expiresAt: attempt.expiresAt, questions: publicQuestions(test.questions as StoredQuestion[]) };
  }

  async submitTest(userId: string, attemptId: string, answers: Record<string, string>, appSwitches = 0) {
    const { profile, app } = await this.load(userId);
    const attempt = app.attempts.find((a) => a.id === attemptId);
    if (!attempt) throw new NotFoundException('Test not found.');
    if (attempt.status === 'GRADED') throw new BadRequestException('This test was already submitted.');

    const result = grade(attempt.test.questions as StoredQuestion[], answers);
    const late = Date.now() > attempt.expiresAt.getTime() + 60_000; // 1 minute grace for slow networks
    const passed = !late && result.score >= attempt.test.passMark;

    await this.prisma.$transaction(async (tx) => {
      await tx.tutorTestAttempt.update({
        where: { id: attempt.id },
        data: { status: 'GRADED', submittedAt: new Date(), answers, autoScore: result.score, finalScore: result.score, passed, gradedAt: new Date(), integrityFlags: { appSwitches, late } },
      });
      if (passed) {
        await tx.tutorSubject.update({
          where: { tutorId_subject_level: { tutorId: profile.id, subject: attempt.test.subject, level: attempt.test.level } },
          data: { testScore: result.score, approvedAt: new Date(), attemptId: attempt.id },
        });
      }
    });
    return { score: result.score, correct: result.correct, total: result.total, passed, passMark: attempt.test.passMark, late };
  }

  // ── After approval ────────────────────────────────────────

  private async approved(userId: string) {
    const profile = await this.prisma.tutorProfile.findUnique({ where: { userId } });
    if (!profile || profile.verificationStatus !== 'VERIFIED') throw new ForbiddenException('This opens once you are Nexus approved.');
    return profile;
  }

  async setAvailability(userId: string, accepting: boolean) {
    const p = await this.approved(userId);
    await this.prisma.tutorProfile.update({ where: { id: p.id }, data: { isAcceptingStudents: accepting } });
    return { accepting };
  }

  async bookings(userId: string) {
    const p = await this.approved(userId);
    const rows = await this.prisma.tutorBooking.findMany({
      where: { tutorId: p.id, status: { in: ['PENDING', 'ACTIVE'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        parent: true,
        student: { include: { user: true } },
        request: true,
        sessions: { orderBy: { scheduledAt: 'asc' }, include: { quiz: true } },
      },
    });
    return rows.map((b) => ({
      id: b.id,
      status: b.status,
      student: { firstName: b.student.user.firstName, grade: b.student.gradeName ?? LEVEL_LABEL[b.student.level] },
      parent: { firstName: b.parent.firstName, phone: b.status === 'ACTIVE' ? b.parent.phone : null },
      subject: b.request?.subject ?? null,
      goals: b.request?.goals ?? null,
      mode: b.request?.mode ?? null,
      area: [b.request?.lga, b.request?.state].filter(Boolean).join(', ') || null,
      days: ((b.request?.schedule as { days?: string[] } | undefined)?.days ?? []),
      sessions: b.sessions.map((s) => ({
        id: s.id,
        scheduledAt: s.scheduledAt,
        durationMinutes: s.durationMinutes,
        status: s.status,
        escrowStatus: s.escrowStatus,
        isTrial: s.isTrial,
        tutorFeeKobo: s.tutorFeeKobo,
        quiz: s.quiz ? { status: s.quiz.status, score: s.quiz.score } : null,
      })),
    }));
  }

  private async ownBooking(userId: string, bookingId: string) {
    const p = await this.approved(userId);
    const b = await this.prisma.tutorBooking.findFirst({ where: { id: bookingId, tutorId: p.id }, include: { sessions: true } });
    if (!b) throw new NotFoundException('Booking not found.');
    return b;
  }

  async respond(userId: string, bookingId: string, accept: boolean) {
    const b = await this.ownBooking(userId, bookingId);
    if (b.status !== 'PENDING') throw new BadRequestException('You already answered this request.');
    await this.prisma.tutorBooking.update({ where: { id: b.id }, data: { status: accept ? 'ACTIVE' : 'ENDED' } });
    this.messaging.notify([b.parentId], 'lessonReminders', {
      title: accept ? 'Your teacher said yes!' : 'Booking declined',
      body: accept ? 'They’ll schedule the free trial lesson shortly.' : 'This teacher can’t take the lessons. Pick another match from your list.',
      url: '/parent/teachers',
    });
    return { ok: true };
  }

  /** The first lesson of every booking is the free trial; later lessons are paid into escrow. */
  async schedule(userId: string, bookingId: string, dto: ScheduleDto) {
    const b = await this.ownBooking(userId, bookingId);
    if (b.status !== 'ACTIVE') throw new BadRequestException('Accept the request before scheduling lessons.');
    const at = new Date(dto.scheduledAt);
    if (at.getTime() < Date.now() - 5 * 60_000) throw new BadRequestException('Pick a time in the future.');
    const isTrial = b.sessions.length === 0;
    const tutorFee = isTrial ? 0n : (b.tutorRateKobo * BigInt(dto.durationMinutes)) / 60n;
    const platformFee = isTrial ? 0n : applyBp(tutorFee, b.platformFeeBp);
    const s = await this.prisma.tutorSession.create({
      data: {
        bookingId: b.id,
        scheduledAt: at,
        durationMinutes: dto.durationMinutes,
        isTrial,
        escrowStatus: isTrial ? 'FREE' : 'UNPAID',
        tutorFeeKobo: tutorFee,
        platformFeeKobo: platformFee,
        totalKobo: tutorFee + platformFee,
      },
    });
    this.messaging.notify([b.parentId], 'lessonReminders', {
      title: isTrial ? 'Free trial lesson booked' : 'New lesson scheduled',
      body: `${lagosTime(at)}${isTrial ? '' : '. Pay in the app to confirm it.'}`,
      url: '/parent/teachers',
    });
    return { id: s.id, isTrial, totalKobo: s.totalKobo };
  }

  /** Tutor marks the lesson done → the student gets a quiz on exactly those topics. */
  async complete(userId: string, sessionId: string, dto: CompleteSessionDto) {
    const p = await this.approved(userId);
    const s = await this.prisma.tutorSession.findFirst({
      where: { id: sessionId, booking: { tutorId: p.id } },
      include: { booking: { include: { request: true, student: true } } },
    });
    if (!s) throw new NotFoundException('Lesson not found.');
    if (s.status === 'COMPLETED') throw new BadRequestException('This lesson is already marked as done.');
    if (s.scheduledAt.getTime() > Date.now()) throw new BadRequestException('You can mark a lesson done once it has started.');
    if (s.escrowStatus === 'UNPAID') throw new BadRequestException('The parent hasn’t paid for this lesson yet.');

    const subject = s.booking.request?.subject ?? 'Lesson';
    const student = s.booking.student;
    let questions: QuizQuestion[] | null = await this.ai.lessonQuiz(
      { subject, level: student.level, grade: student.gradeName, topics: dto.topics, notes: dto.notes },
      { schoolId: student.schoolId, userId: student.userId },
    );
    let generatedBy = this.ai.model;
    if (!questions) {
      questions = await this.fallbackQuestions(subject, student.level);
      generatedBy = 'question-bank';
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.tutorSession.update({ where: { id: s.id }, data: { status: 'COMPLETED', completedAt: new Date(), topicsCovered: dto.topics, tutorNotes: dto.notes } });
      if (questions?.length) {
        await tx.lessonQuiz.create({
          data: { sessionId: s.id, studentId: student.id, title: `${subject} · ${dto.topics[0]}`, questions, generatedBy, dueAt: addDays(new Date(), 3) },
        });
      }
    });
    return { ok: true, quizCreated: !!questions?.length, quizSource: questions?.length ? generatedBy : null };
  }

  /** When AI is unavailable: five questions from the published question bank for this subject and level. */
  private async fallbackQuestions(subject: string, level: EducationLevel): Promise<QuizQuestion[] | null> {
    const activities = await this.prisma.learningActivity.findMany({ where: { subject, level, isPublished: true } });
    const pool = activities.flatMap((a) => (a.content as { questions: StoredQuestion[] }).questions);
    if (pool.length < 3) {
      this.logger.warn(`No question bank for ${subject} ${level}; lesson quiz skipped`);
      return null;
    }
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 5).map((q, i) => ({ ...q, id: `q${i + 1}` }));
  }

  async earnings(userId: string) {
    const p = await this.approved(userId);
    const [wallet, held] = await Promise.all([
      this.prisma.wallet.findUnique({ where: { userId_type: { userId, type: 'TUTOR_EARNINGS' } }, include: { entries: { orderBy: { createdAt: 'desc' }, take: 30 } } }),
      this.prisma.tutorSession.aggregate({ where: { booking: { tutorId: p.id }, escrowStatus: { in: ['HELD', 'DISPUTED'] } }, _sum: { tutorFeeKobo: true }, _count: true }),
    ]);
    return {
      balanceKobo: wallet?.balanceKobo ?? 0n,
      pendingKobo: held._sum.tutorFeeKobo ?? 0n,
      pendingLessons: held._count,
      entries: (wallet?.entries ?? []).map((e) => ({ id: e.id, amountKobo: e.amountKobo, description: e.description ?? '', createdAt: e.createdAt })),
    };
  }
}
