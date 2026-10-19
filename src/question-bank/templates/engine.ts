/**
 * Question templates: a question pattern whose numbers change every time, with the answer worked out
 * by code (so it's always right) and wrong options built from the mistakes students really make.
 * Text uses Markdown with $…$ for maths, like every other question in the bank.
 */

export type Rng = {
  /** Whole number from lo to hi, both included. */
  int(lo: number, hi: number): number;
  pick<T>(xs: readonly T[]): T;
  chance(p: number): boolean;
  shuffle<T>(xs: readonly T[]): T[];
};

/** What a template makes. Return null to throw the numbers away and try again. */
export type Made = {
  stem: string;
  answer: string;
  /** Wrong options; duplicates and copies of the answer are dropped, and three are needed. */
  wrong: string[];
  explanation: string;
  /** Overrides the template's difficulty for harder variations (more steps, bigger numbers). */
  difficulty?: number;
} | null;

export type Template = {
  /** Stable id, never reused: generated questions point back to it. */
  key: string;
  /** [topic, subtopic] exactly as named in the subject's syllabus. */
  topic: [string, string];
  difficulty: 1 | 2 | 3 | 4 | 5;
  make: (r: Rng) => Made;
  /** How many different questions it can make, when that's naturally small (default: plenty). */
  variety?: number;
};

export type Instance = {
  stem: string;
  options: { id: string; label: string }[];
  answerId: string;
  explanation: string;
  difficulty: number;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The same key and seed always give the same numbers, so generating again never makes duplicates. */
export function rng(key: string, seed: number): Rng {
  const next = mulberry32(hash(`${key}#${seed}`));
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  return {
    int,
    pick: (xs) => xs[int(0, xs.length - 1)],
    chance: (p) => next() < p,
    shuffle: (xs) => {
      const a = [...xs];
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(0, i);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

/** One question from a template, or null if these numbers didn't work out (the caller tries the next seed). */
export function instance(t: Template, seed: number): Instance | null {
  const r = rng(t.key, seed);
  const made = t.make(r);
  if (!made) return null;
  const answer = made.answer.trim();
  const seen = new Set([norm(answer)]);
  const wrong: string[] = [];
  for (const w of made.wrong.map((x) => x.trim())) {
    if (!w || seen.has(norm(w))) continue;
    seen.add(norm(w));
    wrong.push(w);
  }
  if (wrong.length < 3) return null;
  const labels = r.shuffle([answer, ...wrong.slice(0, 3)]);
  const options = labels.map((label, i) => ({ id: 'abcd'[i], label }));
  return {
    stem: made.stem,
    options,
    answerId: options[labels.indexOf(answer)].id,
    explanation: made.explanation,
    difficulty: made.difficulty ?? t.difficulty,
  };
}

/** Options that look different but mean the same count as duplicates ("$4$" and "4", "x=2" and "x = 2"). */
const norm = (s: string) => s.replace(/\$/g, '').replace(/\s+/g, '').replace(/\\,/g, '').toLowerCase();

// ── Numbers ───────────────────────────────────────────────────

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b);
export const isInt = (x: number) => Number.isFinite(x) && Math.abs(x - Math.round(x)) < 1e-9;
export const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
export const nCr = (n: number, k: number) => (k < 0 || k > n ? 0 : Math.round(factorial(n) / (factorial(k) * factorial(n - k))));
export const nPr = (n: number, k: number) => Math.round(factorial(n) / factorial(n - k));

/** 16200 → "16,200"; 2.5 → "2.5"; rounds away floating-point noise. Groups from 5 digits (money: from 4). */
export function num(x: number, dp?: number, groupFrom = 5) {
  const v = dp == null ? Math.round(x * 1e9) / 1e9 : Number(x.toFixed(dp));
  const [whole, frac] = (dp == null ? String(Math.abs(v)) : Math.abs(v).toFixed(dp)).split('.');
  const grouped = whole.length >= groupFrom ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole;
  return `${v < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/** Inside maths, a comma needs braces or KaTeX adds space after it. */
export const tnum = (x: number, dp?: number) => num(x, dp).replace(/,/g, '{,}');
export const naira = (x: number) => `₦${num(x, undefined, 4)}`;
export const tnaira = (x: number) => `₦${num(x, undefined, 4).replace(/,/g, '{,}')}`;

/** Exact fractions, so answers like 5/16 stay exact. */
export class Frac {
  readonly n: number;
  readonly d: number;
  constructor(n: number, d = 1) {
    if (d === 0) throw new Error('Division by zero');
    const g = gcd(n, d) || 1;
    const s = d < 0 ? -1 : 1;
    this.n = (s * n) / g;
    this.d = (s * d) / g;
  }
  static of = (x: number | Frac) => (x instanceof Frac ? x : new Frac(x));
  add = (o: number | Frac) => {
    const b = Frac.of(o);
    return new Frac(this.n * b.d + b.n * this.d, this.d * b.d);
  };
  sub = (o: number | Frac) => this.add(Frac.of(o).neg());
  mul = (o: number | Frac) => {
    const b = Frac.of(o);
    return new Frac(this.n * b.n, this.d * b.d);
  };
  div = (o: number | Frac) => {
    const b = Frac.of(o);
    return new Frac(this.n * b.d, this.d * b.n);
  };
  neg = () => new Frac(-this.n, this.d);
  get value() {
    return this.n / this.d;
  }
  get isInt() {
    return this.d === 1;
  }
  equals = (o: number | Frac) => {
    const b = Frac.of(o);
    return this.n === b.n && this.d === b.d;
  };
  /** LaTeX without dollars: "\frac{3}{4}", "-\frac{3}{4}", "2". */
  tex(): string {
    if (this.d === 1) return String(this.n);
    return `${this.n < 0 ? '-' : ''}\\frac{${Math.abs(this.n)}}{${this.d}}`;
  }
  /** Mixed number for improper fractions: "3\frac{1}{2}". */
  mixed(): string {
    if (this.d === 1 || Math.abs(this.n) < this.d) return this.tex();
    const whole = Math.trunc(this.n / this.d);
    const rest = Math.abs(this.n % this.d);
    return `${whole}\\tfrac{${rest}}{${this.d}}`;
  }
}

export const frac = (n: number, d = 1) => new Frac(n, d).tex();

/** Wraps LaTeX in dollars for use in an option or the stem. Thousands commas get braces so KaTeX doesn't space them. */
export const m = (tex: string | number) => `$${String(tex).replace(/(\d),(?=\d{3}(?!\d))/g, '$1{,}')}$`;

/**
 * A polynomial from its coefficients, highest power first: [4, -8, 5, 3] → "4x^3 - 8x^2 + 5x + 3".
 * Zero terms are left out; a coefficient of 1 is written as just "x".
 */
export function poly(coeffs: (number | Frac)[], v = 'x'): string {
  const deg = coeffs.length - 1;
  const parts: string[] = [];
  coeffs.forEach((c0, i) => {
    const c = Frac.of(c0);
    if (c.n === 0) return;
    const p = deg - i;
    const neg = c.n < 0;
    const abs = new Frac(Math.abs(c.n), c.d);
    const coef = p > 0 && abs.n === 1 && abs.d === 1 ? '' : abs.tex();
    const term = p === 0 ? abs.tex() : `${coef}${v}${p > 1 ? `^${p}` : ''}`;
    parts.push(parts.length ? `${neg ? ' - ' : ' + '}${term}` : `${neg ? '-' : ''}${term}`);
  });
  return parts.join('') || '0';
}

/** "+ 3" or "- 3" for building expressions: `x ${signed(-3)}` → "x - 3". */
export const signed = (n: number) => (n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`);

/** a√b in simplest form, as LaTeX. */
export function surd(coef: number, radicand: number): string {
  let c = coef;
  let r = radicand;
  for (let k = Math.floor(Math.sqrt(r)); k > 1; k--) {
    if (r % (k * k) === 0) {
      c *= k;
      r /= k * k;
      break;
    }
  }
  if (r === 1) return String(c);
  if (c === 0) return '0';
  return `${c === 1 ? '' : c === -1 ? '-' : c}\\sqrt{${r}}`;
}

/** Degrees to the 3-figure bearing format: 56 → "056°". */
export const bearing = (deg: number) => `${String(((Math.round(deg) % 360) + 360) % 360).padStart(3, '0')}^\\circ`;

export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;

/** Written-out numbers for small counts and bases ("base six"). */
export const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** Nigerian names and places, so questions feel local. */
export const NAMES = ['Ada', 'Chidi', 'Tunde', 'Ngozi', 'Bola', 'Emeka', 'Aisha', 'Musa', 'Funke', 'Ifeanyi', 'Zainab', 'Kemi', 'Obinna', 'Halima', 'Segun', 'Amaka', 'Yusuf', 'Bisi', 'Uche', 'Femi'];
export const TOWNS = ['Lagos', 'Kano', 'Ibadan', 'Enugu', 'Abuja', 'Kaduna', 'Onitsha', 'Benin', 'Jos', 'Owerri', 'Abeokuta', 'Calabar', 'Ilorin', 'Warri', 'Aba', 'Akure', 'Sokoto', 'Uyo'];

/**
 * The same templates for another exam. Keys get the exam's prefix ("waec-maths/…"), so each exam
 * draws its own numbers and a student preparing for two exams never meets the same question.
 * `topic` re-files a template under that exam's syllabus, or drops it (null) when the exam doesn't test it.
 */
export function forExam(exam: string, list: Template[], topic?: (t: Template) => Template['topic'] | null): Template[] {
  return list.flatMap((t) => {
    const tp = topic ? topic(t) : t.topic;
    return tp ? [{ ...t, key: `${exam}-${t.key.replace(/^jamb-/, '')}`, topic: tp }] : [];
  });
}

/** Values from the other rows of a fact table, for wrong options (the engine drops repeats). */
export const otherValues = <T>(r: Rng, rows: readonly T[], row: T, get: (x: T) => string) => r.shuffle(rows.filter((x) => get(x) !== get(row)).map(get));

/** A hand-written question: for facts that don't vary, written once and checked. */
export type Item = { stem: string; answer: string; wrong: string[]; explanation: string };

/** A template made of hand-written questions; options are shuffled each time. */
export const itemSet = (key: string, topic: Template['topic'], difficulty: Template['difficulty'], list: Item[]): Template => ({ key, topic, difficulty, variety: list.length, make: (r) => r.pick(list) });

/**
 * A two-column fact table, asked both ways ("What does X do?" / "Which one does Y?").
 * A value shared by several rows is only asked forwards, so there's never more than one right answer.
 */
export function factPairs(
  key: string,
  topic: Template['topic'],
  difficulty: Template['difficulty'],
  rows: [string, string][],
  ask: { forward: (a: string) => string; backward?: (b: string) => string; why: (a: string, b: string) => string },
): Template {
  return {
    key,
    topic,
    difficulty,
    variety: rows.length * (ask.backward ? 2 : 1),
    make: (r) => {
      const row = r.pick(rows);
      const [a, b] = row;
      if (ask.backward && r.chance(0.5) && rows.filter((x) => x[1] === b).length === 1) {
        return { stem: ask.backward(b), answer: a, wrong: otherValues(r, rows, row, (x) => x[0]), explanation: ask.why(a, b) };
      }
      return { stem: ask.forward(a), answer: b, wrong: otherValues(r, rows, row, (x) => x[1]), explanation: ask.why(a, b) };
    },
  };
}
