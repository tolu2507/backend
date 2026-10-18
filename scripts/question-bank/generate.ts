/**
 * Writes our own questions for an exam subject, following its past-paper pattern, and keeps only
 * the ones that pass checks: well formed, not a near-copy of a past question, and a second blind
 * solve agrees with the answer. Kept questions go in as IN_REVIEW.
 *
 *   pnpm tsx scripts/question-bank/generate.ts EXAM subject-slug [--topics 3] [--per-topic 6]
 *
 * --topics: how many of the most-tested subtopics to fill (default: all, heaviest first)
 * --per-topic: questions to write per subtopic, spread over difficulties 2–4 (default 6)
 */
import type { ExamBody } from '@prisma/client';
import { existsSync } from 'node:fs';

import { AiService, aiPricing } from '../../src/ai/ai.service.js';
import { LEVEL_LABEL } from '../../src/catalog/catalog.js';
import { EXAM_CATALOG } from '../../src/exams/exam-catalog.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { QuestionWriter, type PastForAi } from '../../src/question-bank/question-ai.js';
import { tooSimilar } from '../../src/question-bank/similarity.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const prisma = new PrismaService();
const writer = new QuestionWriter(new AiService(prisma));
const PARALLEL = 4;
const startedAt = new Date();

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : undefined;
};

type Tally = { written: number; malformed: number; similar: number; disagreed: number; kept: number };

async function main() {
  const [exam, slug] = process.argv.slice(2) as [ExamBody, string];
  if (!EXAM_CATALOG[exam] || !slug) throw new Error('Usage: generate.ts EXAM subject-slug [--topics N] [--per-topic N]');
  const subject = await prisma.examSubject.findUniqueOrThrow({ where: { exam_slug: { exam, slug } } });
  const rules = EXAM_CATALOG[exam];
  const perTopic = arg('per-topic') ?? 6;

  const [topics, past] = await Promise.all([
    prisma.syllabusTopic.findMany({ where: { examSubjectId: subject.id }, include: { parent: true } }),
    prisma.pastQuestion.findMany({ where: { examSubjectId: subject.id }, select: { id: true, stem: true, options: true, answer: true, topicId: true, difficulty: true, brokenReason: true } }),
  ]);
  if (!topics.length) throw new Error(`No syllabus yet for ${exam} ${slug}. Run scripts/past-papers/tag.ts first.`);

  // How many options this exam's papers use (most common count in the past questions).
  const counts = new Map<number, number>();
  for (const p of past) {
    const n = (p.options as unknown[] | null)?.length ?? 0;
    if (n >= 4) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const optionCount = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 4;

  // Fill subtopics (or topics without subtopics), most-tested first.
  const leaves = topics.filter((t) => t.parentId || !topics.some((c) => c.parentId === t.id)).sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const targets = leaves.filter((t) => (t.weight ?? 0) > 0).slice(0, arg('topics') ?? leaves.length);
  const pastStems = past.map((p) => p.stem);
  console.log(`${exam} ${subject.name}: ${targets.length} subtopics × ${perTopic} questions, ${optionCount} options each`);

  const tally: Tally = { written: 0, malformed: 0, similar: 0, disagreed: 0, kept: 0 };
  const queue = targets.flatMap((t) => [2, 3, 4].map((difficulty, i) => ({ t, difficulty, count: Math.floor(perTopic / 3) + (i < perTopic % 3 ? 1 : 0) }))).filter((j) => j.count > 0);

  const work = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { t, difficulty, count } = job;
      const usable = past.filter((p) => p.topicId === t.id && !p.brokenReason);
      const examples = usable.sort((a, b) => Math.abs((a.difficulty ?? 3) - difficulty) - Math.abs((b.difficulty ?? 3) - difficulty)).slice(0, 5);
      const existing = await prisma.examQuestion.findMany({ where: { topicId: t.id }, select: { stem: true }, orderBy: { createdAt: 'desc' }, take: 40 });

      const written = await writer.write({
        exam: rules.fullName,
        subject: subject.name,
        level: LEVEL_LABEL[rules.level],
        topic: t.parent?.name ?? t.name,
        subtopic: t.parent ? t.name : null,
        difficulty,
        count,
        optionCount,
        examples: examples.map((p): PastForAi => ({ id: p.id.slice(0, 8), stem: p.stem, options: p.options as PastForAi['options'], answer: p.answer })),
        avoid: existing.map((e) => e.stem.slice(0, 140)),
      });
      tally.written += count;
      if (!written) {
        tally.malformed += count;
        continue;
      }
      tally.malformed += count - written.length;

      const fresh = written.filter((q) => !tooSimilar(q.stem, pastStems) && !tooSimilar(q.stem, existing.map((e) => e.stem)));
      tally.similar += written.length - fresh.length;
      if (!fresh.length) continue;

      const verdict = await writer.solve({ exam: rules.fullName, subject: subject.name, questions: fresh.map((q, i) => ({ id: `q${i}`, stem: q.stem, options: q.options })) });
      for (const [i, q] of fresh.entries()) {
        if (verdict?.get(`q${i}`) !== q.answerIndex) {
          tally.disagreed++;
          continue;
        }
        const ids = 'abcde';
        await prisma.examQuestion.create({
          data: {
            examSubjectId: subject.id,
            topicId: t.id,
            difficulty,
            stem: q.stem.trim(),
            options: q.options.map((label, j) => ({ id: ids[j], label: label.trim() })),
            answerId: ids[q.answerIndex],
            explanation: q.explanation.trim(),
            origin: 'GENERATED',
            status: 'IN_REVIEW',
            modelledOnId: examples[0]?.id ?? null,
            checkNotes: 'Blind solve agreed with the answer.',
          },
        });
        tally.kept++;
      }
      console.log(`  ${t.parent ? `${t.parent.name} › ` : ''}${t.name} (difficulty ${difficulty}): kept ${tally.kept} so far`);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, work));

  const usage = await prisma.aiUsage.aggregate({ where: { createdAt: { gte: startedAt }, feature: { in: ['QUESTION_WRITING', 'QUESTION_CHECK'] } }, _sum: { costMicroUsd: true }, _count: true });
  const usd = (usage._sum.costMicroUsd ?? 0) / 1e6;
  console.log(`\nAsked for ${tally.written}: ${tally.kept} kept · ${tally.malformed} malformed · ${tally.similar} too close to a past question · ${tally.disagreed} failed the blind check`);
  console.log(`AI: ${usage._count} calls ≈ $${usd.toFixed(3)} (₦${Math.round(usd * aiPricing().ngnPerUsd)}), ${tally.kept ? `₦${((usd * aiPricing().ngnPerUsd) / tally.kept).toFixed(1)} per kept question` : ''}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
