import katex from 'katex';

import { instance, type Template } from './engine.js';
import { TEMPLATES } from './index.js';

const SEEDS = 400;
const all: Template[] = Object.values(TEMPLATES).flatMap((bySubject) => Object.values(bySubject ?? {}).flat());

/** Every $…$ in a string must compile in KaTeX, which is what students' screens are tested against. */
function checkMaths(text: string) {
  for (const [, tex] of text.matchAll(/(?<!\\)\$([^$]+?)(?<!\\)\$/g)) katex.renderToString(tex, { throwOnError: true, strict: 'ignore' });
  expect((text.match(/(?<!\\)\$/g) ?? []).length % 2).toBe(0);
}

describe('question templates', () => {
  it('keys are unique', () => {
    const keys = all.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  describe.each(all.map((t) => [t.key, t] as const))('%s', (_key, t) => {
    const made = Array.from({ length: SEEDS }, (_, i) => instance(t, i)).filter((x) => x !== null);

    it('works for most numbers it picks', () => {
      expect(made.length / SEEDS).toBeGreaterThan(0.25);
    });

    it('gives many different questions', () => {
      expect(new Set(made.map((q) => q.stem + q.options.map((o) => o.label).join('|'))).size).toBeGreaterThanOrEqual(Math.min(t.variety ?? 30, made.length));
    });

    it('always has four different options with the answer among them', () => {
      for (const q of made) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options.map((o) => o.label)).size).toBe(4);
        expect(q.options.map((o) => o.id)).toContain(q.answerId);
        expect(q.difficulty).toBeGreaterThanOrEqual(1);
        expect(q.difficulty).toBeLessThanOrEqual(5);
      }
    });

    it('never shows broken numbers or bad maths', () => {
      for (const q of made) {
        const text = [q.stem, q.explanation, ...q.options.map((o) => o.label)].join('\n');
        expect(text).not.toMatch(/NaN|Infinity|undefined|null|\[object/);
        expect(text).not.toMatch(/\.\d*([1-9])\1{5,}|\.\d*0{6,}[1-9]/); // floating-point noise like 0.30000000000000004 or 38.333333333
        expect(text).not.toMatch(/\+ -|- -|\+-/); // "x + -3"
        for (const part of [q.stem, q.explanation, ...q.options.map((o) => o.label)]) checkMaths(part);
      }
    });
  });
});
