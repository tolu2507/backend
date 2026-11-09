import { createHash } from 'node:crypto';

import type { EducationLevel, Prisma } from '@prisma/client';

import { subjectStyle } from '../catalog/catalog.js';
import { lagosDay, lagosMidnightInstant } from '../common/dates.js';
import type { StoredQuestion } from '../common/quiz.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * Today's quests: a fresh 5-question quest per subject every day, built from the question bank
 * (no hand-made quests needed). The pick is fixed for the Lagos day, so leaving and coming back shows
 * the same quest; tomorrow brings new questions. Questions the child has had before today are skipped.
 */
export const DAILY_PREFIX = 'daily-';
export const DAILY_SIZE = 5;
export const DAILY_XP = 25;
export const MAX_DAILY = 4;
const POOL = 400;

const dayKey = (d = lagosDay()) => d.toISOString().slice(0, 10);
export const dailyRef = (examSubjectId: string) => `daily:${examSubjectId}:${dayKey()}`;
export const isDaily = (id: string) => id.startsWith(DAILY_PREFIX);
export const dailyId = (examSubjectId: string) => `${DAILY_PREFIX}${examSubjectId}`;

/** "Mathematics (Primary 3)" → "Mathematics" */
const shortName = (name: string) => name.replace(/\s*\(.*\)\s*$/, '');

/** Nursery has its own read-aloud picture rounds; university students have their own side. */
export const hasDailyQuests = (level: EducationLevel) => level !== 'NURSERY' && level !== 'TERTIARY';

/** The subjects that get a quest today: the child's chosen subjects, in a stable order. */
export async function dailySubjects(prisma: PrismaService, studentId: string) {
  const links = await prisma.studentExamSubject.findMany({
    where: { studentExam: { studentId, exam: { not: 'UNIVERSITY' } } },
    include: { examSubject: true },
    orderBy: [{ studentExam: { createdAt: 'asc' } }, { examSubject: { name: 'asc' } }],
  });
  // One quest per subject even if two exams share it (JAMB and WAEC Physics): keep the first.
  const seen = new Set<string>();
  return links
    .map((l) => l.examSubject)
    .filter((s) => {
      const k = shortName(s.name).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX_DAILY);
}

/** Today's questions for one subject and child. Same answer all day. */
export async function dailyQuestions(prisma: PrismaService, studentId: string, examSubjectId: string) {
  const todayStart = lagosMidnightInstant(lagosDay());
  const pool = await prisma.examQuestion.findMany({
    where: {
      examSubjectId,
      status: 'APPROVED',
      difficulty: { lte: 4 }, // the very hardest stay for boss rounds
      // Not had before today (ones first seen today still count, so the pick holds after they play it).
      seen: { none: { studentId, firstSeenAt: { lt: todayStart } } },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: POOL,
  });
  const seed = `${studentId}:${examSubjectId}:${dayKey()}`;
  const rank = (id: string) => createHash('sha1').update(`${seed}:${id}`).digest('hex');
  const ids = pool.map((q) => q.id).sort((a, b) => rank(a).localeCompare(rank(b))).slice(0, DAILY_SIZE);
  const rows = await prisma.examQuestion.findMany({ where: { id: { in: ids } } });
  rows.sort((a, b) => rank(a.id).localeCompare(rank(b.id)));
  return rows.map((q): StoredQuestion => ({ id: q.id, prompt: q.stem, options: q.options as StoredQuestion['options'], answerId: q.answerId }));
}

/** The quest cards for the home screen. */
export async function dailyQuestCards(prisma: PrismaService, studentId: string) {
  const subjects = await dailySubjects(prisma, studentId);
  if (!subjects.length) return [];
  const done = await prisma.xpEvent.findMany({
    where: { studentId, refId: { in: subjects.map((s) => dailyRef(s.id)) } },
    select: { refId: true },
  });
  const doneRefs = new Set(done.map((d) => d.refId));
  const cards = [];
  for (const s of subjects) {
    const finished = doneRefs.has(dailyRef(s.id));
    // Skip a subject with nothing left to ask (unless they already played it today).
    if (!finished && (await dailyQuestions(prisma, studentId, s.id)).length < 3) continue;
    const subject = shortName(s.name);
    cards.push({
      id: dailyId(s.id),
      kind: 'ACTIVITY' as const,
      title: `${subject}: today’s quest`,
      subject,
      subtitle: 'New questions every day',
      xpReward: DAILY_XP,
      progress: finished ? 1 : 0,
      ...subjectStyle(subject),
    });
  }
  return cards;
}

/** Records the questions as seen (wrong ones come back later as reviews in practice), like a practice round. */
export async function markSeen(tx: Prisma.TransactionClient, studentId: string, results: { questionId: string; correct: boolean }[]) {
  const now = new Date();
  const reviewDue = new Date(now.getTime() + 2 * 86_400_000);
  for (const r of results) {
    await tx.questionSeen.upsert({
      where: { studentId_questionId: { studentId, questionId: r.questionId } },
      create: { studentId, questionId: r.questionId, lastCorrect: r.correct, reviewDueAt: r.correct ? null : reviewDue },
      update: { lastSeenAt: now, lastCorrect: r.correct, timesSeen: { increment: 1 }, reviewDueAt: r.correct ? null : reviewDue },
    });
    await tx.examQuestion.update({ where: { id: r.questionId }, data: { timesServed: { increment: 1 }, timesCorrect: { increment: r.correct ? 1 : 0 } } });
  }
}
