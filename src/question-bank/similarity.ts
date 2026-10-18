/** Words that carry meaning (3+ letters or any number), lower-cased. */
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{3,}|\d+(?:\.\d+)?/g) ?? []);

/** Share of words two questions have in common (Jaccard), 0–1. */
export function overlap(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  return common / (x.size + y.size - common);
}

/** True when `stem` is a near-copy of any of `others`: same wording, maybe with a few words swapped. */
export const tooSimilar = (stem: string, others: string[], threshold = 0.6) => others.some((o) => overlap(stem, o) >= threshold);
