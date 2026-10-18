/**
 * Mirrors WAEC's free e-learning toolkit (waeconline.org.ng/e-learning) for every subject,
 * core subjects first: questions, the Chief Examiner's comments, weaknesses and expected answers.
 * Raw pages are for internal pattern analysis only and are never shown to students.
 *
 *   pnpm tsx scripts/past-papers/crawl-waec.ts [Physics Chemistry ...]
 *
 * One request a second; files already on disk are skipped, so it's safe to re-run.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BASE = 'https://waeconline.org.ng/e-learning/';
const OUT = join(import.meta.dirname, '../../data/past-papers/raw/waec');
const DELAY_MS = 1000;

// Crawled first (folder on the site → its index page); every other subject follows.
const CORE: Record<string, string> = {
  English: 'Englmain.html',
  Mathematics: 'mathsmain.html',
  Physics: 'physmain.html',
  Chemistry: 'chemmain.html',
  Biology: 'Biomain.html',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Nexus past-paper research)' } });
      if (res.status === 404) return null;
      if (res.ok) return res;
    } catch {
      // network blip; retry below
    }
    await sleep(DELAY_MS * attempt * 3);
  }
  return null;
}

/** Links that stay inside this subject's folder, resolved to absolute URLs. */
function sameFolderLinks(html: string, pageUrl: string, folder: string): string[] {
  const out: string[] = [];
  for (const [, ref] of html.matchAll(/(?:href|src)\s*=\s*["']([^"'#]+)["']/gi)) {
    let url: URL;
    try {
      url = new URL(ref.trim(), pageUrl);
    } catch {
      continue;
    }
    if (!url.href.toLowerCase().startsWith(`${BASE}${folder}/`.toLowerCase())) continue;
    if (!/\.(html?|png|jpe?g|gif|bmp|wmf|emz)$/i.test(url.pathname)) continue;
    out.push(url.href.split('?')[0]);
  }
  for (const [, page] of html.matchAll(/window\.location\.href\s*=\s*'([^']+)'/g)) {
    out.push(new URL(page, pageUrl).href);
  }
  return out;
}

async function crawlSubject(folder: string, index: string) {
  const queue = [`${BASE}${folder}/${index}`];
  const seen = new Set<string>();
  let fetched = 0;
  let missing = 0;

  while (queue.length) {
    const url = queue.shift()!;
    const key = url.toLowerCase(); // the server ignores case; links mix it
    if (seen.has(key)) continue;
    seen.add(key);

    const file = join(OUT, folder, decodeURIComponent(new URL(url).pathname.split('/').pop()!));
    const isPage = /\.html?$/i.test(file);
    let html: string | null = null;

    if (existsSync(file)) {
      if (isPage) html = readFileSync(file, 'latin1');
    } else {
      const res = await fetchWithRetry(url);
      await sleep(DELAY_MS);
      if (!res) {
        missing++;
        continue;
      }
      const body = Buffer.from(await res.arrayBuffer());
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, body);
      fetched++;
      if (isPage) html = body.toString('latin1');
      if (fetched % 25 === 0) console.log(`  ${folder}: ${fetched} fetched, ${queue.length} queued`);
    }

    if (html) for (const link of sameFolderLinks(html, url, folder)) if (!seen.has(link.toLowerCase())) queue.push(link);
  }
  console.log(`${folder}: ${seen.size - missing} files (${fetched} new, ${missing} broken links)`);
}

/** Every subject the toolkit's home page links to, core subjects first. */
async function allSubjects(): Promise<Record<string, string>> {
  const res = await fetchWithRetry(BASE);
  if (!res) throw new Error("Couldn't load the e-learning home page");
  const subjects = { ...CORE };
  for (const [, folder, index] of (await res.text()).matchAll(/href="([A-Za-z]+)\/([A-Za-z]+main\.html)"/g)) subjects[folder] ??= index;
  return subjects;
}

async function main() {
  const subjects = await allSubjects();
  const wanted = process.argv.slice(2);
  for (const folder of wanted.length ? wanted : Object.keys(subjects)) {
    if (!subjects[folder]) throw new Error(`Unknown subject ${folder}. Known: ${Object.keys(subjects).join(', ')}`);
    await crawlSubject(folder, subjects[folder]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
