/**
 * Builds the university classroom from the course manuals: once, offline. Students never trigger AI.
 *
 *   pnpm uni:build                       every course in src/exams/university.ts
 *   pnpm uni:build psy-316 pos-314       just these courses
 *   pnpm uni:build psy-316 --units 1-3   just these study sessions
 *   pnpm uni:build --dry                 read and split the manuals only (no AI): shows what it found
 *   pnpm uni:build --export              same, and save each session's text to data/university/sessions/ (no AI)
 *   pnpm uni:build psy-316 --redo        write the lessons and questions again (old ones are retired, not deleted)
 *
 * For each course manual (backend/data/university/pdfs/<slug>.pdf, never committed):
 *   1. read the text and split it into its Study Sessions: each becomes a unit
 *   2. plan each unit into sections: 2–4 for a normal session, more for very long ones (Gemini)
 *   3. write each section's classroom lesson, in our own words, with Google Search for real examples (Gemini)
 *   4. write 25 lecturer-style questions per section, 5 at each difficulty (Gemini)
 *   5. solve them blind and keep only the ones whose answer matches (Gemini)
 * Lessons and questions go in as IN_REVIEW: approve them in Overwatch → University.
 * Safe to stop and run again: finished sections are skipped.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AiFeature, Prisma } from '@prisma/client';
import { extractText, getDocumentProxy } from 'unpdf';

import { AiService, aiPricing } from '../../src/ai/ai.service.js';
import { UNI_COURSES, courseCode } from '../../src/exams/university.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { tooSimilar } from '../../src/question-bank/similarity.js';
import { copiedRuns, LESSON_SCHEMA, lessonText, parseLesson } from '../../src/university/lesson-format.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const DATA = 'data/university';
const QUESTIONS_PER_LEVEL = 5;
const PARALLEL = 3;
const prisma = new PrismaService();
const ai = new AiService(prisma);
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';
const KEY = process.env.GEMINI_API_KEY;
const startedAt = new Date();

const flags = process.argv.slice(2);
const has = (f: string) => flags.includes(`--${f}`);
const flagValue = (f: string) => {
  const i = flags.indexOf(`--${f}`);
  return i >= 0 ? flags[i + 1] : undefined;
};
const unitRange = (() => {
  const v = flagValue('units');
  if (!v) return null;
  const [a, b] = v.split('-').map(Number);
  return { from: a, to: b || a };
})();

// ── Reading the manual ──────────────────────────────────

type Session = { number: number; title: string; text: string };

async function pages(slug: string): Promise<string[]> {
  const cache = join(DATA, 'text', `${slug}.json`);
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8')) as string[];
  const file = join(DATA, 'pdfs', `${slug}.pdf`);
  if (!existsSync(file)) throw new Error(`Missing ${file}. Put the course manual there.`);
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
  const { text } = await extractText(pdf, { mergePages: false });
  mkdirSync(join(DATA, 'text'), { recursive: true });
  writeFileSync(cache, JSON.stringify(text));
  return text;
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const HEADING_RE = new RegExp(`^\\s*study\\s+session\\s*(\\d+|${WORDS.join('|')})\\b\\s*[:.\\-–]?\\s*(.*)$`, 'i');

/** "Study Session 3: Short Term Memory", "Study Session3: …", "Study session Six: …" → [number, title]. */
function heading(line: string): [number, string] | null {
  const m = line.match(HEADING_RE);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : WORDS.indexOf(m[1].toLowerCase());
  // Contents lines end with dot leaders and/or a page number.
  return [n, m[2].replace(/\.{3,}.*$/, '').replace(/\s*\d+\s*$/, '').trim()];
}

/** Splits the manual into Study Sessions. The contents page (many headings on one page) is skipped. */
function sessions(all: string[]): Session[] {
  const titles = new Map<number, string>();
  for (const page of all) {
    for (const line of page.split('\n')) {
      const h = heading(line);
      if (h && h[1].length > 3 && !titles.has(h[0])) titles.set(h[0], h[1]);
    }
  }
  const out: Session[] = [];
  let current: Session | null = null;
  for (const page of all) {
    const heads = page.split('\n').map(heading).filter((h): h is [number, string] => !!h);
    const isContents = new Set(heads.map((h) => h[0])).size >= 3;
    const start = !isContents ? heads.find((h) => h[0] === (current ? current.number + 1 : 1)) : undefined;
    if (start) {
      const n = start[0];
      current = { number: n, title: titles.get(n) ?? `Study Session ${n}`, text: '' };
      out.push(current);
    }
    if (current && !isContents) current.text += `${page}\n`;
  }
  return out;
}

// ── Gemini ──────────────────────────────────────────────

class QuotaExhausted extends Error {}

type GeminiResult = { text: string; sources: { title: string }[] };

async function gemini(prompt: string, feature: AiFeature, opts: { json?: boolean; search?: boolean; temperature?: number } = {}): Promise<GeminiResult | null> {
  if (!KEY) throw new Error('GEMINI_API_KEY is not set in backend/.env');
  const blocked = await ai.blockedReason();
  if (blocked) throw new QuotaExhausted(blocked);
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: opts.temperature ?? 0.7, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
    ...(opts.search ? { tools: [{ google_search: {} }] } : {}),
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(240_000),
      });
    } catch (e) {
      console.log(`    network trouble (${(e as Error).message}); retrying`);
      await sleep(5000 * attempt);
      continue;
    }
    const json = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (res.status === 429) {
      const details = JSON.stringify(json.error?.details ?? []);
      if (/PerDay|per_day|daily/i.test(details) || /check your plan and billing/i.test(json.error?.message ?? '') && !/retryDelay/.test(details)) {
        await record(feature, undefined, Date.now() - started, 'quota exhausted');
        throw new QuotaExhausted(json.error?.message ?? 'Gemini quota exhausted');
      }
      const wait = Number(details.match(/"retryDelay":"(\d+)/)?.[1] ?? 30);
      console.log(`    rate limited; waiting ${wait}s`);
      await sleep(Math.min(wait, 90) * 1000 + 500);
      continue;
    }
    if (!res.ok) {
      await record(feature, undefined, Date.now() - started, `${res.status} ${json.error?.message ?? ''}`);
      if (res.status >= 500) {
        await sleep(4000 * attempt);
        continue;
      }
      // A request the search tool can't do: try once more without it.
      if (opts.search) return gemini(prompt, feature, { ...opts, search: false });
      console.log(`    Gemini refused: ${res.status} ${String(json.error?.message ?? '').slice(0, 200)}`);
      return null;
    }
    const cand = json.candidates?.[0];
    const text = (cand?.content?.parts ?? []).filter((p: any) => !p.thought && typeof p.text === 'string').map((p: any) => p.text).join('');
    await record(feature, json.usageMetadata, Date.now() - started, text ? null : `empty (${cand?.finishReason ?? 'no candidate'})`);
    if (!text) continue;
    const sources = ((cand?.groundingMetadata?.groundingChunks ?? []) as any[]).map((c) => ({ title: String(c.web?.title ?? '') })).filter((s) => s.title);
    return { text, sources: [...new Map(sources.map((s) => [s.title, s])).values()].slice(0, 8) };
  }
  return null;
}

async function record(feature: AiFeature, usage: Record<string, number> | undefined, latencyMs: number, error: string | null) {
  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
  const { inputPerM, outputPerM } = aiPricing();
  await prisma.aiUsage
    .create({ data: { feature, model: MODEL, inputTokens, outputTokens, costMicroUsd: Math.round(inputTokens * inputPerM + outputTokens * outputPerM), ok: !error, latencyMs, error: error?.slice(0, 500) ?? null } })
    .catch(() => undefined);
}

/** JSON from a reply that may wrap it in prose or a code fence (search replies can't use JSON mode). */
function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Prompts ─────────────────────────────────────────────

const AUDIENCE = `You are a brilliant, warm Nigerian university lecturer teaching 300 Level students at a Nigerian university (University of Ibadan standard).
Your students are smart but busy; many read on a phone with slow data. You teach so clearly that a struggling student finally "gets it", and so deeply that a first-class student learns something new.`;

const OWN_WORDS = `COPYRIGHT RULE: the course manual below is for YOUR understanding only. Never copy its sentences or phrasing; never quote more than 6 words in a row from it.
Explain everything freshly in your own words, with your own examples. You may go beyond the manual with accurate, well-established knowledge from the field.`;

type Plan = { summary: string; sections: { name: string; focus: string }[] };

/** Roughly one lesson per 6,000 characters of manual: 2–4 for a normal session, up to 10 for the very long ones. */
const sectionRange = (unit: Session) => {
  const max = Math.max(3, Math.min(10, Math.ceil(unit.text.length / 6000)));
  return { min: Math.min(2, max), max };
};

async function planUnit(course: string, unit: Session, outline: string): Promise<Plan | null> {
  const out = await gemini(
    `${AUDIENCE}
Course: ${course}. The course's study sessions, for context:
${outline}

${OWN_WORDS}

Here is Study Session ${unit.number}: "${unit.title}" from the course manual:
<<<MANUAL
${unit.text.slice(0, 110_000)}
MANUAL>>>

Plan how you will teach this study session as ${sectionRange(unit).min} to ${sectionRange(unit).max} sections, in teaching order. Each section is one 6–12 minute classroom lesson.
Cover everything in the session that could be examined. Skip the manual's admin parts (objectives lists, "study session summary" boilerplate).
Return JSON: {"summary":"one sentence on what this unit is about, for the course page (max 25 words)","sections":[{"name":"short section name, max 6 words","focus":"what this lesson must cover, 2-4 sentences, naming every concept, theory, scholar and distinction it includes"}]}`,
    'LESSON_WRITING',
    { json: true, temperature: 0.3 },
  );
  const plan = out && parseJson<Plan>(out.text);
  const sections = plan?.sections?.filter((s) => typeof s?.name === 'string' && typeof s?.focus === 'string').slice(0, sectionRange(unit).max);
  if (!plan || !sections?.length) return null;
  return { summary: String(plan.summary ?? '').slice(0, 300), sections: sections.map((s) => ({ name: s.name.trim().slice(0, 80), focus: s.focus.trim() })) };
}

async function writeLesson(course: string, unit: Session, plan: Plan, i: number, warning = '') {
  const section = plan.sections[i];
  const before = plan.sections.slice(0, i).map((s) => s.name);
  const out = await gemini(
    `${AUDIENCE}
Course: ${course}. Unit ${unit.number}: ${unit.title}.
Today's lesson: "${section.name}". It must cover: ${section.focus}
${before.length ? `Students have already had these lessons in this unit: ${before.join('; ')}. Build on them; don't re-teach them.` : 'This is the first lesson of the unit.'}

${OWN_WORDS}
${warning}

Course manual text for this unit (for your understanding only):
<<<MANUAL
${unit.text.slice(0, 110_000)}
MANUAL>>>

Use Google Search to find accurate, vivid real-world material that makes this click: a famous study, a real case, a striking statistic, a Nigerian or African example. Check facts; never invent studies, numbers or quotes.

Write the lesson as a classroom: it should feel like the best lecturer they ever had is teaching them one idea at a time.
- Start from what they already know, then build up. Explain WHY, not just WHAT.
- Use at least one Nigerian real-life example, at least two "check" slides spread through the lesson (not all at the end), one "lecturer" slide, and finish with a "recap".
- Give most "teach" slides a visual that genuinely shows the idea.
- Plain British English. No filler, no "In this lesson we will…".

Reply with ONLY the JSON, no other text:
${LESSON_SCHEMA}`,
    'LESSON_WRITING',
    { search: true, temperature: 0.7 },
  );
  if (!out) return null;
  const parsed = parseLesson(parseJson(out.text));
  return parsed ? { ...parsed, sources: out.sources } : null;
}

type Written = { stem: string; options: string[]; answerIndex: number; explanation: string; difficulty: number };

async function writeQuestions(course: string, unit: Session, section: Plan['sections'][number], lessonSummary: string, avoid: string[]): Promise<Written[] | null> {
  const out = await gemini(
    `You are a Nigerian university lecturer (University of Ibadan standard) setting objective questions for the ${course} exam.
Unit ${unit.number}: ${unit.title}. Section: "${section.name}": ${section.focus}
What the students were taught: ${lessonSummary}

${OWN_WORDS}

Course manual text for this unit (for your understanding only):
<<<MANUAL
${unit.text.slice(0, 110_000)}
MANUAL>>>

Nigerian lecturers rarely ask direct "define X" questions. They twist them. Write the way they really set papers:
- scenarios: "Chidi can recall his phone number long enough to dial it but forgets it a minute later. This best illustrates…"
- negatives and exceptions: "All of the following are true of X EXCEPT", "Which of these is NOT…"
- attribution: "The view that … is most closely associated with"
- matching and combinations: "Which of the following pairs is correctly matched?", "I, II and III… A. I and II only…"
- near-miss options: wrong options that are real terms from the course, chosen because students confuse them
- "a researcher who found … would most likely conclude that…", "the major weakness of … is"

Write exactly ${QUESTIONS_PER_LEVEL * 5} multiple-choice questions on THIS section, ${QUESTIONS_PER_LEVEL} at each difficulty:
1 = core idea, but still not a bare definition; 2 = understanding; 3 = applying it to a scenario; 4 = fine distinctions and traps; 5 = the hardest question a strict lecturer would set (combinations, two concepts at once, subtle exceptions).
Rules: exactly 4 options, exactly one correct; no "all of the above"/"none of the above"; options similar in length; no question needs a diagram.
"explanation": 1-3 sentences that teach why the answer is right AND why the tempting wrong option is wrong.
${avoid.length ? `Already in our bank; write different ones:\n${avoid.map((s) => `- ${s}`).join('\n')}\n` : ''}Double-check every answer.
Return JSON: {"questions":[{"difficulty":1,"stem":"...","options":["...","...","...","..."],"answerIndex":0,"explanation":"..."}]}`,
    'QUESTION_WRITING',
    { json: true, temperature: 0.8 },
  );
  const parsed = out && parseJson<{ questions: Written[] }>(out.text);
  if (!Array.isArray(parsed?.questions)) return null;
  return parsed.questions.filter(
    (q) =>
      typeof q?.stem === 'string' &&
      q.stem.trim().length > 10 &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.every((o) => typeof o === 'string' && o.trim()) &&
      new Set(q.options.map((o) => o.trim().toLowerCase())).size === 4 &&
      !q.options.some((o) => /^(all|none) of the above/i.test(o.trim())) &&
      Number.isInteger(q.answerIndex) &&
      q.answerIndex >= 0 &&
      q.answerIndex < 4 &&
      typeof q.explanation === 'string' &&
      [1, 2, 3, 4, 5].includes(Number(q.difficulty)),
  );
}

const LETTERS = 'ABCD';

/** Solves the questions without the answers. Returns the chosen index per question, or null where unsure. */
async function solve(course: string, questions: Written[]): Promise<(number | null)[] | null> {
  const out = await gemini(
    `You are a strict external examiner for the Nigerian university course ${course}. Work out each question yourself, then give the letter of the correct option.
If a question is ambiguous, has no correct option or more than one, set "sure" to false.

${questions.map((q, i) => `[q${i}] ${q.stem}\n${q.options.map((o, j) => `${LETTERS[j]}. ${o}`).join('\n')}`).join('\n\n')}

Return JSON: {"answers":[{"id":"q0","answer":"A","sure":true}]}`,
    'QUESTION_CHECK',
    { json: true, temperature: 0 },
  );
  const parsed = out && parseJson<{ answers: { id: string; answer: string; sure: boolean }[] }>(out.text);
  if (!Array.isArray(parsed?.answers)) return null;
  const result: (number | null)[] = questions.map(() => null);
  for (const a of parsed.answers) {
    const i = Number(String(a?.id).replace('q', ''));
    const pick = LETTERS.indexOf(String(a?.answer).trim().toUpperCase());
    if (Number.isInteger(i) && i >= 0 && i < questions.length) result[i] = a.sure === false || pick < 0 ? null : pick;
  }
  return result;
}

// ── Building ────────────────────────────────────────────

type Tally = { lessons: number; flagged: number; questions: number; disagreed: number; failed: number };
const tally: Tally = { lessons: 0, flagged: 0, questions: 0, disagreed: 0, failed: 0 };

async function buildSection(course: string, examSubjectId: string, unit: Session, unitTopicId: string, plan: Plan, i: number) {
  const section = plan.sections[i];
  const topic = await prisma.syllabusTopic.upsert({
    where: { examSubjectId_parentId_name: { examSubjectId, parentId: unitTopicId, name: section.name } },
    create: { examSubjectId, parentId: unitTopicId, name: section.name, order: i },
    update: { order: i },
  });
  const label = `  ${unit.number}.${i + 1} ${section.name}`;

  // Lesson
  let lesson = await prisma.courseLesson.findUnique({ where: { topicId: topic.id } });
  if (!lesson) {
    let written = await writeLesson(course, unit, plan, i);
    let copied = written ? copiedRuns(lessonText(written.lesson), unit.text) : [];
    if (written && copied.length) {
      // One more go, told exactly what it copied.
      const again = await writeLesson(course, unit, plan, i, `Your last draft copied the manual word for word in places, e.g. "${copied[0]}". Rewrite everything in your own words.`);
      const againCopied = again ? copiedRuns(lessonText(again.lesson), unit.text) : copied;
      if (again && againCopied.length <= copied.length) [written, copied] = [again, againCopied];
    }
    if (!written) {
      console.log(`${label}: lesson failed, will retry on the next run`);
      tally.failed++;
      return;
    }
    const notes = [
      copied.length ? `Copied wording from the manual (${copied.length}): "${copied.slice(0, 3).join('" · "')}". Edit or retire before approving.` : null,
      written.dropped ? `${written.dropped} malformed slide(s) dropped.` : null,
    ].filter(Boolean);
    lesson = await prisma.courseLesson.create({
      data: {
        topicId: topic.id,
        title: written.lesson.title,
        minutes: written.lesson.minutes,
        hook: written.lesson.hook,
        slides: written.lesson.slides as unknown as Prisma.InputJsonValue,
        sources: written.sources as unknown as Prisma.InputJsonValue,
        status: 'IN_REVIEW',
        checkNotes: notes.length ? notes.join(' ') : null,
      },
    });
    tally.lessons++;
    if (copied.length) tally.flagged++;
    console.log(`${label}: lesson "${lesson.title}" (${written.lesson.slides.length} slides${copied.length ? ', flagged for copied wording' : ''})`);
  }

  // Questions
  const existing = await prisma.examQuestion.findMany({ where: { topicId: topic.id, status: { not: 'RETIRED' } }, select: { stem: true } });
  if (existing.length >= QUESTIONS_PER_LEVEL * 5 * 0.6) return;
  const slides = lesson.slides as { kind: string; heading?: string; points?: string[] }[];
  const summary = [lesson.title, ...slides.filter((s) => s.heading).map((s) => s.heading), ...(slides.find((s) => s.kind === 'recap')?.points ?? [])].join('; ');
  const written = await writeQuestions(course, unit, section, summary, existing.map((e) => e.stem.slice(0, 140)));
  if (!written?.length) {
    console.log(`${label}: questions failed, will retry on the next run`);
    tally.failed++;
    return;
  }
  const fresh = written.filter((q, j) => !tooSimilar(q.stem, existing.map((e) => e.stem)) && !tooSimilar(q.stem, written.slice(0, j).map((w) => w.stem)));
  const verdict = await solve(course, fresh);
  let kept = 0;
  for (const [j, q] of fresh.entries()) {
    if (verdict?.[j] !== q.answerIndex) {
      tally.disagreed++;
      continue;
    }
    await prisma.examQuestion.create({
      data: {
        examSubjectId,
        topicId: topic.id,
        difficulty: Number(q.difficulty),
        stem: q.stem.trim(),
        options: q.options.map((o, k) => ({ id: 'abcd'[k], label: o.trim() })),
        answerId: 'abcd'[q.answerIndex],
        explanation: q.explanation.trim(),
        origin: 'GENERATED',
        status: 'IN_REVIEW',
        checkNotes: 'Blind solve agreed with the answer.',
      },
    });
    kept++;
  }
  tally.questions += kept;
  console.log(`${label}: ${kept} of ${written.length} questions kept`);
}

async function buildCourse(slug: string) {
  const course = `${courseCode(slug)}: ${UNI_COURSES.find((c) => c.slug === slug)!.title}`;
  // Same row the API's catalog sync makes (ExamsService), so the script works before the API has run.
  const subject = await prisma.examSubject.upsert({
    where: { exam_slug: { exam: 'UNIVERSITY', slug } },
    create: { exam: 'UNIVERSITY', slug, name: course },
    update: {},
  });
  const units = sessions(await pages(slug));
  console.log(`\n${course}: ${units.length} study sessions found`);
  if (has('dry') || has('export')) {
    for (const u of units) console.log(`  ${u.number}. ${u.title} (${u.text.length.toLocaleString()} characters)`);
    if (has('export')) {
      // Each session's text, for writing the classes by hand (see content/university/WRITING-GUIDE.md).
      const dir = join(DATA, 'sessions', slug);
      mkdirSync(dir, { recursive: true });
      for (const u of units) writeFileSync(join(dir, `unit-${String(u.number).padStart(2, '0')}.txt`), `${course}\nStudy Session ${u.number}: ${u.title}\n\n${u.text}`);
      console.log(`  saved to ${dir}`);
    }
    return;
  }
  if (has('redo')) {
    const topics = await prisma.syllabusTopic.findMany({ where: { examSubjectId: subject.id, parentId: { not: null } }, select: { id: true, parent: { select: { order: true } } } });
    const ids = topics.filter((t) => !unitRange || (t.parent!.order >= unitRange.from && t.parent!.order <= unitRange.to)).map((t) => t.id);
    await prisma.courseLesson.deleteMany({ where: { topicId: { in: ids }, progress: { none: {} } } });
    await prisma.courseLesson.updateMany({ where: { topicId: { in: ids } }, data: { status: 'RETIRED' } });
    await prisma.examQuestion.updateMany({ where: { topicId: { in: ids }, status: { not: 'RETIRED' } }, data: { status: 'RETIRED' } });
    console.log(`  retired the old lessons and questions of ${ids.length} sections`);
  }
  const outline = units.map((u) => `${u.number}. ${u.title}`).join('\n');

  for (const unit of units) {
    if (unitRange && (unit.number < unitRange.from || unit.number > unitRange.to)) continue;
    let unitTopic = await prisma.syllabusTopic.findFirst({ where: { examSubjectId: subject.id, parentId: null, order: unit.number } });
    let plan: Plan | null = null;
    const sections = unitTopic ? await prisma.syllabusTopic.findMany({ where: { parentId: unitTopic.id }, orderBy: { order: 'asc' } }) : [];
    if (unitTopic && sections.length) {
      // Planned on an earlier run: rebuild the plan from what's saved (the focus lives in the plan cache).
      const cached = readPlan(slug, unit.number);
      plan = cached ?? { summary: unitTopic.examinerNotes ?? '', sections: sections.map((s) => ({ name: s.name, focus: s.name })) };
    } else {
      plan = await planUnit(course, unit, outline);
      if (!plan) {
        console.log(`  Unit ${unit.number}: planning failed, will retry on the next run`);
        tally.failed++;
        continue;
      }
      savePlan(slug, unit.number, plan);
      unitTopic = unitTopic
        ? await prisma.syllabusTopic.update({ where: { id: unitTopic.id }, data: { examinerNotes: plan.summary } })
        : await prisma.syllabusTopic.create({ data: { examSubjectId: subject.id, name: unit.title, order: unit.number, examinerNotes: plan.summary } });
    }
    console.log(` Unit ${unit.number}: ${unit.title}`);
    const queue = plan.sections.map((_, i) => i);
    const topicId = unitTopic!.id;
    await Promise.all(
      Array.from({ length: PARALLEL }, async () => {
        for (let i = queue.shift(); i !== undefined; i = queue.shift()) await buildSection(course, subject.id, unit, topicId, plan!, i);
      }),
    );
  }
}

const planFile = (slug: string, n: number) => join(DATA, 'plans', `${slug}-${n}.json`);
function savePlan(slug: string, n: number, plan: Plan) {
  mkdirSync(join(DATA, 'plans'), { recursive: true });
  writeFileSync(planFile(slug, n), JSON.stringify(plan, null, 2));
}
function readPlan(slug: string, n: number): Plan | null {
  return existsSync(planFile(slug, n)) ? (JSON.parse(readFileSync(planFile(slug, n), 'utf8')) as Plan) : null;
}

async function main() {
  const chosen = flags.filter((f, i) => !f.startsWith('--') && !(flags[i - 1] === '--units'));
  const slugs = chosen.length ? chosen : UNI_COURSES.map((c) => c.slug);
  for (const s of slugs) if (!UNI_COURSES.some((c) => c.slug === s)) throw new Error(`Unknown course "${s}". Courses: ${UNI_COURSES.map((c) => c.slug).join(', ')}`);
  try {
    for (const slug of slugs) await buildCourse(slug);
  } catch (e) {
    if (!(e instanceof QuotaExhausted)) throw e;
    console.log(`\nStopped: ${e.message}\nRun the same command again later; it carries on where it stopped.`);
  }
  if (has('dry') || has('export')) return;
  const usage = await prisma.aiUsage.aggregate({ where: { createdAt: { gte: startedAt }, feature: { in: ['LESSON_WRITING', 'QUESTION_WRITING', 'QUESTION_CHECK'] } }, _sum: { costMicroUsd: true }, _count: true });
  const usd = (usage._sum.costMicroUsd ?? 0) / 1e6;
  console.log(`\nThis run: ${tally.lessons} lessons (${tally.flagged} flagged for copied wording) · ${tally.questions} questions kept · ${tally.disagreed} failed the blind check · ${tally.failed} steps to retry`);
  console.log(`AI: ${usage._count} calls ≈ $${usd.toFixed(2)} (₦${Math.round(usd * aiPricing().ngnPerUsd).toLocaleString()})`);
  console.log('Review and approve them in Overwatch → University.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
