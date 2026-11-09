import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { subjectStyle } from '../catalog/catalog.js';
import { lagosDay, lagosMidnightInstant } from '../common/dates.js';
import { grade, publicQuestions, type StoredQuestion } from '../common/quiz.js';
import { formatShopCode } from '../common/shop-code.js';
import { GamificationService } from '../gamification/gamification.service.js';
import { levelFor, starsFor } from '../gamification/levels.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { PlanService } from '../plan/plan.service.js';
import { rewardKobo } from '../settings/settings.js';
import { SettingsService } from '../settings/settings.service.js';
import { DAILY_PREFIX, DAILY_XP, dailyQuestCards, dailyQuestions, dailyRef, dailySubjects, hasDailyQuests, isDaily, markSeen } from './daily-quests.js';
import { PrismaService } from '../prisma/prisma.service.js';

const LESSON_QUIZ_XP = 50;

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly game: GamificationService,
    private readonly ledger: LedgerService,
    private readonly plan: PlanService,
    private readonly settings: SettingsService,
  ) {}

  async profile(userId: string) {
    const p = await this.prisma.studentProfile.findUnique({ where: { userId }, include: { user: true } });
    if (!p) throw new ForbiddenException('This account is not a student account.');
    return p;
  }

  async home(userId: string) {
    const p = await this.profile(userId);
    const since = lagosMidnightInstant(lagosDay());

    const [quizzes, activities, doneToday, league, practice, earning, earned, settings] = await Promise.all([
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
      this.game.earnedKobo([p.id]),
      this.settings.get(),
    ]);

    // One activity per subject keeps the day focused; finished ones stay visible as "Done".
    const doneIds = new Set(doneToday.map((a) => a.activityId));
    const perSubject = new Map<string, (typeof activities)[number]>();
    for (const a of activities) {
      const current = perSubject.get(a.subject);
      if (!current || (doneIds.has(current.id) && !doneIds.has(a.id))) perSubject.set(a.subject, a);
    }
    const todays = [...perSubject.values()].slice(0, 4);

    // Fresh questions from the bank every day; the hand-made activities are only a fallback
    // (a child with no subjects yet, or a subject whose bank has run dry).
    const daily = hasDailyQuests(p.level) ? await dailyQuestCards(this.prisma, p.id) : [];

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
      ...(daily.length
        ? daily
        : todays.map((a) => ({
            id: a.id,
            kind: 'ACTIVITY' as const,
            title: a.title,
            subject: a.subject,
            xpReward: a.xpReward,
            progress: doneIds.has(a.id) ? 1 : 0,
            ...subjectStyle(a.subject),
          }))),
    ];

    const steps = daily.length
      ? daily.map((d) => ({ id: d.id, title: d.title, done: d.progress === 1 }))
      : todays.map((a) => ({ id: a.id, title: a.title, done: doneIds.has(a.id) }));
    const next = steps.find((x) => !x.done);
    const doneCount = steps.filter((x) => x.done).length;

    return {
      firstName: p.user.firstName,
      avatar: p.avatar,
      level: p.level,
      gradeName: p.gradeName,
      xp: levelFor(p.xpTotal),
      streak: p.currentStreak,
      stars: starsFor(p.xpTotal),
      league: league.league,
      quests,
      adventure: next ? { activityId: next.id, title: next.title, step: doneCount + 1, steps: steps.length } : null,
      practice,
      // Earn while you learn. null on the free plan: children never see anything about paying.
      coins:
        earning && settings.rewardsEnabled
          ? { balance: p.coins, target: settings.coinsPerReward, rewardKobo: rewardKobo(settings).toString(), earnedKobo: (earned.get(p.id) ?? 0n).toString(), perCorrect: settings.coinsPerCorrect }
          : null,
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

  async badgeStats(userId: string, badgeId: string) {
    const p = await this.profile(userId);
    const stats = await this.game.stickerStats(p.id, badgeId);
    if (!stats) throw new NotFoundException('Collect this sticker first.');
    return stats;
  }

  async setAvatar(userId: string, avatar: string | null) {
    const p = await this.profile(userId);
    await this.prisma.studentProfile.update({ where: { id: p.id }, data: { avatar } });
    return { avatar };
  }

  async badgesSeen(userId: string, ids: string[]) {
    const p = await this.profile(userId);
    return this.game.markStickersSeen(p.id, ids);
  }

  async activity(userId: string, id: string) {
    const p = await this.profile(userId);
    if (isDaily(id)) {
      const { subject, questions } = await this.dailyQuest(p.id, id);
      return { id, kind: 'ACTIVITY', title: `${subject}: today’s quest`, subject, xpReward: DAILY_XP, questions: publicQuestions(questions) };
    }
    const a = await this.prisma.learningActivity.findFirst({ where: { id, isPublished: true, level: p.level } });
    if (!a) throw new NotFoundException('That quest is not available.');
    const content = a.content as { questions: StoredQuestion[] };
    return { id: a.id, kind: 'ACTIVITY', title: a.title, subject: a.subject, xpReward: a.xpReward, questions: publicQuestions(content.questions) };
  }

  async submitActivity(userId: string, id: string, answers: Record<string, string>) {
    const p = await this.profile(userId);
    if (isDaily(id)) return this.submitDaily(p.id, id, answers);
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

  /** Today's questions for a daily quest id ("daily-<examSubjectId>"), for one of the child's own subjects. */
  private async dailyQuest(studentId: string, id: string) {
    const examSubjectId = id.slice(DAILY_PREFIX.length);
    const mine = (await dailySubjects(this.prisma, studentId)).find((s) => s.id === examSubjectId);
    if (!mine) throw new NotFoundException('That quest is not available.');
    const questions = await dailyQuestions(this.prisma, studentId, examSubjectId);
    if (!questions.length) throw new NotFoundException('That quest is not available.');
    return { examSubjectId, subject: mine.name.replace(/\s*\(.*\)\s*$/, ''), questions };
  }

  private async submitDaily(studentId: string, id: string, answers: Record<string, string>) {
    const { examSubjectId, questions } = await this.dailyQuest(studentId, id);
    const result = grade(questions, answers);
    const ref = dailyRef(examSubjectId);
    // XP only for the first finish each day; replaying is practice, not farming.
    const already = await this.prisma.xpEvent.findFirst({ where: { studentId, refId: ref }, select: { id: true } });
    const xpEarned = already ? 0 : Math.max(1, Math.round(DAILY_XP * result.score));
    const rewards = await this.prisma.$transaction(async (tx) => {
      await markSeen(tx, studentId, result.results);
      return this.game.awardXp(tx, studentId, xpEarned, 'ACTIVITY', ref);
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
