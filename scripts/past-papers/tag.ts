/**
 * Builds each exam subject's syllabus, tags every past question (topic, difficulty, type) and
 * works out the exam's pattern: how much of the paper each topic takes and in how many years it appeared.
 * Each exam is analysed on its own: JAMB Physics and WAEC Physics get separate syllabuses and patterns.
 *
 *   pnpm tsx scripts/past-papers/tag.ts [EXAM] [subject-slug] [--syllabus-only]     e.g.  tag.ts JAMB mathematics
 *
 * Subjects in src/exams/syllabus.ts get the official syllabus for free; others ask the AI.
 * --syllabus-only stops after the syllabus, with no AI calls for typed-in subjects.
 * Safe to re-run: only untagged questions are sent to the AI.
 */
import type { ExamBody } from '@prisma/client';
import { existsSync } from 'node:fs';

import { AiService, aiPricing } from '../../src/ai/ai.service.js';
import { EXAM_CATALOG } from '../../src/exams/exam-catalog.js';
import { OFFICIAL_SYLLABUS } from '../../src/exams/syllabus.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { QuestionAi, type PastForAi, type TopicTree } from '../../src/question-bank/question-ai.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const prisma = new PrismaService();
const ai = new QuestionAi(new AiService(prisma));
const BATCH = 20;
const PARALLEL = 6; // Gemini takes 20 s – 3 min per batch, so several run at once
const startedAt = new Date();
const syllabusOnly = process.argv.includes('--syllabus-only');

const forAi = (q: { id: string; stem: string; options: unknown; answer: string | null }): PastForAi => ({
  id: q.id,
  stem: q.stem.slice(0, 1200),
  options: (q.options as PastForAi['options']) ?? null,
  answer: q.answer,
});

/** A spread of questions across all years, for proposing the syllabus. */
function spread<T extends { year: number }>(rows: T[], n: number): T[] {
  const byYear = new Map<number, T[]>();
  for (const r of rows) byYear.set(r.year, [...(byYear.get(r.year) ?? []), r]);
  const out: T[] = [];
  for (let i = 0; out.length < n && i < rows.length; i++) for (const list of byYear.values()) if (list[i] && out.length < n) out.push(list[i]);
  return out;
}

async function ensureTopics(exam: ExamBody, slug: string, examSubjectId: string, label: string, subject: string): Promise<Map<string, string> | null> {
  let rows = await prisma.syllabusTopic.findMany({ where: { examSubjectId } });
  if (!rows.length) {
    let tree = OFFICIAL_SYLLABUS[exam]?.[slug] ?? null;
    if (!tree) {
      const past = await prisma.pastQuestion.findMany({ where: { examSubjectId, brokenReason: null }, select: { id: true, stem: true, options: true, answer: true, year: true } });
      tree = await ai.proposeTopics({ exam: label, subject, samples: spread(past, 60).map(forAi) });
    }
    if (!tree) return null;
    for (const [i, t] of tree.entries()) {
      const parent = await prisma.syllabusTopic.create({ data: { examSubjectId, name: t.name, order: i } });
      await prisma.syllabusTopic.createMany({ data: t.subtopics.map((name, j) => ({ examSubjectId, parentId: parent.id, name, order: j })), skipDuplicates: true });
    }
    rows = await prisma.syllabusTopic.findMany({ where: { examSubjectId } });
    console.log(`  syllabus: ${tree.length} topics, ${rows.length - tree.length} subtopics`);
  }
  // "Topic" and "Topic › Subtopic" → row id
  const byId = new Map(rows.map((r) => [r.id, r]));
  return new Map(rows.map((r) => [r.parentId ? `${byId.get(r.parentId)!.name} › ${r.name}` : r.name, r.id]));
}

function treeOf(index: Map<string, string>): TopicTree {
  const tree = new Map<string, string[]>();
  for (const key of index.keys()) {
    const [topic, sub] = key.split(' › ');
    tree.set(topic, sub ? [...(tree.get(topic) ?? []), sub] : (tree.get(topic) ?? []));
  }
  return [...tree].map(([name, subtopics]) => ({ name, subtopics }));
}

async function tagSubject(exam: ExamBody, slug: string, examSubjectId: string, subject: string) {
  const label = EXAM_CATALOG[exam].fullName;
  console.log(`${exam} ${subject}`);
  const index = await ensureTopics(exam, slug, examSubjectId, label, subject);
  if (!index) return console.log('  could not build the syllabus (AI unavailable?)');
  if (syllabusOnly) return;
  const topics = treeOf(index);

  const todo = await prisma.pastQuestion.findMany({ where: { examSubjectId, questionType: null }, select: { id: true, stem: true, options: true, answer: true } });
  let tagged = 0;
  const batches = Array.from({ length: Math.ceil(todo.length / BATCH) }, (_, i) => todo.slice(i * BATCH, (i + 1) * BATCH));
  const work = async () => {
    for (let batch = batches.shift(); batch; batch = batches.shift()) {
      const tags = await ai.tag({ exam: label, subject, topics, questions: batch.map(forAi) });
      for (const t of tags ?? []) {
        const topicId = (t.subtopic && index.get(`${t.topic} › ${t.subtopic}`)) || index.get(t.topic);
        if (!topicId || !batch.some((q) => q.id === t.id)) continue;
        await prisma.pastQuestion.update({ where: { id: t.id }, data: { topicId, difficulty: t.difficulty, questionType: t.type, brokenReason: t.broken } });
        tagged++;
      }
      console.log(`  tagged ${tagged}/${todo.length}`);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, work));
  if (todo.length > tagged) console.log(`  ${todo.length - tagged} not tagged; they'll be retried on the next run`);
  await pattern(examSubjectId);
}

/** weight = share of all tagged questions; yearsSeen = years with at least one question. Parent topics include their subtopics. */
async function pattern(examSubjectId: string) {
  const [topics, past] = await Promise.all([
    prisma.syllabusTopic.findMany({ where: { examSubjectId } }),
    prisma.pastQuestion.findMany({ where: { examSubjectId, topicId: { not: null } }, select: { topicId: true, year: true } }),
  ]);
  const years = new Set(past.map((p) => p.year)).size;
  const parentOf = new Map(topics.map((t) => [t.id, t.parentId]));
  const stats = new Map<string, { n: number; years: Set<number> }>();
  for (const p of past) {
    for (const id of [p.topicId!, parentOf.get(p.topicId!)].filter(Boolean) as string[]) {
      const s = stats.get(id) ?? { n: 0, years: new Set<number>() };
      s.n++;
      s.years.add(p.year);
      stats.set(id, s);
    }
  }
  for (const t of topics) {
    const s = stats.get(t.id);
    await prisma.syllabusTopic.update({ where: { id: t.id }, data: { weight: s ? s.n / past.length : 0, yearsSeen: s?.years.size ?? 0 } });
  }
  const top = topics
    .filter((t) => !t.parentId)
    .map((t) => ({ name: t.name, ...stats.get(t.id) }))
    .sort((a, b) => (b.n ?? 0) - (a.n ?? 0));
  console.log(`  pattern over ${years} years, ${past.length} questions:`);
  for (const t of top) console.log(`    ${String(Math.round(((t.n ?? 0) / past.length) * 100)).padStart(3)}%  in ${t.years?.size ?? 0}/${years} years  ${t.name}`);
}

async function main() {
  const [exam, slug] = process.argv.slice(2).filter((a) => !a.startsWith('--')) as [ExamBody | undefined, string | undefined];
  const subjects = await prisma.examSubject.findMany({ where: { ...(exam ? { exam } : {}), ...(slug ? { slug } : {}), pastQuestions: { some: {} } }, orderBy: [{ exam: 'asc' }, { slug: 'asc' }] });
  for (const s of subjects) await tagSubject(s.exam, s.slug, s.id, s.name);

  const usage = await prisma.aiUsage.aggregate({ where: { createdAt: { gte: startedAt }, feature: 'QUESTION_TAGGING' }, _sum: { costMicroUsd: true, inputTokens: true, outputTokens: true }, _count: true });
  const usd = (usage._sum.costMicroUsd ?? 0) / 1e6;
  console.log(`\nAI: ${usage._count} calls, ${usage._sum.inputTokens ?? 0} in / ${usage._sum.outputTokens ?? 0} out tokens ≈ $${usd.toFixed(3)} (₦${Math.round(usd * aiPricing().ngnPerUsd)})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
