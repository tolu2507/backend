import type { ExamBody } from '@prisma/client';

import { business, creativeArts, french, prevocational } from './bece/practical.js';
import { civic, crs, history, irs } from './bece/religion-history.js';
import { biologyTopics } from './biology/topics.js';
import { accounting, geography } from './senior/accounts-geography.js';
import { agriculture, crsSenior, irsSenior } from './senior/agric-religion.js';
import { economics } from './senior/economics.js';
import { commerce, government } from './senior/government-commerce.js';
import { biology as biologyCore } from './biology/index.js';
import { english } from './english/index.js';
import { juniorPassages, seniorPassages } from './english/passages.js';
import { simpleEnglish } from './english/simple.js';
import { ELECTIVES } from './electives/index.js';
import { forExam, type Template } from './engine.js';
import { jambChemistry } from './jamb-chemistry/index.js';
import { jambMathematics } from './jamb-mathematics/index.js';
import { jambPhysics } from './jamb-physics/index.js';
import { beceMathematics, ceMathematics } from './junior-maths.js';
import { beceScience, ceScience } from './junior-science.js';
import { quantitative, verbal } from './reasoning.js';
import { socialStudies } from './social-studies.js';
import { nurseryLetters, nurseryNumbers, nurseryWorld } from './nursery/index.js';
import { primaryEnglish, primaryScience } from './primary/english-science.js';
import { primaryMaths } from './primary/maths.js';
import { ssceFurtherMathematics, ssceMathematics } from './ssce-mathematics.js';

const biology = [...biologyCore, ...biologyTopics];
const seniorEnglish = [...english, ...seniorPassages];

/** Senior arts and commercial subjects, the same for JAMB, WAEC and NECO (each exam gets its own keys). */
const seniorSubjects = (exam: string): Record<string, Template[]> => ({
  economics: forExam(exam, economics),
  government: forExam(exam, government),
  commerce: forExam(exam, commerce),
  'accounts-principles-of-accounts': forExam(exam, accounting),
  geography: forExam(exam, geography),
  'agricultural-science': forExam(exam, agriculture),
  'christian-religious-studies-crs': forExam(exam, [...crs, ...crsSenior]),
  'islamic-religious-studies-irs': forExam(exam, [...irs, ...irsSenior]),
  history: forExam(exam, history),
});
/** Civic Education (WAEC and NECO only): national values and citizenship, plus government and national symbols. */
const civicEducation = (exam: string) => forExam(exam, [...civic, ...socialStudies.filter((t) => t.key !== 'social/states-capitals')]);
/** The English templates pitched low enough for primary 6. */
const CE_ENGLISH = new Set(['english/plurals', 'english/prepositions', 'english/verb-forms', 'english/concord', 'english/spelling', 'english/rhymes']);

/** Templates by exam and subject slug. Shared subjects get an exam prefix on each key, so every exam has its own questions. */
export const TEMPLATES: Partial<Record<ExamBody, Record<string, Template[]>>> = {
  JAMB: { ...seniorSubjects('jamb'), mathematics: jambMathematics, physics: jambPhysics, chemistry: jambChemistry, biology: forExam('jamb', biology), 'english-language': forExam('jamb', seniorEnglish) },
  WAEC: { ...seniorSubjects('waec'), 'civic-education': civicEducation('waec'), mathematics: ssceMathematics('waec'), 'further-mathematics': ssceFurtherMathematics('waec'), physics: forExam('waec', jambPhysics), chemistry: forExam('waec', jambChemistry), biology: forExam('waec', biology), 'english-language': forExam('waec', seniorEnglish) },
  NECO: { ...seniorSubjects('neco'), 'civic-education': civicEducation('neco'), mathematics: ssceMathematics('neco'), 'further-mathematics': ssceFurtherMathematics('neco'), physics: forExam('neco', jambPhysics), chemistry: forExam('neco', jambChemistry), biology: forExam('neco', biology), 'english-language': forExam('neco', seniorEnglish) },
  BECE: {
    mathematics: beceMathematics(),
    'english-language': forExam('bece', [...english, ...simpleEnglish, ...juniorPassages]),
    'basic-science-and-technology': beceScience(),
    'business-studies': forExam('bece', business),
    'christian-religious-studies': forExam('bece', crs),
    'islamic-religion-studies': forExam('bece', irs),
    history: forExam('bece', history),
    'national-value-education': forExam('bece', civic),
    'pre-vocational-studies': forExam('bece', prevocational),
    'cultural-and-creative-arts': forExam('bece', creativeArts),
    french: forExam('bece', french),
  },
  COMMON_ENTRANCE: {
    mathematics: ceMathematics(),
    'english-language': forExam('ce', [...english.filter((t) => CE_ENGLISH.has(t.key)), ...simpleEnglish, ...juniorPassages]),
    'basic-science': ceScience(),
    'quantitative-reasoning': forExam('ce', quantitative),
    'verbal-reasoning': forExam('ce', verbal),
    'social-studies': forExam('ce', socialStudies),
  },
};

// Senior electives: add each to the exams that set it.
for (const [slug, { exams, templates }] of Object.entries(ELECTIVES)) {
  // The subject goes in the key too: several electives share templates (e.g. the food ones).
  for (const exam of exams) (TEMPLATES[exam] ??= {})[slug] = forExam(`${exam.toLowerCase()}-${slug}`, templates);
}

// Class practice for Primary 1–5: each class has its own Mathematics, English and Basic Science.
for (const n of [1, 2, 3, 4, 5] as const) {
  const p = (TEMPLATES.PRIMARY ??= {});
  p[`primary-${n}-mathematics`] = forExam(`primary-${n}`, primaryMaths(n));
  p[`primary-${n}-english-language`] = forExam(`primary-${n}`, primaryEnglish(n));
  p[`primary-${n}-basic-science`] = forExam(`primary-${n}`, primaryScience(n));
}

// Class practice for Nursery 1–2: picture questions, read aloud by the app.
for (const n of [1, 2] as const) {
  const p = (TEMPLATES.NURSERY ??= {});
  p[`nursery-${n}-numbers`] = forExam(`nursery-${n}`, nurseryNumbers(n));
  p[`nursery-${n}-letters-and-sounds`] = forExam(`nursery-${n}`, nurseryLetters(n));
  p[`nursery-${n}-my-world`] = forExam(`nursery-${n}`, nurseryWorld(n));
}
