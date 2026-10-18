/**
 * Loads crawled objective past questions into PastQuestion, cleaned up:
 * HTML → plain text (x^2, H_2O), broken characters repaired, duplicates dropped.
 * Internal analysis data only: students never see PastQuestion rows.
 *
 *   pnpm tsx scripts/past-papers/import.ts [jamb waec neco bece ncee]
 *
 * Safe to re-run: rows are keyed on (source, sourceId) and updated in place.
 */
import { PrismaClient, type ExamBody } from '@prisma/client';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanText } from './clean.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const prisma = new PrismaClient();
const RAW = join(import.meta.dirname, '../../data/past-papers/raw/schoolngr');

const EXAM: Record<string, ExamBody> = { jamb: 'JAMB', waec: 'WAEC', neco: 'NECO', bece: 'BECE', ncee: 'COMMON_ENTRANCE' };

/** Source slugs that belong to another subject in our catalog. */
const SUBJECT_ALIAS: Record<string, string> = {
  // JAMB's set novels are tested inside Use of English
  'lekki-headmaster': 'english-language',
  'life-changer': 'english-language',
  'sweet-sixteen': 'english-language',
  // NECO and the site spell a few differently from WAEC
  'christian-religious-studies': 'christian-religious-studies-crs',
  'islamic-religious-studies': 'islamic-religious-studies-irs',
  'food-and-nutrition': 'foods-and-nutrition',
};

type Raw = { sourceId: string; exam: string; subject: string; year: number; question: string; options: { label: string; html: string }[]; answer: string | null; explanation: string | null; images: string[] };

async function main() {
  const wanted = process.argv.slice(2);
  const subjects = await prisma.examSubject.findMany();
  const subjectId = (exam: ExamBody, slug: string) =>
    subjects.find((s) => s.exam === exam && s.slug === slug)?.id ??
    subjects.find((s) => s.exam === exam && s.slug === SUBJECT_ALIAS[slug])?.id ??
    // BECE/NECO slugs sometimes drop the -crs / -irs suffix the other way round
    subjects.find((s) => s.exam === exam && s.slug.replace(/-(crs|irs)$/, '') === slug.replace(/-(crs|irs)$/, ''))?.id;

  for (const dir of wanted.length ? wanted : readdirSync(RAW)) {
    const exam = EXAM[dir];
    if (!exam) continue;
    for (const file of readdirSync(join(RAW, dir)).filter((f) => f.endsWith('.jsonl'))) {
      const slug = file.replace(/\.jsonl$/, '');
      const examSubjectId = subjectId(exam, slug);
      if (!examSubjectId) {
        console.log(`${exam} ${slug}: not in our catalog, skipped`);
        continue;
      }
      const rows = readFileSync(join(RAW, dir, file), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Raw);

      // The same question is sometimes listed under several years; keep the earliest.
      const seen = new Map<string, Raw>();
      for (const r of rows.sort((a, b) => a.year - b.year)) {
        const key = cleanText(r.question).toLowerCase().replace(/\W+/g, ' ').trim() + '|' + r.options.map((o) => cleanText(o.html).toLowerCase()).join('|');
        if (!seen.has(key)) seen.set(key, r);
      }

      let saved = 0;
      let skipped = 0;
      for (const r of seen.values()) {
        const stem = cleanText(r.question);
        const options = r.options.map((o) => ({ label: o.label, text: cleanText(o.html) }));
        // Unusable: no question text, fewer than 2 options, or an answer that isn't one of them.
        if (!stem || options.length < 2 || (r.answer && !options.some((o) => o.label === r.answer))) {
          skipped++;
          continue;
        }
        const data = {
          examSubjectId,
          year: r.year,
          paper: 'Objective',
          stem: r.images.length ? `${stem}\n[diagram: ${r.images.join(' ')}]` : stem,
          options,
          answer: r.answer,
          explanation: r.explanation ? cleanText(r.explanation) : null,
        };
        await prisma.pastQuestion.upsert({ where: { source_sourceId: { source: 'schoolngr', sourceId: `${dir}/${slug}/${r.sourceId}` } }, create: { source: 'schoolngr', sourceId: `${dir}/${slug}/${r.sourceId}`, ...data }, update: data });
        saved++;
      }
      console.log(`${exam} ${slug}: ${saved} saved, ${rows.length - seen.size} duplicates, ${skipped} unusable`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
