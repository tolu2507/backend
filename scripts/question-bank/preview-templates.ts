/**
 * Prints sample questions from each template, to read and solve by hand before approving.
 *
 *   pnpm tsx scripts/question-bank/preview-templates.ts JAMB mathematics [keyFilter] [--per 2]
 */
import type { ExamBody } from '@prisma/client';

import { instance } from '../../src/question-bank/templates/engine.js';
import { TEMPLATES } from '../../src/question-bank/templates/index.js';

const args = process.argv.slice(2);
const perAt = args.indexOf('--per');
const per = perAt >= 0 ? Number(args.splice(perAt, 2)[1]) || 2 : 2;
const [exam, slug, filter] = args;
const list = (TEMPLATES[exam as ExamBody]?.[slug] ?? []).filter((t) => !filter || t.key.includes(filter));
if (!list.length) throw new Error(`No templates for ${exam} ${slug}${filter ? ` matching ${filter}` : ''}`);

for (const t of list) {
  console.log(`\n━━ ${t.key}  [${t.topic.join(' › ')}]`);
  let shown = 0;
  for (let seed = 1000; shown < per && seed < 1200; seed++) {
    const q = instance(t, seed);
    if (!q) continue;
    shown++;
    console.log(`\n  (d${q.difficulty}) ${q.stem}`);
    for (const o of q.options) console.log(`    ${o.id === q.answerId ? '✔' : ' '} ${o.id}) ${o.label}`);
    console.log(`    ↳ ${q.explanation.replace(/\n/g, '\n      ')}`);
  }
}
