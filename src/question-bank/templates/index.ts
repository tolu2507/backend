import type { ExamBody } from '@prisma/client';

import type { Template } from './engine.js';
import { jambMathematics } from './jamb-mathematics/index.js';
import { jambPhysics } from './jamb-physics/index.js';

/** Templates by exam and subject slug. */
export const TEMPLATES: Partial<Record<ExamBody, Record<string, Template[]>>> = {
  JAMB: { mathematics: jambMathematics, physics: jambPhysics },
};
