/**
 * Collects objective past questions (question, options, answer, explanation) from
 * schoolngr.com/classroom for every subject of each exam, core subjects first. Internal pattern analysis
 * only: these are never shown to students.
 *
 *   pnpm tsx scripts/past-papers/crawl-schoolngr.ts [jamb waec neco bece ncee]
 *
 * Writes data/past-papers/raw/schoolngr/<exam>/<subject>.jsonl, one question per line.
 * One request a second; questions already collected are skipped, so it's safe to re-run.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://www.schoolngr.com/classroom';
const OUT = join(import.meta.dirname, '../../data/past-papers/raw/schoolngr');
const DELAY_MS = 1000;
const MAX_PAGES = 200; // safety stop per exam/subject/year

// Crawled first; every other subject the site lists for the exam follows.
const SECONDARY = ['english-language', 'mathematics', 'physics', 'chemistry', 'biology'];
const EXAMS: Record<string, { first: string[]; years: number[] }> = {
  jamb: { first: SECONDARY, years: range(2017, 2023) }, // UTME years after 2023 aren't published there yet
  waec: { first: SECONDARY, years: range(2019, 2025) },
  neco: { first: SECONDARY, years: range(2019, 2025) },
  bece: { first: ['english-language', 'mathematics', 'basic-science-and-technology'], years: range(2019, 2025) },
  ncee: { first: ['mathematics', 'english-language', 'quantitative-reasoning', 'verbal-reasoning', 'basic-science', 'social-studies'], years: range(2019, 2025) }, // Common Entrance
};

export interface RawQuestion {
  source: 'schoolngr';
  sourceId: string;
  url: string;
  exam: string;
  subject: string;
  year: number;
  question: string; // HTML as published (may hold <img>, <sup>, …)
  options: { label: string; html: string }[];
  answer: string | null; // option label, e.g. "C"
  explanation: string | null;
  images: string[];
}

function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (BrainBox past-paper research)' } });
      await sleep(DELAY_MS);
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
    } catch {
      // network blip; retry below
    }
    await sleep(DELAY_MS * attempt * 3);
  }
  return null;
}

/** Inner HTML of the first element with this class (the site's markup doesn't nest these). */
function block(html: string, className: string): string | null {
  const m = html.match(new RegExp(`<div class="${className}">([\\s\\S]*?)</div>`));
  return m ? m[1].trim() : null;
}

function parseQuestion(html: string, url: string, exam: string, subject: string, year: number): RawQuestion | null {
  const question = block(html, 'question-text');
  if (!question) return null;
  const options = [...html.matchAll(/<li data-option="([A-E])"[^>]*>\s*<span class="option-label">[A-E]<\/span>([\s\S]*?)<\/li>/g)].map(
    ([, label, body]) => ({ label, html: body.trim() }),
  );
  const answer = html.match(/<li data-option="([A-E])" data-correct="true"/)?.[1] ?? null;
  const explanation = block(html, 'question-explanation-content')?.replace(/^<strong>Explanation:<\/strong>(<br\/?>)?/, '').trim() || null;
  const images = [...`${question}${explanation ?? ''}`.matchAll(/<img[^>]+src=["']([^"']+)["']/g)].map(([, src]) => new URL(src, url).href);
  return { source: 'schoolngr', sourceId: url.split('/').pop()!, url, exam, subject, year, question, options, answer, explanation, images };
}

async function subjectsFor(exam: string, first: string[]): Promise<string[]> {
  const page = await get(`${SITE}/${exam}`);
  if (!page) throw new Error(`Couldn't load the ${exam} subject list`);
  const listed = [...new Set([...page.matchAll(new RegExp(`classroom/${exam}/([a-z0-9-]+)`, 'g'))].map((m) => m[1]))];
  return [...first, ...listed.filter((s) => !first.includes(s))];
}

function alreadyCollected(file: string): Set<string> {
  if (!existsSync(file)) return new Set();
  return new Set(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => (JSON.parse(line) as RawQuestion).sourceId),
  );
}

async function crawl(exam: string, subject: string, year: number, file: string, done: Set<string>) {
  const ids: string[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const list = await get(`${SITE}/${exam}/${subject}?examyear=${year}&page=${page}`);
    if (!list) break;
    const fresh = [...new Set([...list.matchAll(new RegExp(`classroom/${subject}/(\\d+)`, 'g'))].map((m) => m[1]))].filter((id) => !ids.includes(id));
    if (!fresh.length) break; // past the last page
    ids.push(...fresh);
  }

  let saved = 0;
  for (const id of ids) {
    if (done.has(id)) continue;
    const url = `${SITE}/${subject}/${id}`;
    const html = await get(url);
    const q = html && parseQuestion(html, url, exam, subject, year);
    if (!q) continue;
    appendFileSync(file, `${JSON.stringify(q)}\n`);
    done.add(id);
    saved++;
  }
  console.log(`${exam} ${subject} ${year}: ${ids.length} listed, ${saved} new`);
}

async function main() {
  const wanted = process.argv.slice(2);
  const exams = wanted.length ? wanted : Object.keys(EXAMS);
  const core: [string, string][] = [];
  const rest: [string, string][] = [];
  for (const exam of exams) {
    const plan = EXAMS[exam];
    if (!plan) throw new Error(`Unknown exam ${exam}. Known: ${Object.keys(EXAMS).join(', ')}`);
    mkdirSync(join(OUT, exam), { recursive: true });
    for (const subject of await subjectsFor(exam, plan.first)) (plan.first.includes(subject) ? core : rest).push([exam, subject]);
  }

  // Core subjects for every exam first, so analysis can start before the long tail finishes.
  for (const [exam, subject] of [...core, ...rest]) {
    const file = join(OUT, exam, `${subject}.jsonl`);
    const done = alreadyCollected(file);
    for (const year of EXAMS[exam].years) await crawl(exam, subject, year, file, done);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
