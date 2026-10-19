import { forExam, m, NAMES, type Template } from './engine.js';
import { jambMathematics } from './jamb-mathematics/index.js';

/**
 * WAEC and NECO General Mathematics: the JAMB templates refiled under the SSCE syllabus, plus the
 * SSCE-only topics. Templates for topics the SSCE core paper doesn't set (calculus, binary operations,
 * remainder theorem, permutations, matrices) are left out rather than guessed.
 */

const NN = 'Number and Numeration';
const ALG = 'Algebraic Processes';
const MENS = 'Mensuration';
const GEO = 'Plane Geometry';
const COORD = 'Coordinate Geometry';
const TRIG = 'Trigonometry';
const STATS = 'Statistics and Probability';

const SSCE_TOPIC: Record<string, [string, string]> = {
  'lcm-div-hcf': [NN, 'Fractions, decimals and approximations'],
  'fraction-of-remainder': [NN, 'Fractions, decimals and approximations'],
  'significant-figures': [NN, 'Fractions, decimals and approximations'],
  'decimal-places': [NN, 'Fractions, decimals and approximations'],
  'depreciation-appreciation': [NN, 'Percentages and financial arithmetic'],
  'marked-price': [NN, 'Percentages and financial arithmetic'],
  'express-as-percentage': [NN, 'Percentages and financial arithmetic'],
  'profit-loss-percent': [NN, 'Percentages and financial arithmetic'],
  'simple-interest-two-amounts': [NN, 'Percentages and financial arithmetic'],
  'share-in-ratio': [NN, 'Ratio, proportion and rates'],
  'speed-conversion': [NN, 'Ratio, proportion and rates'],
  'evaluate-indices': [NN, 'Indices and logarithms'],
  'exponential-equation': [NN, 'Indices and logarithms'],
  'evaluate-logs': [NN, 'Indices and logarithms'],
  'log-laws': [NN, 'Indices and logarithms'],
  'simplify-surds': [NN, 'Surds'],
  'rationalise-surds': [NN, 'Surds'],
  variation: [NN, 'Variation'],
  'joint-variation': [NN, 'Variation'],
  'arithmetic-progression': [NN, 'Sequences and series'],
  'geometric-progression': [NN, 'Sequences and series'],
  'venn-two-sets': [NN, 'Sets'],
  'set-operations': [NN, 'Sets'],
  'number-bases': [NN, 'Number bases'],
  'solve-quadratic': [ALG, 'Quadratic equations'],
  'sum-product-of-roots': [ALG, 'Quadratic equations'],
  'change-of-subject': [ALG, 'Algebraic expressions and change of subject'],
  'expand-products': [ALG, 'Algebraic expressions and change of subject'],
  'linear-inequality': [ALG, 'Linear inequalities'],
  'polygon-angles': [GEO, 'Angles and polygons'],
  'triangle-angles': [GEO, 'Angles and polygons'],
  'circle-theorems': [GEO, 'Circle theorems'],
  'special-angles': [TRIG, 'Trigonometric ratios'],
  'trig-quadrants': [TRIG, 'Trigonometric ratios'],
  'complementary-angles': [TRIG, 'Trigonometric ratios'],
  'angle-of-elevation': [TRIG, 'Angles of elevation and depression'],
  'bearings-distance': [TRIG, 'Bearings'],
  'cylinder-depth': [MENS, 'Volumes and surface areas'],
  'cuboid-surface-area': [MENS, 'Volumes and surface areas'],
  'cone-volume': [MENS, 'Volumes and surface areas'],
  'sector-perimeter': [MENS, 'Lengths and perimeters'],
  'laps-of-track': [MENS, 'Lengths and perimeters'],
  'equilateral-area': [MENS, 'Areas'],
  'distance-midpoint': [COORD, 'Straight lines'],
  gradient: [COORD, 'Straight lines'],
  'parallel-perpendicular-lines': [COORD, 'Straight lines'],
  'frequency-table-average': [STATS, 'Mean, median and mode'],
  'range-and-mean-deviation': [STATS, 'Measures of dispersion'],
  variance: [STATS, 'Measures of dispersion'],
  'pie-chart-angle': [STATS, 'Data presentation'],
  'coin-and-die': [STATS, 'Probability'],
  'balls-from-a-bag': [STATS, 'Probability'],
  'two-dice': [STATS, 'Probability'],
};

const mod = (a: number, n: number) => ((a % n) + n) % n;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const modular: Template[] = [
  {
    key: 'maths/modular-arithmetic',
    topic: [NN, 'Modular arithmetic'],
    difficulty: 2,
    make: (r) => {
      const n = r.pick([4, 5, 6, 7, 8, 9, 11]);
      const kind = r.pick(['reduce', 'operate', 'solve'] as const);
      if (kind === 'reduce') {
        const a = r.int(n + 2, 200);
        const ans = mod(a, n);
        return {
          stem: `Evaluate ${m(`${a}\\;(\\text{mod}\\;${n})`)}.`,
          answer: String(ans),
          wrong: [mod(ans + 1, n), mod(ans - 1, n), Math.floor(a / n), mod(ans + 2, n)].map(String),
          explanation: `${a} = ${n} × ${Math.floor(a / n)} + ${ans}, so the remainder is ${ans}: ${m(`${a} \\equiv ${ans}\\;(\\text{mod}\\;${n})`)}.`,
        };
      }
      if (kind === 'operate') {
        const a = r.int(2, 40);
        const b = r.int(2, 40);
        const op = r.pick(['+', '×', '−'] as const);
        const raw = op === '+' ? a + b : op === '×' ? a * b : a - b;
        const ans = mod(raw, n);
        const tex = op === '×' ? '\\times' : op === '−' ? '-' : '+';
        return {
          stem: `Simplify ${m(`${a} ${tex} ${b}\\;(\\text{mod}\\;${n})`)}.`,
          answer: String(ans),
          wrong: [mod(ans + 1, n), mod(ans + n - 1, n), Math.abs(raw) % 10, mod(ans + 2, n)].map(String),
          explanation: `${m(`${a} ${tex} ${b} = ${raw}`)}, and ${raw} ${raw < 0 ? `+ ${n * Math.ceil(-raw / n)} = ${mod(raw, n)}` : `= ${n} × ${Math.floor(raw / n)} + ${ans}`}.\nSo the answer is ${ans} (mod ${n}).`,
        };
      }
      if (r.chance(0.4)) {
        const day = r.int(0, 6);
        const later = r.int(10, 400);
        const ans = DAYS[mod(day + later, 7)];
        const who = r.pick(NAMES);
        return {
          stem: `${who}'s birthday is on a ${DAYS[day]}. What day of the week will it be ${later} days later?`,
          answer: ans,
          wrong: [DAYS[mod(day + later + 1, 7)], DAYS[mod(day + later - 1, 7)], DAYS[mod(day + later + 3, 7)]],
          explanation: `Days repeat every 7, so work in mod 7: ${m(`${later} = 7 \\times ${Math.floor(later / 7)} + ${later % 7}`)}.\n${later % 7} day${later % 7 === 1 ? '' : 's'} after ${DAYS[day]} is ${ans}.`,
          difficulty: 3,
        };
      }
      const a = r.int(1, n - 1);
      const b = r.int(0, n - 1);
      const x = mod(b - a, n);
      return {
        stem: `Solve ${m(`x + ${a} \\equiv ${b}\\;(\\text{mod}\\;${n})`)}.`,
        answer: m(`x = ${x}`),
        wrong: [mod(b + a, n), mod(x + 1, n), b, a].filter((w) => w !== x).map((w) => m(`x = ${w}`)),
        explanation: `Subtract ${a} from both sides: ${m(`x \\equiv ${b} - ${a} = ${b - a} \\equiv ${x}\\;(\\text{mod}\\;${n})`)}.\nCheck: ${x} + ${a} = ${x + a}, which leaves remainder ${b} when divided by ${n}.`,
        difficulty: 3,
      };
    },
  },
];

const shortKey = (t: Template) => t.key.replace(/^jamb-maths\//, '');

/** General Mathematics templates for one SSCE exam ("waec" or "neco"). */
export function ssceMathematics(exam: 'waec' | 'neco'): Template[] {
  const refiled = jambMathematics.flatMap((t) => (SSCE_TOPIC[shortKey(t)] ? [{ ...t, key: `${exam}-maths/${shortKey(t)}`, topic: SSCE_TOPIC[shortKey(t)] }] : []));
  return [...refiled, ...forExam(exam, modular)];
}
