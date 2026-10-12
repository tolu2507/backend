export type Q = { id: string; prompt: string; options: { id: string; label: string }[]; answerId: string };

/** q('2 + 2?', ['3', '4', '5', '6'], 1) → question with the 2nd option correct. */
export function q(prompt: string, options: [string, string, string, string], correct: 0 | 1 | 2 | 3): Omit<Q, 'id'> {
  return { prompt, options: options.map((label, i) => ({ id: 'abcd'[i], label })), answerId: 'abcd'[correct] };
}

export const numbered = (qs: Omit<Q, 'id'>[]): Q[] => qs.map((x, i) => ({ id: `q${i + 1}`, ...x }));
