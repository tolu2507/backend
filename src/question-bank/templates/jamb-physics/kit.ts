import { m, num } from '../engine.js';

/** JAMB's usual value for g. */
export const G = 10;

/** x rounded to n significant figures. */
export const sig = (x: number, n = 3) => Number(x.toPrecision(n));

/** A number as LaTeX: plain for everyday sizes, standard form (3.2 × 10⁻⁴) for very big or very small ones. */
export function sci(x: number, n = 3): string {
  if (x === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -3 && e < 6) return num(sig(x, n)).replace(/,/g, '{,}');
  let mant = sig(x / 10 ** e, n);
  if (Math.abs(mant) >= 10) {
    mant = sig(mant / 10, n);
    e += 1;
  }
  return `${num(mant)} \\times 10^{${e}}`;
}

/** Units as LaTeX, upright the way physics writes them. */
export const U = {
  m: '\\text{m}',
  cm: '\\text{cm}',
  mm: '\\text{mm}',
  km: '\\text{km}',
  s: '\\text{s}',
  kg: '\\text{kg}',
  g: '\\text{g}',
  N: '\\text{N}',
  J: '\\text{J}',
  W: '\\text{W}',
  Pa: '\\text{N m}^{-2}',
  ms: '\\text{m s}^{-1}',
  ms2: '\\text{m s}^{-2}',
  Ns: '\\text{N s}',
  Nm: '\\text{N m}^{-1}',
  rads: '\\text{rad s}^{-1}',
  Hz: '\\text{Hz}',
  kgm3: '\\text{kg m}^{-3}',
  C: '^\\circ\\text{C}',
  K: '\\text{K}',
  deg: '^\\circ',
  JkgK: '\\text{J kg}^{-1}\\,\\text{K}^{-1}',
  Jkg: '\\text{J kg}^{-1}',
  perK: '\\text{K}^{-1}',
  A: '\\text{A}',
  V: '\\text{V}',
  ohm: '\\Omega',
  F: '\\text{F}',
  uF: '\\mu\\text{F}',
  coul: '\\text{C}',
  T: '\\text{T}',
  Vm: '\\text{V m}^{-1}',
  eV: '\\text{eV}',
  Bq: '\\text{Bq}',
  D: '\\text{D}',
  perm: '\\text{m}^{-1}',
  pct: '\\%',
  none: '',
};

/** A quantity with its unit, as maths: qty(12, U.ms) → "$12\,\text{m s}^{-1}$". Degrees and % sit right against the number. */
export const qty = (x: number, unit: string, n = 3) => m(`${sci(x, n)}${unit && !unit.startsWith('^') && unit !== U.pct ? `\\,${unit}` : unit}`);

/** Same, to a fixed number of decimal places (instrument readings: 5.73 mm, not 5.7). */
export const qtyDp = (x: number, unit: string, dp: number) => m(`${num(x, dp)}${unit ? `\\,${unit}` : ''}`);

/** The answer and wrong options in one unit. Wrong values that aren't real numbers are dropped, and so are negative ones when the answer is positive (a negative volume gives itself away). */
export const choices = (unit: string, answer: number, wrong: number[], n = 3) => ({
  answer: qty(answer, unit, n),
  wrong: wrong.filter((w) => Number.isFinite(w) && (answer <= 0 || w > 0)).map((w) => qty(w, unit, n)),
});

/** "a" or "an" before a number as it's read aloud: an 8 Ω resistor, an 11,000 V line, a 100 W lamp. */
export const an = (x: number) => (/^(8|11|18)(\D|$)|^(11|18)\d{3}(\D|$)/.test(String(x)) ? 'an' : 'a');

/** sin of whole degrees, cleaned of floating-point noise. */
export const sinD = (d: number) => sig(Math.sin((d * Math.PI) / 180), 12);
export const cosD = (d: number) => sig(Math.cos((d * Math.PI) / 180), 12);
export const tanD = (d: number) => sig(Math.tan((d * Math.PI) / 180), 12);
export const asinD = (x: number) => (Math.asin(x) * 180) / Math.PI;
