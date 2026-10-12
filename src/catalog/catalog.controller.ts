import { Controller, Get } from '@nestjs/common';

import { Public } from '../common/auth.js';
import { EXAMS, GRADES, LEVEL_LABEL, SUBJECTS } from './catalog.js';

@Controller('catalog')
export class CatalogController {
  /** Everything the apps need to build pickers: levels, grades, subjects, exams. */
  @Public()
  @Get()
  get() {
    return {
      levels: (Object.keys(SUBJECTS) as (keyof typeof SUBJECTS)[]).map((level) => ({
        level,
        label: LEVEL_LABEL[level],
        grades: GRADES[level],
        subjects: SUBJECTS[level],
      })),
      exams: EXAMS,
    };
  }
}
