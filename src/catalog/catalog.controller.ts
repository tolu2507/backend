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
      // Nursery has no subject list (nothing for tutors to pick), but parents can add nursery children.
      // University students sign up themselves, so parents never see that level.
      levels: (Object.keys(GRADES) as (keyof typeof GRADES)[]).filter((level): level is Exclude<typeof level, 'TERTIARY'> => level !== 'TERTIARY').map((level) => ({
        level,
        label: LEVEL_LABEL[level],
        grades: GRADES[level],
        subjects: level === 'NURSERY' ? [] : SUBJECTS[level],
      })),
      exams: EXAMS,
    };
  }
}
