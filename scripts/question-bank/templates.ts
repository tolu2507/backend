/**
 * Puts template questions into the question bank. Safe to run again: it only adds what's missing,
 * and the same template and seed always give the same question, so nothing is duplicated.
 * New templates wait for review; once a template is approved in Overwatch, its new questions go
 * straight to students.
 *
 *   pnpm tsx scripts/question-bank/templates.ts JAMB mathematics [--per 40] [--only jamb-maths/depreciation]
 */
import { type ExamBody, type Prisma, PrismaClient } from '@prisma/client';

import { instance } from '../../src/question-bank/templates/engine.js';
import { TEMPLATES } from '../../src/question-bank/templates/index.js';

process.loadEnvFile('.env');
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const flag = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args.splice(at, 2)[1] : undefined;
};
const per = Number(flag('--per') ?? 40);
const only = flag('--only');
const [exam, slug] = args as [ExamBody, string];

const templates = (TEMPLATES[exam]?.[slug] ?? []).filter((t) => !only || t.key === only);
if (!templates.length) throw new Error(`No templates for ${exam} ${slug}${only ? ` with key ${only}` : ''}`);

const subject = await prisma.examSubject.findUniqueOrThrow({ where: { exam_slug: { exam, slug } } });
const topics = await prisma.syllabusTopic.findMany({ where: { examSubjectId: subject.id }, include: { parent: true } });
const topicId = (parent: string, child: string) => topics.find((t) => t.name === child && t.parent?.name === parent)?.id;

const missing = templates.filter((t) => !topicId(...t.topic));
if (missing.length) {
  throw new Error(`These templates point at topics that aren't in the ${exam} ${subject.name} syllabus:\n${missing.map((t) => `  ${t.key}: ${t.topic.join(' › ')}`).join('\n')}`);
}

let added = 0;
for (const t of templates) {
  const tid = topicId(...t.topic)!;
  let row = await prisma.questionTemplate.findFirst({ where: { examSubjectId: subject.id, spec: { path: ['key'], equals: t.key } } });
  if (!row) row = await prisma.questionTemplate.create({ data: { examSubjectId: subject.id, topicId: tid, difficulty: t.difficulty, spec: { key: t.key }, status: 'IN_REVIEW' } });
  else if (row.topicId !== tid || row.difficulty !== t.difficulty) row = await prisma.questionTemplate.update({ where: { id: row.id }, data: { topicId: tid, difficulty: t.difficulty } });
  if (row.status === 'RETIRED') {
    console.log(`  ${t.key}: retired, skipped`);
    continue;
  }

  const existing = await prisma.examQuestion.findMany({ where: { templateId: row.id }, select: { stem: true } });
  const stems = new Set(existing.map((q) => q.stem));
  const fresh: Prisma.ExamQuestionCreateManyInput[] = [];
  for (let seed = 0; stems.size < per && seed < per * 25; seed++) {
    const q = instance(t, seed);
    if (!q || stems.has(q.stem)) continue;
    stems.add(q.stem);
    fresh.push({
      examSubjectId: subject.id,
      topicId: tid,
      difficulty: q.difficulty,
      stem: q.stem,
      options: q.options,
      answerId: q.answerId,
      explanation: q.explanation,
      origin: 'TEMPLATE',
      status: row.status === 'APPROVED' ? 'APPROVED' : 'IN_REVIEW',
      templateId: row.id,
      checkNotes: `Answer worked out by template ${t.key}.`,
    });
  }
  if (fresh.length) await prisma.examQuestion.createMany({ data: fresh });
  added += fresh.length;
  console.log(`  ${t.key}: ${existing.length} → ${existing.length + fresh.length}${row.status === 'APPROVED' ? '' : ' (waiting for review)'}`);
}

console.log(`\n${exam} ${subject.name}: added ${added} questions from ${templates.length} templates.`);
await prisma.$disconnect();
