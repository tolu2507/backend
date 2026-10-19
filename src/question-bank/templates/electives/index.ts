import type { ExamBody } from '@prisma/client';

import { business, creativeArts, french } from '../bece/practical.js';
import type { Template } from '../engine.js';
import { accounting } from '../senior/accounts-geography.js';
import { agriculture } from '../senior/agric-religion.js';
import { commerce } from '../senior/government-commerce.js';
import { artSenior, frenchSenior, musicSenior, physicalEducation } from './arts.js';
import { catering, clothing, foodCore } from './home.js';
import { computerStudies, dataProcessing, technicalDrawing } from './technology.js';
import { animalHusbandry, fisheries, insurance, marketing, officePractice } from './vocational.js';

const only = (list: Template[], ...keys: string[]) => list.filter((t) => keys.includes(t.key));

/** Senior electives: which exams set each one, and its templates (exam prefixes are added in ../index.ts). */
export const ELECTIVES: Record<string, { exams: ExamBody[]; templates: Template[] }> = {
  'computer-studies': { exams: ['JAMB', 'WAEC', 'NECO'], templates: computerStudies },
  'data-processing': { exams: ['WAEC', 'NECO'], templates: [...dataProcessing, ...computerStudies] },
  'technical-drawing': { exams: ['WAEC', 'NECO'], templates: technicalDrawing },
  'home-economics': { exams: ['JAMB', 'WAEC', 'NECO'], templates: [...foodCore, ...clothing] },
  'foods-and-nutrition': { exams: ['WAEC', 'NECO'], templates: foodCore },
  'catering-craft-practice': { exams: ['WAEC', 'NECO'], templates: [...foodCore, ...catering] },
  'clothing-and-textiles': { exams: ['WAEC'], templates: clothing },
  music: { exams: ['JAMB', 'WAEC', 'NECO'], templates: [...only(creativeArts, 'cca/note-values', 'cca/instruments'), ...musicSenior] },
  art: { exams: ['JAMB'], templates: [...only(creativeArts, 'cca/colour', 'cca/tools-crafts'), ...artSenior] },
  'visual-art': { exams: ['WAEC', 'NECO'], templates: [...only(creativeArts, 'cca/colour', 'cca/tools-crafts'), ...artSenior] },
  french: { exams: ['JAMB', 'WAEC', 'NECO'], templates: [...french, ...frenchSenior] },
  'physical-education': { exams: ['WAEC', 'NECO'], templates: physicalEducation },
  'physical-health-education': { exams: ['JAMB'], templates: physicalEducation },
  'animal-husbandry': { exams: ['WAEC', 'NECO'], templates: [...animalHusbandry, ...only(agriculture, 'agric/animal-diseases', 'agric/breeds', 'agric/gestation')] },
  fisheries: { exams: ['WAEC'], templates: fisheries },
  insurance: { exams: ['WAEC'], templates: [...insurance, ...only(commerce, 'commerce/insurance')] },
  marketing: { exams: ['WAEC'], templates: marketing },
  'office-practice': { exams: ['WAEC'], templates: [...officePractice, ...only(business, 'business/office-equipment', 'business/keyboarding', 'business/documents')] },
  bookkeeping: { exams: ['WAEC'], templates: [...accounting, ...only(business, 'business/documents')] },
};
