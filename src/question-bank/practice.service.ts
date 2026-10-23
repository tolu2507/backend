import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { GamificationService } from '../gamification/gamification.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const ROUND_SIZE = 10;
const MAX_REVIEWS = 3; // wrong answers that come back in a round, labelled "Review"
const REVIEW_AFTER_DAYS = 2;
/** Nursery children learn by repetition: a question they've had comes back (and counts) after this long. */
const NURSERY_AGAIN_AFTER_DAYS = 1;
const MIN_TO_LEVEL = 5; // a round with fewer counted answers doesn't move the level
const LEVEL_UP = 0.8;
const LEVEL_DOWN = 0.4;
const TOP_LEVEL = 5;
const XP = { correct: 5, review: 3, levelUp: 25, boss: 100 };

type Option = { id: string; label: string };

export type MapSubtopic = {
  id: string;
  name: string;
  level: number;
  mastery: number;
  answered: number;
  bossBeaten: boolean;
  /** Approved questions this student hasn't had yet. */
  fresh: number;
  unlocked: boolean;
};

const shuffle = <T>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Topic practice: each subtopic has levels 1 (easy) to 5 (hard) and a boss round at the top.
 * Students only get questions they haven't had, except wrong answers, which come back on purpose as reviews.
 */
@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly game: GamificationService,
    private readonly settings: SettingsService,
  ) {}

  async studentByUser(userId: string) {
    const p = await this.prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!p) throw new ForbiddenException('This account is not a student account.');
    return p.id;
  }

  /** The subject must be one the student picked for an exam. */
  private async assertChosen(studentId: string, examSubjectId: string) {
    const link = await this.prisma.studentExamSubject.findFirst({
      where: { examSubjectId, studentExam: { studentId } },
      include: { examSubject: true },
    });
    if (!link) throw new NotFoundException('Add this subject to your exam first.');
    return link.examSubject;
  }

  /** The subject's map: topics (most tested first), each with subtopics the student climbs in order. */
  async map(studentId: string, examSubjectId: string) {
    const subject = await this.assertChosen(studentId, examSubjectId);
    const topics = await this.prisma.syllabusTopic.findMany({
      where: { examSubjectId, parentId: null },
      include: { children: { orderBy: { order: 'asc' } } },
    });
    topics.sort((a, b) => (b.weight ?? -1) - (a.weight ?? -1) || a.order - b.order);

    const leafIds = topics.flatMap((t) => (t.children.length ? t.children.map((c) => c.id) : [t.id]));
    const [fresh, progress, reviewsDue] = await Promise.all([
      this.prisma.examQuestion.groupBy({
        by: ['topicId'],
        where: { topicId: { in: leafIds }, status: 'APPROVED', seen: { none: { studentId } } },
        _count: true,
      }),
      this.prisma.topicProgress.findMany({ where: { studentId, topicId: { in: leafIds } } }),
      this.prisma.questionSeen.count({
        where: { studentId, reviewDueAt: { lte: new Date() }, question: { examSubjectId, status: 'APPROVED' } },
      }),
    ]);
    const freshBy = new Map(fresh.map((f) => [f.topicId, f._count]));
    const progressBy = new Map(progress.map((p) => [p.topicId, p]));
    const maxYears = Math.max(0, ...topics.map((t) => t.yearsSeen ?? 0));

    let conquered = 0;
    let masterySum = 0;
    const out = topics.map((t) => {
      const leaves = t.children.length ? t.children : [t];
      let previous: MapSubtopic | null = null;
      const subtopics = leaves.map((leaf) => {
        const p = progressBy.get(leaf.id);
        const node: MapSubtopic = {
          id: leaf.id,
          name: leaf.name,
          level: p?.level ?? 1,
          mastery: p?.mastery ?? 0,
          answered: p?.answered ?? 0,
          bossBeaten: p?.bossBeaten ?? false,
          fresh: freshBy.get(leaf.id) ?? 0,
          // You climb a topic in order: the next subtopic opens once you've passed level 1 of the one before.
          // A subtopic with no questions left for them never blocks the ones after it.
          unlocked: !previous || !!p || (previous.unlocked && (previous.level >= 2 || previous.bossBeaten || previous.fresh === 0)),
        };
        if (node.bossBeaten) conquered++;
        masterySum += node.mastery;
        previous = node;
        return node;
      });
      return {
        id: t.id,
        name: t.name,
        weight: t.weight,
        yearsSeen: t.yearsSeen,
        hot: maxYears > 0 && t.yearsSeen === maxYears,
        subtopics,
      };
    });

    return {
      subject: { id: subject.id, exam: subject.exam, slug: subject.slug, name: subject.name },
      yearsAnalysed: maxYears,
      leaves: leafIds.length,
      conquered,
      mastery: leafIds.length ? masterySum / leafIds.length : 0,
      reviewsDue,
      topics: out,
    };
  }

  /** Every subject the student picked, with how far they've got: one world each on the app's world map. */
  async worlds(studentId: string) {
    const links = await this.prisma.studentExamSubject.findMany({
      where: { studentExam: { studentId } },
      include: { examSubject: true },
      orderBy: [{ studentExam: { exam: 'asc' } }, { examSubject: { name: 'asc' } }],
    });
    const maps = await Promise.all(links.map((l) => this.map(studentId, l.examSubjectId)));
    return links.map(({ examSubject: s }, i) => {
      const m = maps[i];
      const leaves = m.topics.flatMap((t) => t.subtopics);
      return {
        id: s.id,
        exam: s.exam,
        slug: s.slug,
        name: s.name,
        leaves: m.leaves,
        conquered: m.conquered,
        mastery: m.mastery,
        reviewsDue: m.reviewsDue,
        ready: leaves.some((l) => l.fresh > 0 || l.answered > 0),
      };
    });
  }

  /** Finds the subtopic on the student's map and checks it's open. */
  private async node(studentId: string, topicId: string) {
    const topic = await this.prisma.syllabusTopic.findUnique({ where: { id: topicId }, select: { examSubjectId: true } });
    if (!topic) throw new NotFoundException('Topic not found.');
    const m = await this.map(studentId, topic.examSubjectId);
    const node = m.topics.flatMap((t) => t.subtopics).find((s) => s.id === topicId);
    if (!node) throw new BadRequestException('Pick a subtopic to practise.');
    if (!node.unlocked) throw new BadRequestException('Finish level 1 of the subtopic before this one to unlock it.');
    return { node, examSubjectId: topic.examSubjectId, exam: m.subject.exam };
  }

  /**
   * A round of up to 10: due reviews first, then unseen questions at the student's level (nearby levels if those run out).
   * `allowance` caps it for children on the free plan (null: no cap).
   */
  async round(studentId: string, topicId: string, allowance: number | null = null) {
    const { node, exam } = await this.node(studentId, topicId);
    const boss = node.level === TOP_LEVEL && !node.bossBeaten;
    const now = new Date();
    // Nursery children hear "Well done!" the moment they tap, so their rounds carry the answers.
    const reveal = exam === 'NURSERY';

    const reviews = await this.prisma.questionSeen.findMany({
      where: { studentId, reviewDueAt: { lte: now }, question: { topicId, status: 'APPROVED' } },
      orderBy: { reviewDueAt: 'asc' },
      take: MAX_REVIEWS,
      include: { question: true },
    });

    const picked = reviews.map((r) => ({ q: r.question, review: true }));
    // The boss round uses the hardest questions the topic has; 3s only when there are no 4s or 5s yet.
    const want = boss ? [5, 4, 3] : [node.level, node.level - 1, node.level + 1, node.level - 2, node.level + 2].filter((d) => d >= 1 && d <= TOP_LEVEL);
    for (const difficulty of want) {
      if (picked.length >= ROUND_SIZE) break;
      const rows = await this.prisma.examQuestion.findMany({
        where: { topicId, difficulty, status: 'APPROVED', seen: { none: { studentId } }, id: { notIn: picked.map((p) => p.q.id) } },
        orderBy: { timesServed: 'asc' }, // spread students across the bank
        take: (ROUND_SIZE - picked.length) * 3,
      });
      picked.push(...shuffle(rows).slice(0, ROUND_SIZE - picked.length).map((q) => ({ q, review: false })));
    }
    if (reveal && picked.length < ROUND_SIZE) {
      // Out of new ones: bring back what they had longest ago.
      const again = await this.prisma.questionSeen.findMany({
        where: { studentId, lastSeenAt: { lte: this.againBefore(now) }, questionId: { notIn: picked.map((p) => p.q.id) }, question: { topicId, status: 'APPROVED' } },
        orderBy: { lastSeenAt: 'asc' },
        take: ROUND_SIZE - picked.length,
        include: { question: true },
      });
      picked.push(...again.map((s) => ({ q: s.question, review: false })));
    }
    if (!picked.length) {
      if (reveal && node.answered) throw new BadRequestException('You’ve played them all today! Come back tomorrow to play again.');
      throw new BadRequestException(node.answered ? 'You’ve done every question we have on this topic. New ones are on the way.' : 'We’re still writing questions for this topic.');
    }

    return {
      topicId,
      level: node.level,
      boss,
      nursery: reveal,
      questions: shuffle(picked)
        .slice(0, allowance ?? ROUND_SIZE)
        .map(({ q, review }) => ({
        id: q.id,
        prompt: q.stem,
        options: shuffle(q.options as Option[]),
        difficulty: q.difficulty,
        review,
        ...(reveal ? { answerId: q.answerId, explanation: q.explanation } : {}),
      })),
    };
  }

  async submit(studentId: string, topicId: string, answers: Record<string, string>) {
    const ids = Object.keys(answers);
    if (!ids.length) throw new BadRequestException('Answer at least one question.');
    if (ids.length > ROUND_SIZE) throw new BadRequestException('Too many answers for one round.');
    const { node, exam } = await this.node(studentId, topicId);
    const boss = node.level === TOP_LEVEL && !node.bossBeaten;
    const now = new Date();

    const [questions, seenRows] = await Promise.all([
      this.prisma.examQuestion.findMany({ where: { id: { in: ids }, topicId, status: { in: ['APPROVED', 'RETIRED'] } } }),
      this.prisma.questionSeen.findMany({ where: { studentId, questionId: { in: ids } } }),
    ]);
    const seenBy = new Map(seenRows.map((s) => [s.questionId, s]));

    // Only new questions and due reviews count, so replaying a round can't farm XP or levels.
    // Nursery questions come back after a day on purpose, and count again then.
    const results = questions.map((q) => {
      const chosen = answers[q.id] ?? null;
      const correct = chosen === q.answerId;
      const seen = seenBy.get(q.id);
      const again = exam === 'NURSERY' && seen && seen.lastSeenAt <= this.againBefore(now);
      const kind = !seen ? 'new' : (seen.reviewDueAt && seen.reviewDueAt <= now) || again ? 'review' : 'repeat';
      return { q, chosen, correct, kind };
    });
    const counted = results.filter((r) => r.kind !== 'repeat');
    const right = counted.filter((r) => r.correct).length;
    const score = counted.length ? right / counted.length : 0;

    let levelAfter = node.level;
    let bossBeatenNow = false;
    if (counted.length >= MIN_TO_LEVEL) {
      if (boss && score >= LEVEL_UP) bossBeatenNow = true;
      else if (!boss && score >= LEVEL_UP && node.level < TOP_LEVEL) levelAfter = node.level + 1;
      else if (score < LEVEL_DOWN && node.level > 1) levelAfter = node.level - 1;
    }
    const xpEarned =
      results.filter((r) => r.correct && r.kind === 'new').length * XP.correct +
      results.filter((r) => r.correct && r.kind === 'review').length * XP.review +
      (levelAfter > node.level ? XP.levelUp : 0) +
      (bossBeatenNow ? XP.boss : 0);

    const reviewDue = new Date(now.getTime() + REVIEW_AFTER_DAYS * 86_400_000);
    const { coinsPerCorrect } = await this.settings.get();
    const rewards = await this.prisma.$transaction(async (tx) => {
      for (const r of counted) {
        const data: Prisma.QuestionSeenUncheckedUpdateInput = { lastSeenAt: now, lastCorrect: r.correct, reviewDueAt: r.correct ? null : reviewDue };
        if (r.kind === 'new') await tx.questionSeen.create({ data: { studentId, questionId: r.q.id, lastCorrect: r.correct, reviewDueAt: r.correct ? null : reviewDue } });
        else await tx.questionSeen.update({ where: { studentId_questionId: { studentId, questionId: r.q.id } }, data: { ...data, timesSeen: { increment: 1 } } });
        await tx.examQuestion.update({ where: { id: r.q.id }, data: { timesServed: { increment: 1 }, timesCorrect: { increment: r.correct ? 1 : 0 } } });
      }
      if (counted.length) {
        // Mastery leans on recent rounds and on how hard they were.
        const roundMastery = score * (node.level / TOP_LEVEL);
        const mastery = node.answered ? node.mastery * 0.7 + roundMastery * 0.3 : roundMastery;
        await tx.topicProgress.upsert({
          where: { studentId_topicId: { studentId, topicId } },
          create: { studentId, topicId, level: levelAfter, mastery, answered: counted.length, correct: right, bossBeaten: bossBeatenNow },
          update: { level: levelAfter, mastery, answered: { increment: counted.length }, correct: { increment: right }, ...(bossBeatenNow ? { bossBeaten: true } : {}) },
        });
      }
      if (counted.length >= MIN_TO_LEVEL && right === counted.length) await tx.studentProfile.update({ where: { id: studentId }, data: { perfectRounds: { increment: 1 } } });
      const newRight = results.filter((r) => r.correct && r.kind === 'new').length;
      return this.game.awardXp(tx, studentId, xpEarned, 'ACTIVITY', topicId, { amount: newRight * coinsPerCorrect, reason: 'PRACTICE' });
    });

    return {
      counted: counted.length,
      correct: right,
      score,
      boss,
      levelBefore: node.level,
      levelAfter,
      bossBeaten: bossBeatenNow,
      xpEarned,
      rewards,
      results: results.map((r) => ({ questionId: r.q.id, chosen: r.chosen, answerId: r.q.answerId, correct: r.correct, explanation: r.q.explanation, counted: r.kind !== 'repeat' })),
    };
  }

  private againBefore(now: Date) {
    return new Date(now.getTime() - NURSERY_AGAIN_AFTER_DAYS * 86_400_000);
  }

  /** "Report this question": Overwatch sees it in the question bank. */
  async report(studentId: string, questionId: string, reason: string, note?: string) {
    const q = await this.prisma.examQuestion.findUnique({ where: { id: questionId }, select: { id: true } });
    if (!q) throw new NotFoundException('Question not found.');
    const open = await this.prisma.questionReport.findFirst({ where: { questionId, studentId, status: 'OPEN' }, select: { id: true } });
    if (open) return { ok: true };
    await this.prisma.questionReport.create({ data: { questionId, studentId, reason, note: note || null } });
    return { ok: true };
  }
}
