import type { ExamBody } from '@prisma/client';

import { business, creativeArts, french, prevocational } from './bece/practical.js';
import { civic, crs, history, irs } from './bece/religion-history.js';
import { biologyTopics } from './biology/topics.js';
import { biology as biologyCore } from './biology/index.js';
import { english } from './english/index.js';
import { juniorPassages, seniorPassages } from './english/passages.js';
import { simpleEnglish } from './english/simple.js';
import { forExam, type Template } from './engine.js';
import { jambChemistry } from './jamb-chemistry/index.js';
import { jambMathematics } from './jamb-mathematics/index.js';
import { jambPhysics } from './jamb-physics/index.js';
import { beceMathematics, ceMathematics } from './junior-maths.js';
import { beceScience, ceScience } from './junior-science.js';
import { quantitative, verbal } from './reasoning.js';
import { socialStudies } from './social-studies.js';
import { ssceMathematics } from './ssce-mathematics.js';

const biology = [...biologyCore, ...biologyTopics];
const seniorEnglish = [...english, ...seniorPassages];
/** The English templates pitched low enough for primary 6. */
const CE_ENGLISH = new Set(['english/plurals', 'english/prepositions', 'english/verb-forms', 'english/concord', 'english/spelling', 'english/rhymes']);

/** Templates by exam and subject slug. Shared subjects get an exam prefix on each key, so every exam has its own questions. */
export const TEMPLATES: Partial<Record<ExamBody, Record<string, Template[]>>> = {
  JAMB: { mathematics: jambMathematics, physics: jambPhysics, chemistry: jambChemistry, biology: forExam('jamb', biology), 'english-language': forExam('jamb', seniorEnglish) },
  WAEC: { mathematics: ssceMathematics('waec'), biology: forExam('waec', biology), 'english-language': forExam('waec', seniorEnglish) },
  NECO: { mathematics: ssceMathematics('neco'), biology: forExam('neco', biology), 'english-language': forExam('neco', seniorEnglish) },
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
