import { describe, expect, it } from 'vitest';

import { ACTIVITIES } from '../../prisma/content/activities.js';
import { VETTING_TESTS } from '../../prisma/content/vetting.js';
import { SUBJECTS } from './catalog.js';

describe('catalog content', () => {
  it('has a tutor vetting test for every subject a tutor can pick', () => {
    const missing = Object.entries(SUBJECTS).flatMap(([level, subjects]) =>
      subjects.filter((s) => !VETTING_TESTS.some((t) => t.subject === s && t.level === level)).map((s) => `${s} (${level})`),
    );
    expect(missing).toEqual([]);
  });

  it('has valid answers in every question', () => {
    for (const set of [...VETTING_TESTS, ...ACTIVITIES]) {
      for (const q of set.questions) {
        expect(q.options.map((o) => o.id)).toContain(q.answerId);
        expect(new Set(q.options.map((o) => o.label)).size).toBe(q.options.length);
      }
    }
  });
});
