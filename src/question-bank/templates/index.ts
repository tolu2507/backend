import type { ExamBody } from '@prisma/client';

import { biology } from './biology/index.js';
import { english } from './english/index.js';
import { forExam, type Template } from './engine.js';
import { jambChemistry } from './jamb-chemistry/index.js';
import { jambMathematics } from './jamb-mathematics/index.js';
import { jambPhysics } from './jamb-physics/index.js';
import { ssceMathematics } from './ssce-mathematics.js';

/** Templates by exam and subject slug. Shared subjects get an exam prefix on each key, so every exam has its own questions. */
export const TEMPLATES: Partial<Record<ExamBody, Record<string, Template[]>>> = {
  JAMB: { mathematics: jambMathematics, physics: jambPhysics, chemistry: jambChemistry, biology: forExam('jamb', biology), 'english-language': forExam('jamb', english) },
  WAEC: { mathematics: ssceMathematics('waec'), biology: forExam('waec', biology), 'english-language': forExam('waec', english) },
  NECO: { mathematics: ssceMathematics('neco'), biology: forExam('neco', biology), 'english-language': forExam('neco', english) },
};
