import { forExam, Frac, gcd, lcm, m, NAMES, naira, num, type Template } from './engine.js';
import { jambMathematics } from './jamb-mathematics/index.js';

/**
 * Mathematics for BECE (JSS3) and Common Entrance (primary 6). New templates pitched at those levels,
 * plus the JAMB templates simple enough for BECE, refiled under the BECE syllabus.
 */

// BECE syllabus
const B_NUM = 'Number and Numeration';
const B_ALG = 'Algebraic Processes';
const B_GEO = 'Geometry and Mensuration';
const B_STAT = 'Everyday Statistics';
// Common Entrance syllabus
const C_NUM = 'Number';
const C_OPS = 'Operations';
const C_MEAS = 'Measurement';
const C_STAT = 'Everyday Statistics';

const BECE_FROM_JAMB: Record<string, [string, string]> = {
  'number-bases': [B_NUM, 'Number bases'],
  'lcm-div-hcf': [B_NUM, 'Whole numbers and place value'],
  'fraction-of-remainder': [B_NUM, 'Fractions, decimals and percentages'],
  'significant-figures': [B_NUM, 'Approximation'],
  'decimal-places': [B_NUM, 'Approximation'],
  'marked-price': [B_NUM, 'Commercial arithmetic'],
  'express-as-percentage': [B_NUM, 'Fractions, decimals and percentages'],
  'profit-loss-percent': [B_NUM, 'Commercial arithmetic'],
  'simple-interest-two-amounts': [B_NUM, 'Commercial arithmetic'],
  'share-in-ratio': [B_NUM, 'Ratio, proportion and rates'],
  'speed-conversion': [B_NUM, 'Ratio, proportion and rates'],
  'venn-two-sets': [B_NUM, 'Sets'],
  'set-operations': [B_NUM, 'Sets'],
  'linear-inequality': [B_ALG, 'Linear inequalities'],
  'polygon-angles': [B_GEO, 'Angles and polygons'],
  'triangle-angles': [B_GEO, 'Angles and polygons'],
  'cuboid-surface-area': [B_GEO, 'Volume'],
  'cylinder-depth': [B_GEO, 'Volume'],
  'frequency-table-average': [B_STAT, 'Mean, median and mode'],
  'pie-chart-angle': [B_STAT, 'Data presentation'],
  'coin-and-die': [B_STAT, 'Probability'],
  'balls-from-a-bag': [B_STAT, 'Probability'],
};

const tex = (f: Frac) => f.mixed();
const ROMAN: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];
const roman = (n: number) => {
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) (out += s), (n -= v);
  return out;
};
/** "1994" → "1000 = M, 900 = CM, 90 = XC, 4 = IV" */
const romanParts = (n: number) =>
  String(n)
    .split('')
    .map((d, i, all) => Number(d) * 10 ** (all.length - 1 - i))
    .filter((v) => v > 0)
    .map((v) => `${v} = ${roman(v)}`)
    .join(', ');
const UNIT_WORD: Record<string, string> = { km: 'kilometres', m: 'metres', cm: 'centimetres', mm: 'millimetres', kg: 'kilograms', g: 'grams', litres: 'litres', ml: 'millilitres' };
const isPrime = (n: number) => n > 1 && Array.from({ length: Math.floor(Math.sqrt(n)) - 1 }, (_, i) => i + 2).every((d) => n % d !== 0);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Templates both levels use; each picks its own topic. */
const shared = (level: 'bece' | 'ce'): Template[] => {
  const T = (bece: [string, string], ce: [string, string]) => (level === 'bece' ? bece : ce);
  return [
    {
      key: 'jmaths/fraction-operations',
      topic: T([B_NUM, 'Fractions, decimals and percentages'], [C_NUM, 'Fractions']),
      difficulty: 2,
      make: (r) => {
        const d1 = r.pick([2, 3, 4, 5, 6, 8]);
        const d2 = r.pick([2, 3, 4, 5, 6, 8, 10]);
        const a = new Frac(r.int(1, d1 - 1) + (level === 'bece' ? r.int(0, 2) * d1 : 0), d1);
        const b = new Frac(r.int(1, d2 - 1), d2);
        const op = r.pick(level === 'bece' ? ['+', '-', '×', '÷'] : ['+', '-', '×']);
        if (op === '-' && a.value <= b.value) return null;
        const ans = op === '+' ? a.add(b) : op === '-' ? a.sub(b) : op === '×' ? a.mul(b) : a.div(b);
        const texOp = { '+': '+', '-': '-', '×': '\\times', '÷': '\\div' }[op];
        const naive = new Frac(op === '+' ? a.n + b.n : op === '-' ? Math.abs(a.n - b.n) : a.n * b.n, op === '+' || op === '-' ? a.d + b.d : a.d * b.d);
        const flip = op === '÷' ? a.mul(b) : op === '×' ? a.div(b) : op === '+' ? a.sub(b) : a.add(b);
        return {
          stem: `Simplify ${m(`${tex(a)} ${texOp} ${tex(b)}`)}.`,
          answer: m(tex(ans)),
          wrong: [naive, flip, ans.add(new Frac(1, ans.d * 2 > 12 ? ans.d : ans.d * 2)), ans.mul(2)].filter((x) => x.n > 0).map((x) => m(tex(x))),
          explanation:
            op === '+' || op === '-'
              ? `Use a common denominator, ${lcm(a.d, b.d)}: ${m(`\\frac{${a.n * (lcm(a.d, b.d) / a.d)}}{${lcm(a.d, b.d)}} ${op} \\frac{${b.n * (lcm(a.d, b.d) / b.d)}}{${lcm(a.d, b.d)}} = ${tex(ans)}`)}.`
              : op === '×'
                ? `Multiply the tops and the bottoms, then simplify: ${m(`${tex(a)} \\times ${tex(b)} = ${tex(ans)}`)}.`
                : `Dividing by a fraction is multiplying by its reciprocal: ${m(`${tex(a)} \\times ${new Frac(b.d, b.n).tex()} = ${tex(ans)}`)}.`,
        };
      },
    },
    {
      key: 'jmaths/percentage-of',
      topic: T([B_NUM, 'Fractions, decimals and percentages'], [C_NUM, 'Percentages']),
      difficulty: 1,
      make: (r) => {
        const p = r.pick([5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75]);
        const whole = r.pick([40, 60, 80, 120, 200, 240, 300, 400, 500, 1200, 2000, 5000]);
        const v = (p * whole) / 100;
        if (!Number.isInteger(v * 100)) return null;
        const money = r.chance(0.5);
        const show = (x: number) => (money ? naira(x) : num(x));
        return {
          stem: money ? `A school fee of ${naira(whole)} is reduced by ${p}%. How much is the reduction?` : `What is ${p}% of ${whole}?`,
          answer: show(v),
          wrong: [whole - v, v * 10, v / 2, whole / p].filter((x) => x > 0).map(show),
          explanation: `${m(`\\frac{${p}}{100} \\times ${whole} = ${num(v)}`)}${money ? `, so the fee goes down by ${naira(v)}` : ''}.`,
        };
      },
    },
    {
      key: 'jmaths/area-perimeter',
      topic: T([B_GEO, 'Perimeter and area'], [C_MEAS, 'Perimeter and area']),
      difficulty: 2,
      make: (r) => {
        const shape = r.pick(level === 'bece' ? (['rectangle', 'square', 'triangle', 'circle'] as const) : (['rectangle', 'square', 'triangle'] as const));
        const ask = r.pick(['area', 'perimeter'] as const);
        if (shape === 'circle') {
          const rad = r.pick([7, 14, 21, 3.5, 28]);
          const A = (22 / 7) * rad * rad;
          const C = 2 * (22 / 7) * rad;
          return {
            stem: `Find the ${ask === 'area' ? 'area' : 'circumference'} of a circle of radius ${num(rad)} cm. (Take ${m('\\pi = \\tfrac{22}{7}')}.)`,
            answer: ask === 'area' ? m(`${num(A)}\\,\\text{cm}^2`) : `${num(C)} cm`,
            wrong: ask === 'area' ? [C, (22 / 7) * rad * 2 * rad * 2, A / 2].map((x) => m(`${num(Math.round(x * 100) / 100)}\\,\\text{cm}^2`)) : [A, (22 / 7) * rad, C * 2].map((x) => `${num(Math.round(x * 100) / 100)} cm`),
            explanation: ask === 'area' ? `${m(`A = \\pi r^2 = \\tfrac{22}{7} \\times ${num(rad)}^2 = ${num(A)}`)} cm².` : `${m(`C = 2\\pi r = 2 \\times \\tfrac{22}{7} \\times ${num(rad)} = ${num(C)}`)} cm.`,
            difficulty: 3,
          };
        }
        if (shape === 'triangle') {
          const b = r.int(4, 20);
          const h = r.int(3, 15);
          const A = (b * h) / 2;
          return {
            stem: `A triangle has a base of ${b} cm and a height of ${h} cm. What is its area?`,
            answer: m(`${num(A)}\\,\\text{cm}^2`),
            wrong: [b * h, b + h, 2 * (b + h)].map((x) => m(`${num(x)}\\,\\text{cm}^2`)),
            explanation: `${m(`A = \\tfrac{1}{2} \\times \\text{base} \\times \\text{height} = \\tfrac{1}{2} \\times ${b} \\times ${h} = ${num(A)}`)} cm².`,
          };
        }
        const l = r.int(3, 25);
        const w = shape === 'square' ? l : r.int(2, l - 1);
        if (shape === 'rectangle' && w >= l) return null;
        if (ask === 'area') {
          return {
            stem: shape === 'square' ? `A square has sides of ${l} m. What is its area?` : `A rectangular garden is ${l} m long and ${w} m wide. What is its area?`,
            answer: m(`${l * w}\\,\\text{m}^2`),
            wrong: [2 * (l + w), l + w, l * w * 2].map((x) => m(`${x}\\,\\text{m}^2`)),
            explanation: `Area = length × ${shape === 'square' ? 'length' : 'width'} = ${l} × ${w} = ${l * w} m².`,
          };
        }
        return {
          stem: shape === 'square' ? `A square has sides of ${l} m. What is its perimeter?` : `A rectangular garden is ${l} m long and ${w} m wide. How much fencing goes round it?`,
          answer: `${2 * (l + w)} m`,
          wrong: [l * w, l + w, 4 * l + w].filter((x) => x !== 2 * (l + w)).map((x) => `${x} m`),
          explanation: `Perimeter = ${shape === 'square' ? `4 × ${l}` : `2 × (${l} + ${w})`} = ${2 * (l + w)} m.`,
          difficulty: 1,
        };
      },
    },
    {
      key: 'jmaths/average',
      topic: T([B_STAT, 'Mean, median and mode'], [C_STAT, 'Averages']),
      difficulty: 2,
      make: (r) => {
        const n = r.int(4, 6);
        // Pick the mean first and fit the last number to it, so the answer is a whole number.
        const [lo, hi] = level === 'ce' ? [2, 20] : [10, 90];
        const mean = r.int(lo + 2, hi - 2);
        let xs: number[] = [];
        for (let tries = 0; tries < 20; tries++) {
          const rest = Array.from({ length: n - 1 }, () => r.int(Math.max(lo, mean - 15), Math.min(hi, mean + 15)));
          const last = mean * n - rest.reduce((s, x) => s + x, 0);
          if (last >= lo && last <= hi) {
            xs = r.shuffle([...rest, last]);
            break;
          }
        }
        if (!xs.length) return null;
        const total = mean * n;
        if (r.chance(0.35)) {
          const who = r.pick(NAMES);
          const target = mean + r.int(1, 4);
          const needed = target * (n + 1) - total;
          if (needed <= 0 || needed > 100) return null;
          return {
            stem: `${who}'s scores in ${n} tests are ${xs.join(', ')}. What must ${who} score in the next test to raise the average to ${target}?`,
            answer: String(needed),
            wrong: [target, needed + n, target * n - total, needed - 1].filter((x) => x > 0 && x !== needed).map(String),
            explanation: `To average ${target} over ${n + 1} tests, the total must be ${target} × ${n + 1} = ${target * (n + 1)}.\nThe scores so far add up to ${total}, so the next score must be ${target * (n + 1)} − ${total} = ${needed}.`,
            difficulty: 3,
          };
        }
        return {
          stem: `Find the average (mean) of ${xs.join(', ')}.`,
          answer: num(mean),
          wrong: [total, total / (n - 1), [...xs].sort((a, b) => a - b)[Math.floor(n / 2)], mean + 1].filter((x) => x !== mean).map((x) => num(Math.round(x * 100) / 100)),
          explanation: `Add them: ${xs.join(' + ')} = ${total}. Divide by how many there are (${n}): ${total} ÷ ${n} = ${num(mean)}.`,
        };
      },
    },
    {
      key: 'jmaths/order-of-operations',
      topic: T([B_NUM, 'Whole numbers and place value'], [C_OPS, 'Order of operations']),
      difficulty: 2,
      make: (r) => {
        const [a, b, c, d] = [r.int(2, 20), r.int(2, 12), r.int(2, 9), r.int(1, 10)];
        const form = r.pick([0, 1, 2]);
        const [text, val, naive] =
          form === 0
            ? [`${a} + ${b} \\times ${c}`, a + b * c, (a + b) * c]
            : form === 1
              ? [`${a * c} \\div ${c} - ${d}`, a - d, (a * c) / (c - d)]
              : [`(${a} + ${b}) \\times ${c} - ${d}`, (a + b) * c - d, a + b * c - d];
        if (!Number.isFinite(naive) || val < 0) return null;
        return {
          stem: `Evaluate ${m(text)}.`,
          answer: num(val),
          wrong: [naive, val + c, val - 1, a + b + c].filter((x) => Number.isInteger(x) && x !== val).map((x) => num(x)),
          explanation: `Brackets first, then × and ÷, then + and − (BODMAS).\n${m(`${text} = ${num(val)}`)}.`,
        };
      },
    },
  ];
};

const beceOnly: Template[] = [
  {
    key: 'jmaths/integers',
    topic: [B_NUM, 'Whole numbers and place value'],
    difficulty: 1,
    make: (r) => {
      const a = r.int(-20, 20);
      const b = r.int(-20, 20);
      if (!a || !b) return null;
      const op = r.pick(['+', '-', '×'] as const);
      const val = op === '+' ? a + b : op === '-' ? a - b : a * b;
      const show = (x: number) => (x < 0 ? `(${x})` : String(x));
      return {
        stem: `Evaluate ${m(`${a} ${op === '×' ? '\\times' : op} ${show(b)}`)}.`,
        answer: m(String(val)),
        wrong: [-val, op === '-' ? a + b : op === '+' ? a - b : -Math.abs(val), val + 2, Math.abs(a) + Math.abs(b)].filter((x) => x !== val).map((x) => m(String(x))),
        explanation: op === '×' ? `${a < 0 !== b < 0 ? 'Unlike signs give a negative answer' : 'Like signs give a positive answer'}: ${m(`${a} \\times ${show(b)} = ${val}`)}.` : op === '-' && b < 0 ? `Subtracting a negative number is the same as adding: ${m(`${a} - ${show(b)} = ${a} + ${-b} = ${val}`)}.` : `${m(`${a} ${op} ${show(b)} = ${val}`)}.`,
      };
    },
  },
  {
    key: 'jmaths/linear-equation',
    topic: [B_ALG, 'Linear equations'],
    difficulty: 2,
    make: (r) => {
      const x = r.int(-6, 12);
      const a = r.int(2, 9);
      const b = r.int(-15, 20);
      const c = a * x + b;
      const sb = b < 0 ? `- ${-b}` : `+ ${b}`;
      if (!b) return null;
      return {
        stem: `Solve ${m(`${a}x ${sb} = ${c}`)}.`,
        answer: m(`x = ${x}`),
        wrong: [(c + b) / a, c / a - b, (c - b) * a, -x].filter((w) => w !== x && Number.isFinite(w)).map((w) => m(`x = ${Number.isInteger(w) ? w : new Frac(Math.round(w * a), a).tex()}`)),
        explanation: `${b > 0 ? 'Subtract' : 'Add'} ${Math.abs(b)} on both sides: ${m(`${a}x = ${c - b}`)}.\nDivide by ${a}: ${m(`x = ${x}`)}.`,
      };
    },
  },
  {
    key: 'jmaths/like-terms',
    topic: [B_ALG, 'Simplifying expressions'],
    difficulty: 1,
    make: (r) => {
      const [p, q, s, t] = [r.int(2, 9), r.int(1, 8), r.int(1, 9), r.int(1, 8)];
      const signQ = r.chance(0.5) ? 1 : -1;
      const signT = r.chance(0.5) ? 1 : -1;
      const X = p + signQ * q;
      const Y = s + signT * t;
      if (!X || !Y) return null;
      const term = (c: number, v: string, first = false) => (first ? `${c === 1 ? '' : c === -1 ? '-' : c}${v}` : `${c < 0 ? '- ' : '+ '}${Math.abs(c) === 1 ? '' : Math.abs(c)}${v}`);
      const expr = `${term(p, 'a', true)} ${term(s, 'b')} ${term(signQ * q, 'a')} ${term(signT * t, 'b')}`;
      const out = `${term(X, 'a', true)} ${term(Y, 'b')}`;
      return {
        stem: `Simplify ${m(expr)}.`,
        answer: m(out),
        wrong: [`${term(p + q, 'a', true)} ${term(s + t, 'b')}`, `${term(X + Y, 'ab', true)}`, `${term(X, 'a', true)} ${term(-Y, 'b')}`, `${term(p - q * signQ, 'a', true)} ${term(Y, 'b')}`].map((x) => m(x)),
        explanation: `Collect like terms: the a terms give ${m(`${p} ${signQ > 0 ? '+' : '-'} ${q} = ${X}`)}, the b terms give ${m(`${s} ${signT > 0 ? '+' : '-'} ${t} = ${Y}`)}.\nAnswer: ${m(out)}.`,
      };
    },
  },
  {
    key: 'jmaths/pythagoras',
    topic: [B_GEO, "Pythagoras' rule"],
    difficulty: 2,
    make: (r) => {
      const [a, b, c] = r.pick([
        [3, 4, 5],
        [6, 8, 10],
        [5, 12, 13],
        [8, 15, 17],
        [9, 12, 15],
        [7, 24, 25],
        [12, 16, 20],
      ]);
      if (r.chance(0.5)) {
        return {
          stem: `The two shorter sides of a right-angled triangle are ${a} cm and ${b} cm. How long is the hypotenuse?`,
          answer: `${c} cm`,
          wrong: [a + b, b - a + c, Math.round(Math.sqrt(b * b - a * a)) || c + 1, c + 1].filter((x) => x !== c).map((x) => `${x} cm`),
          explanation: `${m(`c^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c}`)}, so ${m(`c = \\sqrt{${c * c}} = ${c}`)} cm.`,
        };
      }
      return {
        stem: `A ladder ${c} m long leans against a wall. Its foot is ${a} m from the wall. How high up the wall does it reach?`,
        answer: `${b} m`,
        wrong: [c - a, c + a, Math.round(Math.sqrt(c * c + a * a)), b + 1].filter((x) => x !== b).map((x) => `${x} m`),
        explanation: `The ladder is the hypotenuse: ${m(`h^2 = ${c}^2 - ${a}^2 = ${c * c} - ${a * a} = ${b * b}`)}, so ${m(`h = ${b}`)} m.`,
        difficulty: 3,
      };
    },
  },
];

const ceOnly: Template[] = [
  {
    key: 'jmaths/rounding',
    topic: [C_NUM, 'Place value and rounding'],
    difficulty: 1,
    make: (r) => {
      const n = r.int(1001, 99_999);
      const to = r.pick([10, 100, 1000] as const);
      const ans = Math.round(n / to) * to;
      if (n % to === 0) return null;
      const word = { 10: 'ten', 100: 'hundred', 1000: 'thousand' }[to];
      if (r.chance(0.4)) {
        const digit = String(n)[String(n).length - 1 - r.int(0, 3)];
        const pos = String(n).length - 1 - String(n).lastIndexOf(digit);
        const place = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands'][pos];
        const value = Number(digit) * 10 ** pos;
        if (Number(digit) === 0 || String(n).split(digit).length > 2) return null;
        return {
          stem: `What is the value of the digit ${digit} in ${num(n, undefined, 4)}?`,
          answer: num(value, undefined, 4),
          wrong: [Number(digit), value * 10, value / 10, Number(digit) * 10 ** (pos + 2)].filter((x) => x !== value && Number.isInteger(x)).map((x) => num(x, undefined, 4)),
          explanation: `The ${digit} is in the ${place} place, so its value is ${digit} × ${num(10 ** pos, undefined, 4)} = ${num(value, undefined, 4)}.`,
        };
      }
      return {
        stem: `Round ${num(n, undefined, 4)} to the nearest ${word}.`,
        answer: num(ans, undefined, 4),
        wrong: [Math.floor(n / to) * to === ans ? ans + to : Math.floor(n / to) * to, Math.round(n / (to * 10)) * to * 10, ans - to, n].filter((x) => x !== ans).map((x) => num(x, undefined, 4)),
        explanation: `Look at the digit to the right of the ${word}s place: ${Math.floor((n % to) / (to / 10))}. ${Math.floor((n % to) / (to / 10)) >= 5 ? 'It is 5 or more, so round up' : 'It is less than 5, so round down'}: ${num(ans, undefined, 4)}.`,
      };
    },
  },
  {
    key: 'jmaths/factors-multiples',
    topic: [C_NUM, 'Factors, multiples and primes'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['lcm', 'hcf', 'prime'] as const);
      if (kind === 'prime') {
        const lo = r.int(10, 80);
        const primes = Array.from({ length: 12 }, (_, i) => lo + i).filter(isPrime);
        const non = Array.from({ length: 12 }, (_, i) => lo + i).filter((x) => !isPrime(x) && x % 2 === 1);
        if (!primes.length || non.length < 3) return null;
        const p = r.pick(primes);
        return {
          stem: 'Which of these is a prime number?',
          answer: String(p),
          wrong: r.shuffle(non).slice(0, 3).map(String),
          explanation: `${p} has only two factors, 1 and itself. ${r
            .shuffle(non)
            .slice(0, 1)
            .map((x) => {
              const f = Array.from({ length: x }, (_, i) => i + 2).find((d) => x % d === 0)!;
              return `For example, ${x} = ${f} × ${x / f}, so it is not prime.`;
            })
            .join('')}`,
        };
      }
      const g = r.pick([2, 3, 4, 5, 6]);
      const [x, y] = [g * r.int(2, 7), g * r.int(2, 9)];
      if (x === y || gcd(x, y) !== g) return null;
      if (kind === 'lcm') {
        return {
          stem: `Find the L.C.M. of ${x} and ${y}.`,
          answer: String(lcm(x, y)),
          wrong: [x * y, g, x + y, lcm(x, y) * 2].filter((v) => v !== lcm(x, y)).map(String),
          explanation: `List multiples of ${Math.max(x, y)} until one is also a multiple of ${Math.min(x, y)}: ${lcm(x, y)} is the first.\n(Check: ${lcm(x, y)} ÷ ${x} = ${lcm(x, y) / x} and ${lcm(x, y)} ÷ ${y} = ${lcm(x, y) / y}.)`,
        };
      }
      return {
        stem: `Find the H.C.F. of ${x} and ${y}.`,
        answer: String(g),
        wrong: [lcm(x, y), Math.min(x, y), 1, g * 2].filter((v) => v !== g).map(String),
        explanation: `${x} = ${g} × ${x / g} and ${y} = ${g} × ${y / g}. ${x / g} and ${y / g} share no other factor, so the H.C.F. is ${g}.`,
      };
    },
  },
  {
    key: 'jmaths/roman-numerals',
    topic: [C_NUM, 'Roman numerals'],
    difficulty: 1,
    make: (r) => {
      const n = r.int(4, 2030);
      const R = roman(n);
      const wrongNums = [n + 10, n - 1, n + 100, n + 5].filter((x) => x > 0 && roman(x) !== R);
      if (r.chance(0.5)) {
        return { stem: `Write ${n} in Roman numerals.`, answer: R, wrong: wrongNums.map(roman), explanation: `Write each place value in Roman numerals: ${romanParts(n)}. Joined up: ${R}.` };
      }
      return { stem: `What number is ${R}?`, answer: String(n), wrong: wrongNums.map(String), explanation: `${R} = ${n}. Remember: a smaller numeral before a larger one is subtracted (IV = 4, IX = 9, XL = 40, XC = 90, CD = 400, CM = 900).` };
    },
  },
  {
    key: 'jmaths/money',
    topic: [C_MEAS, 'Money'],
    difficulty: 1,
    make: (r) => {
      const [item, price] = r.pick([
        ['exercise books', r.pick([150, 200, 250, 300])],
        ['pencils', r.pick([50, 80, 100, 120])],
        ['loaves of bread', r.pick([700, 800, 1000, 1200])],
        ['oranges', r.pick([50, 100, 150])],
        ['bottles of water', r.pick([200, 250, 300])],
      ] as const);
      const n = r.int(2, 9);
      const cost = n * price;
      const note = [1000, 2000, 5000, 10_000].find((x) => x > cost);
      if (!note) return null;
      const who = r.pick(NAMES);
      return {
        stem: `${who} buys ${n} ${item} at ${naira(price)} each and pays with a ${naira(note)} note. How much change should ${who} get?`,
        answer: naira(note - cost),
        wrong: [cost, note - price, note - cost + price, note - cost - 50].filter((x) => x > 0 && x !== note - cost).map(naira),
        explanation: `Cost: ${n} × ${naira(price)} = ${naira(cost)}. Change: ${naira(note)} − ${naira(cost)} = ${naira(note - cost)}.`,
      };
    },
  },
  {
    key: 'jmaths/time',
    topic: [C_MEAS, 'Time'],
    difficulty: 2,
    make: (r) => {
      const h = r.int(6, 15);
      const mm = r.pick([0, 10, 15, 20, 30, 40, 45, 50]);
      const dur = r.int(35, 200);
      const end = h * 60 + mm + dur;
      const fmt = (t: number) => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      const twelve = (t: number) => {
        const hh = Math.floor(t / 60) % 24;
        return `${hh % 12 || 12}:${String(t % 60).padStart(2, '0')} ${hh < 12 ? 'a.m.' : 'p.m.'}`;
      };
      if (r.chance(0.5)) {
        return {
          stem: `A lesson starts at ${fmt(h * 60 + mm)} and lasts ${[dur >= 60 ? plural(Math.floor(dur / 60), 'hour') : '', dur % 60 ? plural(dur % 60, 'minute') : ''].filter(Boolean).join(' ')}. At what time does it end?`,
          answer: fmt(end),
          wrong: [end + 60, end - 10, end + 40, end - 60].map(fmt),
          explanation: `Add the hours, then the minutes; 60 minutes make an hour. ${fmt(h * 60 + mm)} + ${Math.floor(dur / 60)} h ${dur % 60} min = ${fmt(end)}.`,
        };
      }
      const t = r.int(13, 23) * 60 + r.pick([0, 5, 15, 30, 45]);
      return {
        stem: `Write ${fmt(t)} (24-hour clock) in the 12-hour clock.`,
        answer: twelve(t),
        wrong: [twelve(t).replace('p.m.', 'a.m.'), `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} p.m.`, twelve(t - 60), twelve(t + 60)].filter((x) => x !== twelve(t)),
        explanation: `Hours after 12:00 are p.m.: subtract 12 from the hour. ${fmt(t)} → ${twelve(t)}`,
      };
    },
  },
  {
    key: 'jmaths/units',
    topic: [C_MEAS, 'Length, mass and capacity'],
    difficulty: 1,
    make: (r) => {
      const [from, to, k] = r.pick([
        ['km', 'm', 1000],
        ['m', 'cm', 100],
        ['cm', 'mm', 10],
        ['kg', 'g', 1000],
        ['litres', 'ml', 1000],
        ['m', 'km', 0.001],
        ['g', 'kg', 0.001],
        ['ml', 'litres', 0.001],
        ['cm', 'm', 0.01],
      ] as const);
      const x = k < 1 ? r.pick([250, 500, 750, 1500, 2500, 3200, 4500]) : r.pick([2, 3.5, 4, 1.25, 7, 12, 0.5]);
      const ans = Math.round(x * k * 1e6) / 1e6;
      return {
        stem: `How many ${UNIT_WORD[to]} are there in ${num(x, undefined, 4)} ${UNIT_WORD[from]}?`,
        answer: num(ans, undefined, 4),
        wrong: [x * k * 10, x * k / 10, x / k, x].filter((w) => Math.abs(w - ans) > 1e-9).map((w) => num(Math.round(w * 1e6) / 1e6, undefined, 4)),
        explanation: `1 ${UNIT_WORD[k < 1 ? to : from].replace(/s$/, '')} = ${num(k < 1 ? 1 / k : k, undefined, 4)} ${UNIT_WORD[k < 1 ? from : to]}, so ${k < 1 ? 'divide' : 'multiply'} by ${num(k < 1 ? 1 / k : k, undefined, 4)}: ${num(ans, undefined, 4)} ${UNIT_WORD[to]}.`,
      };
    },
  },
];

/** BECE Mathematics: junior templates plus the JAMB ones simple enough for JSS3. */
export function beceMathematics(): Template[] {
  const fromJamb = jambMathematics.flatMap((t) => {
    const k = t.key.replace(/^jamb-maths\//, '');
    return BECE_FROM_JAMB[k] ? [{ ...t, key: `bece-maths/${k}`, topic: BECE_FROM_JAMB[k] }] : [];
  });
  return [...fromJamb, ...forExam('bece', [...shared('bece'), ...beceOnly])];
}

/** Common Entrance Mathematics (primary 6). */
export const ceMathematics = (): Template[] => forExam('ce', [...shared('ce'), ...ceOnly]);
