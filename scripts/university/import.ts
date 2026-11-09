/**
 * Loads hand-written university classes (content/university/<course>/unit-NN.json) into the database
 * as IN_REVIEW, for Overwatch → University. No AI. The format is in content/university/WRITING-GUIDE.md.
 *
 *   pnpm uni:import --check content/university/psy-316/unit-01.json   check files only (no database)
 *   pnpm uni:import --check                                            check every file
 *   pnpm uni:import                                                    load every course
 *   pnpm uni:import psy-316                                            load one course
 *   pnpm uni:import --approve                                          load as approved (live for students at once):
 *                                                                      for the live database, after you reviewed them locally
 *
 * Safe to run again: lessons not yet approved are replaced with the file's version, approved ones are
 * left alone, and questions already in the bank (same wording) are skipped.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Prisma } from '@prisma/client';

import { courseCode, UNI_COURSES } from '../../src/exams/university.js';
import { tooSimilar } from '../../src/question-bank/similarity.js';
import { copiedRuns, lessonText, parseLesson, type Lesson } from '../../src/university/lesson-format.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const CONTENT = 'content/university';
const SESSIONS = 'data/university/sessions';

type Q = { difficulty: number; stem: string; options: string[]; answerIndex: number; explanation: string };
type UnitFile = { unit: number; title: string; summary: string; sections: { name: string; lesson: unknown; questions: Q[] }[] };
type Checked = { name: string; lesson: Lesson; questions: Q[]; notes: string[] };

const flags = process.argv.slice(2);
const checkOnly = flags.includes('--check');
const approve = flags.includes('--approve');
const status = approve ? ('APPROVED' as const) : ('IN_REVIEW' as const);
const args = flags.filter((f) => !f.startsWith('--'));

function validQuestion(q: Q): string | null {
  if (!q || typeof q.stem !== 'string' || q.stem.trim().length < 10) return 'stem missing or too short';
  if (![1, 2, 3, 4, 5].includes(Number(q.difficulty))) return 'difficulty must be 1-5';
  if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every((o) => typeof o === 'string' && o.trim())) return 'needs exactly 4 options';
  if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== 4) return 'options repeat';
  if (q.options.some((o) => /^(all|none) of the above/i.test(o.trim()))) return '"all/none of the above" not allowed';
  if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) return 'answerIndex must be 0-3';
  if (typeof q.explanation !== 'string' || q.explanation.trim().length < 15) return 'explanation missing';
  return null;
}

/** Checks one unit file. Returns the usable sections and a list of problems (errors stop the import). */
function check(file: string): { slug: string; unit: UnitFile; sections: Checked[]; errors: string[]; warnings: string[] } {
  const slug = file.split('/').at(-2)!;
  const errors: string[] = [];
  const warnings: string[] = [];
  let unit: UnitFile;
  try {
    unit = JSON.parse(readFileSync(file, 'utf8')) as UnitFile;
  } catch (e) {
    return { slug, unit: { unit: 0, title: '', summary: '', sections: [] }, sections: [], errors: [`not valid JSON: ${(e as Error).message}`], warnings };
  }
  if (!UNI_COURSES.some((c) => c.slug === slug)) errors.push(`folder "${slug}" is not a course in src/exams/university.ts`);
  if (!Number.isInteger(unit.unit) || unit.unit < 1) errors.push('"unit" must be the study session number');
  if (typeof unit.title !== 'string' || !unit.title.trim()) errors.push('"title" missing');
  if (typeof unit.summary !== 'string' || !unit.summary.trim()) warnings.push('"summary" missing');
  if (!Array.isArray(unit.sections) || !unit.sections.length) errors.push('no sections');

  const sessionFile = join(SESSIONS, slug, `unit-${String(unit.unit).padStart(2, '0')}.txt`);
  const source = existsSync(sessionFile) ? readFileSync(sessionFile, 'utf8') : '';
  if (!source) warnings.push(`no exported session text at ${sessionFile}; copied-wording check skipped (run pnpm uni:build --export)`);

  const sections: Checked[] = [];
  const names = new Set<string>();
  const allStems: string[] = [];
  for (const [i, s] of (unit.sections ?? []).entries()) {
    const where = `section ${i + 1} "${s?.name ?? '?'}"`;
    if (typeof s?.name !== 'string' || !s.name.trim()) {
      errors.push(`${where}: name missing`);
      continue;
    }
    if (names.has(s.name.trim().toLowerCase())) errors.push(`${where}: two sections have this name`);
    names.add(s.name.trim().toLowerCase());
    const parsed = parseLesson(s.lesson);
    if (!parsed) {
      errors.push(`${where}: lesson unusable (needs title, hook, 6+ valid slides with at least one check)`);
      continue;
    }
    const notes: string[] = [];
    if (parsed.dropped) errors.push(`${where}: ${parsed.dropped} slide(s) malformed; fix them (see the guide for each slide kind)`);
    const kinds = parsed.lesson.slides.map((x) => x.kind);
    if (kinds.filter((k) => k === 'check').length < 2) warnings.push(`${where}: fewer than 2 quick checks`);
    if (!kinds.includes('lecturer')) warnings.push(`${where}: no "lecturer" slide`);
    if (!kinds.includes('example')) warnings.push(`${where}: no "example" slide`);
    if (kinds.at(-1) !== 'recap') warnings.push(`${where}: doesn't end with a recap`);
    const copied = source ? copiedRuns(lessonText(parsed.lesson), source) : [];
    if (copied.length) errors.push(`${where}: copies the manual word for word (${copied.length}x), e.g. "${copied[0]}". Rewrite in your own words.`);

    const qs: Q[] = [];
    for (const [j, q] of (Array.isArray(s.questions) ? s.questions : []).entries()) {
      const bad = validQuestion(q);
      if (bad) {
        errors.push(`${where}, question ${j + 1}: ${bad}`);
        continue;
      }
      if (tooSimilar(q.stem, allStems, 0.75)) {
        warnings.push(`${where}, question ${j + 1}: nearly the same as another question; skipped`);
        continue;
      }
      const qCopied = source ? copiedRuns(`${q.stem} ${q.explanation}`, source) : [];
      if (qCopied.length) errors.push(`${where}, question ${j + 1}: copies the manual word for word: "${qCopied[0]}"`);
      allStems.push(q.stem);
      qs.push(q);
    }
    const levels = [1, 2, 3, 4, 5].map((d) => qs.filter((q) => Number(q.difficulty) === d).length);
    if (qs.length < 10) warnings.push(`${where}: only ${qs.length} questions (aim for 15)`);
    if (levels.some((n) => n === 0)) warnings.push(`${where}: no questions at difficulty ${levels.flatMap((n, k) => (n ? [] : [k + 1])).join(', ')}`);
    const answers = [0, 1, 2, 3].map((a) => qs.filter((q) => q.answerIndex === a).length);
    if (qs.length >= 10 && Math.max(...answers) > qs.length * 0.5) warnings.push(`${where}: over half the answers are option ${'ABCD'[answers.indexOf(Math.max(...answers))]}; spread them`);
    sections.push({ name: s.name.trim().slice(0, 80), lesson: parsed.lesson, questions: qs, notes });
  }
  return { slug, unit, sections, errors, warnings };
}

function files(): string[] {
  if (checkOnly && args.some((a) => a.endsWith('.json'))) return args;
  const slugs = args.length ? args : UNI_COURSES.map((c) => c.slug);
  return slugs.flatMap((slug) => {
    const dir = join(CONTENT, slug);
    return existsSync(dir) ? readdirSync(dir).filter((f) => /^unit-\d+\.json$/.test(f)).sort().map((f) => join(dir, f)) : [];
  });
}

async function main() {
  const list = files();
  if (!list.length) return console.log(`No unit files found in ${CONTENT}/<course>/.`);
  const results = list.map((f) => ({ file: f, ...check(f) }));
  let bad = 0;
  for (const r of results) {
    const lessons = r.sections.length;
    const qs = r.sections.reduce((n, s) => n + s.questions.length, 0);
    console.log(`${r.errors.length ? '✗' : '✓'} ${r.file}: ${lessons} lessons, ${qs} questions`);
    for (const e of r.errors) console.log(`    ERROR ${e}`);
    for (const w of r.warnings) console.log(`    warn  ${w}`);
    if (r.errors.length) bad++;
  }
  if (checkOnly) {
    console.log(bad ? `\n${bad} file(s) need fixing.` : '\nAll good.');
    if (bad) process.exitCode = 1;
    return;
  }
  if (bad) {
    console.log(`\n${bad} file(s) have errors and were not loaded. The rest load now.`);
  }

  const { PrismaService } = await import('../../src/prisma/prisma.service.js');
  const prisma = new PrismaService();
  const tally = { lessons: 0, replaced: 0, kept: 0, questions: 0 };
  try {
    for (const r of results.filter((x) => !x.errors.length)) {
      const title = UNI_COURSES.find((c) => c.slug === r.slug)!.title;
      const subject = await prisma.examSubject.upsert({
        where: { exam_slug: { exam: 'UNIVERSITY', slug: r.slug } },
        create: { exam: 'UNIVERSITY', slug: r.slug, name: `${courseCode(r.slug)}: ${title}` },
        update: {},
      });
      const existing = await prisma.syllabusTopic.findFirst({ where: { examSubjectId: subject.id, parentId: null, order: r.unit.unit } });
      const unit = existing
        ? await prisma.syllabusTopic.update({ where: { id: existing.id }, data: { name: r.unit.title.trim(), examinerNotes: r.unit.summary?.trim() || null } })
        : await prisma.syllabusTopic.create({ data: { examSubjectId: subject.id, name: r.unit.title.trim(), order: r.unit.unit, examinerNotes: r.unit.summary?.trim() || null } });

      for (const [i, s] of r.sections.entries()) {
        const topic =
          (await prisma.syllabusTopic.findFirst({ where: { examSubjectId: subject.id, parentId: unit.id, name: s.name } })) ??
          (await prisma.syllabusTopic.create({ data: { examSubjectId: subject.id, parentId: unit.id, name: s.name, order: i } }));
        if (topic.order !== i) await prisma.syllabusTopic.update({ where: { id: topic.id }, data: { order: i } });

        const data = {
          title: s.lesson.title,
          minutes: s.lesson.minutes,
          hook: s.lesson.hook,
          slides: s.lesson.slides as unknown as Prisma.InputJsonValue,
          sources: [] as Prisma.InputJsonValue,
          checkNotes: 'Written by Claude from the course manual, in its own words.',
        };
        const lesson = await prisma.courseLesson.findUnique({ where: { topicId: topic.id } });
        if (!lesson) {
          await prisma.courseLesson.create({ data: { topicId: topic.id, status, ...(approve ? { reviewedAt: new Date() } : {}), ...data } });
          tally.lessons++;
        } else if (lesson.status !== 'APPROVED') {
          await prisma.courseLesson.update({ where: { id: lesson.id }, data: { ...data, status, ...(approve ? { reviewedAt: new Date() } : {}) } });
          tally.replaced++;
        } else tally.kept++;

        const have = await prisma.examQuestion.findMany({ where: { topicId: topic.id }, select: { stem: true } });
        const haveStems = new Set(have.map((h) => h.stem.trim()));
        const fresh = s.questions.filter((q) => !haveStems.has(q.stem.trim()));
        if (fresh.length) {
          await prisma.examQuestion.createMany({
            data: fresh.map((q) => ({
              examSubjectId: subject.id,
              topicId: topic.id,
              difficulty: Number(q.difficulty),
              stem: q.stem.trim(),
              options: q.options.map((o, k) => ({ id: 'abcd'[k], label: o.trim() })),
              answerId: 'abcd'[q.answerIndex],
              explanation: q.explanation.trim(),
              origin: 'AUTHORED' as const,
              status,
              ...(approve ? { reviewedAt: new Date() } : {}),
              checkNotes: 'Written by Claude from the course manual.',
            })),
          });
          tally.questions += fresh.length;
        }
        if (approve) await prisma.examQuestion.updateMany({ where: { topicId: topic.id, status: 'IN_REVIEW', origin: 'AUTHORED' }, data: { status: 'APPROVED', reviewedAt: new Date() } });
      }
      // Sections from an earlier attempt that this file doesn't have, and that hold nothing, go.
      await prisma.syllabusTopic.deleteMany({
        where: { parentId: unit.id, name: { notIn: r.sections.map((s) => s.name) }, lessons: { none: {} }, questions: { none: {} } },
      });
      console.log(`  loaded ${courseCode(r.slug)} unit ${r.unit.unit}`);
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(`\n${tally.lessons} new lessons, ${tally.replaced} updated, ${tally.kept} already approved (left alone), ${tally.questions} new questions.`);
  console.log(approve ? 'Loaded as approved: students can see them now.' : 'Review and approve them in Overwatch → University.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
