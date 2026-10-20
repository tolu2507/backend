import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { subjectStyle } from '../catalog/catalog.js';
import { lagosDay, lagosMidnightInstant } from '../common/dates.js';
import { grade, publicQuestions, type StoredQuestion } from '../common/quiz.js';
import { formatShopCode } from '../common/shop-code.js';
import { GamificationService } from '../gamification/gamification.service.js';
import { levelFor, starsFor } from '../gamification/levels.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { COINS_PER_REWARD, REWARD_KOBO } from '../plan/plan.js';
import { PlanService } from '../plan/plan.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const LESSON_QUIZ_XP = 50;

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly game: GamificationService,
    private readonly ledger: LedgerService,
    private readonly plan: PlanService,
  ) {}

  async profile(userId: string) {
    const p = await this.prisma.studentProfile.findUnique({ where: { userId }, include: { user: true } });
    if (!p) throw new ForbiddenException('This account is not a student account.');
    return p;
  }

  async home(userId: string) {
    const p = await this.profile(userId);
    const since = lagosMidnightInstant(lagosDay());

    const [quizzes, activities, doneToday, league, practice, earning, converted] = await Promise.all([
      this.prisma.lessonQuiz.findMany({
        where: { studentId: p.id, status: 'PENDING' },
        orderBy: { dueAt: 'asc' },
        include: { session: { include: { booking: { include: { tutor: { include: { user: true } } } } } } },
      }),
      this.prisma.learningActivity.findMany({
        where: { isPublished: true, level: p.level, OR: [{ schoolId: null }, ...(p.schoolId ? [{ schoolId: p.schoolId }] : [])] },
        orderBy: [{ subject: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.activityAttempt.findMany({ where: { studentId: p.id, completedAt: { gte: since } }, select: { activityId: true, score: true } }),
      this.game.league(p.id),
      this.plan.practiceToday(p.id),
      this.plan.rewardsParent(p.id),
      this.prisma.coinEvent.count({ where: { studentId: p.id, reason: 'CONVERTED' } }),
    ]);

    // One activity per subject keeps the day focused; finished ones stay visible as "Done".
    const doneIds = new Set(doneToday.map((a) => a.activityId));
    const perSubject = new Map<string, (typeof activities)[number]>();
    for (const a of activities) {
      const current = perSubject.get(a.subject);
      if (!current || (doneIds.has(current.id) && !doneIds.has(a.id))) perSubject.set(a.subject, a);
    }
    const todays = [...perSubject.values()].slice(0, 4);

    const quests = [
      ...quizzes.map((q) => ({
        id: q.id,
        kind: 'LESSON_QUIZ' as const,
        title: q.title,
        subject: q.title.split(' · ')[0],
        subtitle: `From your lesson with ${q.session.booking.tutor.user.firstName}`,
        xpReward: LESSON_QUIZ_XP,
        progress: 0,
        ...subjectStyle(q.title),
      })),
      ...todays.map((a) => ({
        id: a.id,
        kind: 'ACTIVITY' as const,
        title: a.title,
        subject: a.subject,
        xpReward: a.xpReward,
        progress: doneIds.has(a.id) ? 1 : 0,
        ...subjectStyle(a.subject),
      })),
    ];

    const next = todays.find((a) => !doneIds.has(a.id));
    const doneCount = todays.filter((a) => doneIds.has(a.id)).length;

    return {
      firstName: p.user.firstName,
      level: p.level,
      gradeName: p.gradeName,
      xp: levelFor(p.xpTotal),
      streak: p.currentStreak,
      stars: starsFor(p.xpTotal),
      league: league.league,
      quests,
      adventure: next ? { activityId: next.id, title: next.title, step: doneCount + 1, steps: todays.length } : null,
      practice,
      // Earn while you learn. null on the free plan: children never see anything about paying.
      coins: earning ? { balance: p.coins, target: COINS_PER_REWARD, rewardKobo: REWARD_KOBO.toString(), earnedKobo: (BigInt(converted) * REWARD_KOBO).toString() } : null,
    };
  }

  async league(userId: string) {
    const p = await this.profile(userId);
    return this.game.league(p.id);
  }

  async badges(userId: string) {
    const p = await this.profile(userId);
    return this.game.stickerBook(p.id);
  }

  async badgesSeen(userId: string, ids: string[]) {
    const p = await this.profile(userId);
    return this.game.markStickersSeen(p.id, ids);
  }

  async activity(userId: string, id: string) {
    const p = await this.profile(userId);
    const a = await this.prisma.learningActivity.findFirst({ where: { id, isPublished: true, level: p.level } });
    if (!a) throw new NotFoundException('That quest is not available.');
    const content = a.content as { questions: StoredQuestion[] };
    return { id: a.id, kind: 'ACTIVITY', title: a.title, subject: a.subject, xpReward: a.xpReward, questions: publicQuestions(content.questions) };
  }

  async submitActivity(userId: string, id: string, answers: Record<string, string>) {
    const p = await this.profile(userId);
    const a = await this.prisma.learningActivity.findFirst({ where: { id, isPublished: true, level: p.level } });
    if (!a) throw new NotFoundException('That quest is not available.');
    const result = grade((a.content as { questions: StoredQuestion[] }).questions, answers);

    // XP only for the first finish of an activity each day, so replaying is practice, not farming.
    const already = await this.prisma.activityAttempt.findFirst({
      where: { studentId: p.id, activityId: a.id, completedAt: { gte: lagosMidnightInstant(lagosDay()) } },
    });
    const xpEarned = already ? 0 : Math.max(1, Math.round(a.xpReward * result.score));

    const rewards = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.activityAttempt.create({
        data: { studentId: p.id, activityId: a.id, completedAt: new Date(), score: result.score, answers, xpEarned },
      });
      return this.game.awardXp(tx, p.id, xpEarned, 'ACTIVITY', attempt.id);
    });
    return { ...result, xpEarned, rewards };
  }

  async quiz(userId: string, id: string) {
    const p = await this.profile(userId);
    const q = await this.prisma.lessonQuiz.findFirst({ where: { id, studentId: p.id } });
    if (!q) throw new NotFoundException('Quiz not found.');
    return {
      id: q.id,
      kind: 'LESSON_QUIZ',
      title: q.title,
      status: q.status,
      xpReward: LESSON_QUIZ_XP,
      score: q.score,
      questions: publicQuestions(q.questions as StoredQuestion[]),
    };
  }

  async submitQuiz(userId: string, id: string, answers: Record<string, string>) {
    const p = await this.profile(userId);
    const q = await this.prisma.lessonQuiz.findFirst({ where: { id, studentId: p.id } });
    if (!q) throw new NotFoundException('Quiz not found.');
    if (q.status !== 'PENDING') throw new BadRequestException('You already finished this quiz.');
    const result = grade(q.questions as StoredQuestion[], answers);
    const xpEarned = Math.max(10, Math.round(LESSON_QUIZ_XP * result.score));

    const rewards = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.lessonQuiz.updateMany({
        where: { id: q.id, status: 'PENDING' },
        data: { status: 'COMPLETED', answers, score: result.score, xpEarned, completedAt: new Date() },
      });
      if (claimed.count === 0) throw new BadRequestException('You already finished this quiz.');
      const r = await this.game.awardXp(tx, p.id, xpEarned, 'ACTIVITY', q.id);
      const extra = await this.game.grant(tx, p.id, ['FIRST_LESSON_QUIZ', ...(result.score === 1 ? ['PERFECT_SCORE'] : [])]);
      return { ...r, newBadges: [...r.newBadges, ...extra] };
    });
    // Finishing the quiz proves the lesson happened, so the tutor gets paid.
    await this.ledger.releaseEscrow(q.sessionId, 'student completed the lesson quiz');
    return { ...result, xpEarned, rewards };
  }

  async wallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId_type: { userId, type: 'STUDENT_SPEND' } },
      include: { entries: { orderBy: { createdAt: 'desc' }, take: 30 } },
    });
    const profile = await this.prisma.studentProfile.findUniqueOrThrow({ where: { userId }, include: { school: { select: { id: true, name: true } } } });
    return {
      balanceKobo: wallet?.balanceKobo ?? 0n,
      shopCode: formatShopCode(profile.shopCode),
      school: profile.school,
      dailyLimitKobo: profile.dailySpendLimitKobo,
      spentTodayKobo: wallet ? await this.ledger.tuckShopSpentToday(this.prisma, wallet.id) : 0n,
      entries: (wallet?.entries ?? []).map((e) => ({ id: e.id, amountKobo: e.amountKobo, description: e.description ?? '', createdAt: e.createdAt })),
    };
  }
}
