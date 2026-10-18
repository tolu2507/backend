import { factorial, Frac, isInt, m, nCr, nPr, num, poly, signed, type Rng, type Template } from '../engine.js';

const STATS = 'Measures of Location and Dispersion';
const nz = (r: Rng, lo: number, hi: number) => {
  const x = r.int(lo, hi);
  return x === 0 ? hi : x;
};
/** A whole number, or a decimal to 2 places when it isn't. */
const dec = (f: Frac) => (f.isInt ? String(f.n) : num(f.value, 2));
const table = (label: string, xs: number[], fs: number[]) => `${label}: ${xs.join(', ')}\nFrequency: ${fs.join(', ')}`;
const derive = (co: number[]) => co.slice(0, -1).map((c, i) => c * (co.length - 1 - i));
const evalPoly = (co: number[], x: number) => co.reduce((acc, c) => acc * x + c, 0);
const matrix = (rows: (number | string)[][], kind: 'p' | 'v' = 'p') => `\\begin{${kind}matrix} ${rows.map((row) => row.join(' & ')).join(' \\\\ ')} \\end{${kind}matrix}`;
const det2 = ([[a, b], [c, d]]: number[][]) => a * d - b * c;
const det3 = (M: number[][]) => M[0][0] * det2([[M[1][1], M[1][2]], [M[2][1], M[2][2]]]) - M[0][1] * det2([[M[1][0], M[1][2]], [M[2][0], M[2][2]]]) + M[0][2] * det2([[M[1][0], M[1][1]], [M[2][0], M[2][1]]]);

export const calculusStats: Template[] = [
  // ── Differentiation ─────────────────────────────────────────
  {
    key: 'jamb-maths/differentiate-polynomial',
    topic: ['Differentiation', 'Derivatives of basic functions'],
    difficulty: 2,
    make: (r) => {
      const co = [nz(r, -5, 8), r.int(-7, 7), r.int(-9, 9), r.int(-9, 9)];
      const d1 = derive(co);
      const second = r.chance(0.4);
      const ans = second ? derive(d1) : d1;
      const y = `y = ${poly(co)}`;
      return {
        stem: `If ${m(y)}, find ${m(second ? '\\frac{d^2y}{dx^2}' : '\\frac{dy}{dx}')}.`,
        answer: m(poly(ans)),
        wrong: second
          ? [m(poly(d1)), m(poly([co[0] * 3, co[1]])), m(poly(derive(d1).map((c, i) => (i === 1 ? -c : c))))]
          : [m(poly(co.slice(0, -1))), m(poly([...d1.slice(0, -1), d1[d1.length - 1], co[3]])), m(poly(d1.map((c, i) => (i === 1 ? -c : c))))],
        explanation: `Differentiate term by term: ${m('\\frac{d}{dx}(ax^n) = nax^{n-1}')}, and constants disappear.\n${m(`\\frac{dy}{dx} = ${poly(d1)}`)}${second ? `\nDifferentiate again: ${m(`\\frac{d^2y}{dx^2} = ${poly(ans)}`)}` : ''}.`,
      };
    },
  },
  {
    key: 'jamb-maths/rate-of-change',
    topic: ['Differentiation', 'Applications of differentiation'],
    difficulty: 3,
    make: (r) => {
      const [a, b, c] = [r.int(1, 6), r.int(-5, 7), r.int(1, 6)];
      const k = r.int(2, 8);
      if (a === 1 && b === -c) return null; // the same bracket twice
      // S = (at + b)(t − c) = at² + (b − ac)t − bc
      const co = [a, b - a * c, -b * c];
      const rate = 2 * a * k + (b - a * c);
      return {
        stem: `If ${m(`S = (${poly([a, b], 't')})(t - ${c})`)}, find ${m('\\frac{dS}{dt}')} when ${m(`t = ${k}`)}.`,
        answer: String(rate),
        wrong: [String(evalPoly(co, k)), String(a * k + b), String(2 * a * k), String(rate + c)],
        explanation: `Expand: ${m(`S = ${poly(co, 't')}`)}.\n${m(`\\frac{dS}{dt} = ${poly(derive(co), 't')}`)}. At ${m(`t = ${k}`)}: ${m(`${2 * a}(${k}) ${signed(b - a * c)} = ${rate}`)}.`.replace('+ 0 =', '='),
      };
    },
  },
  {
    key: 'jamb-maths/turning-point',
    topic: ['Differentiation', 'Applications of differentiation'],
    difficulty: 3,
    make: (r) => {
      const a = r.pick([1, 1, 2, 3, -1, -2]);
      const x0 = r.int(-5, 5);
      const b = -2 * a * x0;
      const c = r.int(-12, 12);
      const y0 = a * x0 * x0 + b * x0 + c;
      const kind = a > 0 ? 'minimum' : 'maximum';
      return {
        stem: `Find the ${kind} value of ${m(`y = ${poly([a, b, c])}`)}.`,
        answer: String(y0),
        wrong: [String(x0 === 0 ? y0 + a : x0), String(a * x0 * x0 - b * x0 + c), String(c), String(-y0 === y0 ? y0 + 2 : -y0)],
        explanation: `At a turning point ${m(`\\frac{dy}{dx} = ${poly([2 * a, b])} = 0`)}, so ${m(`x = ${x0}`)}.\nThen ${m(`y = ${a === 1 ? '' : a === -1 ? '-' : a}(${x0})^2 ${signed(b)}(${x0}) ${signed(c)} = ${y0}`)}${a > 0 ? ' (a minimum, since the coefficient of x² is positive)' : ' (a maximum, since the coefficient of x² is negative)'}.`,
      };
    },
  },
  {
    key: 'jamb-maths/tangent-line',
    topic: ['Differentiation', 'Applications of differentiation'],
    difficulty: 3,
    make: (r) => {
      const b = r.int(-6, 6);
      const c = r.int(-6, 6);
      const k = r.int(-3, 4);
      const y0 = k * k + b * k + c;
      const slope = 2 * k + b;
      const eq = (mm: number, cc: number) => m(`y = ${poly([mm, cc])}`);
      return {
        stem: `Find the equation of the tangent to the curve ${m(`y = ${poly([1, b, c])}`)} at the point ${m(`(${k}, ${y0})`)}.`,
        answer: eq(slope, y0 - slope * k),
        wrong: [eq(slope, y0 + slope * k), eq(k + b, y0 - (k + b) * k), eq(slope, -(y0 - slope * k) || y0 + 1)],
        explanation: `${m(`\\frac{dy}{dx} = ${poly([2, b])}`)}, so the gradient at ${m(`x = ${k}`)} is ${m(String(slope))}.\nUsing ${m('y - y_1 = m(x - x_1)')}: ${m(`y - ${y0 < 0 ? `(${y0})` : y0} = ${slope}(x - ${k < 0 ? `(${k})` : k})`)}, which gives ${eq(slope, y0 - slope * k)}.`,
      };
    },
  },

  // ── Integration ─────────────────────────────────────────────
  {
    key: 'jamb-maths/integrate-polynomial',
    topic: ['Integration', 'Indefinite and definite integrals'],
    difficulty: 2,
    make: (r) => {
      const F = [nz(r, -4, 4), r.int(-5, 5), nz(r, -6, 6), 0]; // the answer, built first so it has whole coefficients
      const f = derive(F);
      if (r.chance(0.55)) {
        return {
          stem: `Integrate ${m(poly(f))} with respect to ${m('x')}.`,
          answer: m(`${poly(F)} + c`),
          wrong: [m(`${poly(f.map((c, i) => c * (f.length - i)).concat(0))} + c`), m(`${poly(derive(f))} + c`), m(`${poly([...f, 0])} + c`)],
          explanation: `${m('\\int ax^n\\,dx = \\frac{a}{n+1}x^{n+1} + c')}. Integrate term by term: ${m(`${poly(F)} + c`)}.`,
        };
      }
      const a = r.int(-2, 2);
      const b = a + r.int(1, 3);
      const val = evalPoly(F, b) - evalPoly(F, a);
      return {
        stem: `Evaluate ${m(`\\int_{${a}}^{${b}} (${poly(f)})\\,dx`)}.`,
        answer: String(val),
        wrong: [String(-val), String(evalPoly(F, b) + evalPoly(F, a)), String(evalPoly(F, b)), String(evalPoly(f, b) - evalPoly(f, a))],
        explanation: `${m(`\\int (${poly(f)})\\,dx = ${poly(F)}`)}.\nSubstitute the limits: ${m(`[${poly(F)}]_{${a}}^{${b}} = ${evalPoly(F, b)} - (${evalPoly(F, a)}) = ${val}`)}.`,
        difficulty: 3,
      };
    },
  },

  // ── Statistics ──────────────────────────────────────────────
  {
    key: 'jamb-maths/frequency-table-average',
    topic: [STATS, 'Mean, median and mode'],
    difficulty: 2,
    make: (r) => {
      const xs = [0, 1, 2, 3, 4, 5];
      const fs = xs.map(() => r.int(1, 9));
      const n = fs.reduce((a, b) => a + b, 0);
      const list = xs.flatMap((x, i) => Array(fs[i]).fill(x) as number[]);
      const mean = new Frac(xs.reduce((s, x, i) => s + x * fs[i], 0), n);
      const median = n % 2 ? new Frac(list[(n - 1) / 2]) : new Frac(list[n / 2 - 1] + list[n / 2], 2);
      const maxF = Math.max(...fs);
      const kind = r.pick(['mean', 'median', 'mode'] as const);
      const stem = (what: string) => `The table shows the marks scored by a group of students in a test.\n${table('Mark', xs, fs)}\n${what}`;
      if (kind === 'mode') {
        if (fs.filter((f) => f === maxF).length > 1) return null;
        const mode = xs[fs.indexOf(maxF)];
        return {
          stem: stem('What is the modal mark?'),
          answer: String(mode),
          wrong: [String(maxF), dec(median) === String(mode) ? String((mode + 2) % 6) : dec(median), dec(mean) === String(mode) ? String((mode + 3) % 6) : dec(mean), String((mode + 1) % 6)],
          explanation: `The mode is the mark with the highest frequency: ${mode} (scored by ${maxF} students).`,
          difficulty: 1,
        };
      }
      if (kind === 'median') {
        return {
          stem: stem('What is the median mark?'),
          answer: dec(median),
          wrong: [dec(mean), String(xs[fs.indexOf(maxF)]), '2.5', String(Math.round(n / 2))],
          explanation: `There are ${n} students. Arranged in order, the median is the ${n % 2 ? `${(n + 1) / 2}th mark` : `average of the ${n / 2}th and ${n / 2 + 1}th marks`}.\nCounting through the frequencies, that is ${dec(median)}.`,
        };
      }
      return {
        stem: stem('Find the mean mark, correct to 2 decimal places where necessary.'),
        answer: dec(mean),
        wrong: [dec(new Frac(xs.reduce((s, x, i) => s + x * fs[i], 0), 6)), dec(new Frac(15, 6)), dec(median) === dec(mean) ? dec(mean.add(1)) : dec(median), dec(mean.add(new Frac(1, 2)))],
        explanation: `Mean = ${m(`\\frac{\\sum fx}{\\sum f} = \\frac{${xs.map((x, i) => `${x} \\times ${fs[i]}`).join(' + ')}}{${n}} = \\frac{${mean.n * (n / mean.d)}}{${n}}`)} ≈ ${dec(mean)}.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-maths/range-and-mean-deviation',
    topic: [STATS, 'Range and mean deviation'],
    difficulty: 2,
    make: (r) => {
      if (r.chance(0.4)) {
        const xs = Array.from({ length: r.int(6, 8) }, () => r.int(-60, 60) / 100);
        const lo = Math.min(...xs);
        const hi = Math.max(...xs);
        if (new Set(xs).size < xs.length) return null;
        return {
          stem: `Find the range of the numbers ${xs.map((x) => num(x)).join(', ')}.`,
          answer: num(Math.round((hi - lo) * 100) / 100),
          wrong: [num(Math.round((hi + lo) * 100) / 100), num(hi), num(Math.round((Math.abs(hi) - Math.abs(lo)) * 100) / 100 || hi * 2)],
          explanation: `Range = largest − smallest = ${m(`${num(hi)} - (${num(lo)}) = ${num(Math.round((hi - lo) * 100) / 100)}`)}.`,
          difficulty: 1,
        };
      }
      const n = r.pick([5, 6, 7]);
      const mean = r.int(4, 15);
      const xs = Array.from({ length: n - 1 }, () => mean + r.int(-6, 6));
      xs.push(mean * n - xs.reduce((a, b) => a + b, 0));
      if (xs[n - 1] < 0 || Math.abs(xs[n - 1] - mean) > 10) return null;
      const dev = xs.reduce((s, x) => s + Math.abs(x - mean), 0);
      const md = new Frac(dev, n);
      if (dev === 0) return null;
      xs.splice(0, xs.length, ...r.shuffle(xs)); // so the last number isn't always the one that balances the mean
      return {
        stem: `Calculate the mean deviation of ${xs.join(', ')}.`,
        answer: dec(md),
        wrong: [dec(new Frac(xs.reduce((s, x) => s + (x - mean) ** 2, 0), n)), String(mean), dec(new Frac(dev, n - 1)), dec(md.add(1))],
        explanation: `Mean = ${m(`\\frac{${xs.reduce((a, b) => a + b, 0)}}{${n}} = ${mean}`)}.\nAbsolute deviations from the mean: ${xs.map((x) => Math.abs(x - mean)).join(', ')}, which add up to ${dev}.\nMean deviation = ${m(`\\frac{${dev}}{${n}}`)} ${md.isInt ? '=' : '≈'} ${dec(md)}.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-maths/variance',
    topic: [STATS, 'Standard deviation and variance'],
    difficulty: 3,
    make: (r) => {
      const n = r.pick([4, 5, 6]);
      const mean = r.int(3, 12);
      const xs = Array.from({ length: n - 1 }, () => mean + r.int(-5, 5));
      xs.push(mean * n - xs.reduce((a, b) => a + b, 0));
      if (xs[n - 1] < 0) return null;
      const ss = xs.reduce((s, x) => s + (x - mean) ** 2, 0);
      if (ss === 0) return null;
      const variance = new Frac(ss, n);
      const sdIsWhole = isInt(Math.sqrt(variance.value));
      const askSd = sdIsWhole && r.chance(0.6);
      if (askSd) {
        const sd = Math.sqrt(variance.value);
        return {
          stem: `Find the standard deviation of ${xs.join(', ')}.`,
          answer: String(sd),
          wrong: [dec(variance), dec(new Frac(xs.reduce((s, x) => s + Math.abs(x - mean), 0), n)), String(sd + 1)],
          explanation: `Mean = ${mean}. Squared deviations add up to ${ss}, so the variance is ${m(`\\frac{${ss}}{${n}} = ${dec(variance)}`)}.\nStandard deviation = ${m(`\\sqrt{${dec(variance)}} = ${sd}`)}.`,
          difficulty: 4,
        };
      }
      return {
        stem: `Find the variance of ${xs.join(', ')}.`,
        answer: dec(variance),
        wrong: [dec(new Frac(ss, n - 1)), num(Math.sqrt(variance.value), 2), dec(new Frac(xs.reduce((s, x) => s + Math.abs(x - mean), 0), n)), String(ss)],
        explanation: `Mean = ${mean}. Deviations: ${xs.map((x) => x - mean).join(', ')}.\nSquared deviations add up to ${ss}. Variance = ${m(`\\frac{${ss}}{${n}}`)} ${variance.isInt ? '=' : '≈'} ${dec(variance)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/pie-chart-angle',
    topic: ['Representation of Data', 'Histograms, bar charts and pie charts'],
    difficulty: 2,
    make: (r) => {
      const total = r.pick([18, 20, 24, 30, 36, 40, 45, 60, 72, 90, 120]);
      const k = r.int(4, 6);
      const cuts = Array.from({ length: k - 1 }, () => r.int(1, total - 1)).sort((a, b) => a - b);
      const fs = [...cuts, total].map((c, i, arr) => c - (i ? arr[i - 1] : 0));
      if (fs.some((f) => f === 0)) return null;
      const ages = Array.from({ length: k }, (_, i) => 7 + i);
      const i = r.int(0, k - 1);
      const angle = new Frac(fs[i] * 360, total);
      const show = (f: Frac) => m(`${dec(f)}^\\circ`);
      return {
        stem: `The table shows the ages of pupils in a class.\n${table('Age (years)', ages, fs)}\nIf a pie chart is drawn, what angle represents pupils aged ${ages[i]}?`,
        answer: show(angle),
        wrong: [show(new Frac(fs[i] * 100, total)), show(new Frac(fs[i] * 180, total)), show(new Frac(fs[i] * 360, total + fs[i])), show(angle.add(10))],
        explanation: `There are ${total} pupils. Angle = ${m(`\\frac{${fs[i]}}{${total}} \\times 360^\\circ = ${dec(angle)}^\\circ`)}.`,
      };
    },
  },

  // ── Probability ─────────────────────────────────────────────
  {
    key: 'jamb-maths/coin-and-die',
    topic: ['Probability', 'Mutually exclusive and independent events'],
    difficulty: 2,
    make: (r) => {
      const k = r.int(2, 5);
      const events: [string, number][] = [['an even number', 3], ['an odd number', 3], ['a prime number', 3], ['a multiple of 3', 2], ['a six', 1], [`a number greater than ${k}`, 6 - k], [`a number less than ${k}`, k - 1]];
      const [text, count] = r.pick(events);
      const side = r.pick(['head', 'tail']);
      const ans = new Frac(count, 12);
      return {
        stem: `A fair coin is tossed and a fair die is rolled. What is the probability of getting a ${side} and ${text}?`,
        answer: m(ans.tex()),
        wrong: [m(new Frac(1, 2).add(new Frac(count, 6)).tex()), m(new Frac(count, 6).tex()), m(new Frac(count, 8).tex()), m(new Frac(count + 1, 12).tex())],
        explanation: `The events are independent, so multiply: ${m(`P(\\text{${side}}) \\times P(\\text{${text}}) = \\frac{1}{2} \\times \\frac{${count}}{6} = ${ans.tex()}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/balls-from-a-bag',
    topic: ['Probability', 'Mutually exclusive and independent events'],
    difficulty: 3,
    make: (r) => {
      const [c1, c2] = r.shuffle(['red', 'blue', 'green', 'white', 'black', 'yellow']).slice(0, 2);
      const a = r.int(2, 8);
      const b = r.int(2, 9);
      const n = a + b;
      const replace = r.chance(0.5);
      const ans = replace ? new Frac(a * a, n * n) : new Frac(a * (a - 1), n * (n - 1));
      const other = replace ? new Frac(a * (a - 1), n * (n - 1)) : new Frac(a * a, n * n);
      return {
        stem: `A bag contains ${a} ${c1} balls and ${b} ${c2} balls. Two balls are drawn at random, one after the other, ${replace ? 'with' : 'without'} replacement. Find the probability that both are ${c1}.`,
        answer: m(ans.tex()),
        wrong: [m(other.tex()), m(new Frac(2 * a, n).value <= 1 ? new Frac(2 * a, n).tex() : new Frac(a, 2 * n).tex()), m(new Frac(a, n).tex()), m(new Frac(a * a, n * (n - 1)).tex())],
        explanation: replace
          ? `With replacement the bag is the same each time: ${m(`\\frac{${a}}{${n}} \\times \\frac{${a}}{${n}} = ${ans.tex()}`)}.`
          : `Without replacement there is one ${c1} ball fewer for the second draw: ${m(`\\frac{${a}}{${n}} \\times \\frac{${a - 1}}{${n - 1}} = ${ans.tex()}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/two-dice',
    topic: ['Probability', 'Experimental and theoretical probability'],
    difficulty: 2,
    make: (r) => {
      const pairs = Array.from({ length: 36 }, (_, i) => [Math.floor(i / 6) + 1, (i % 6) + 1]);
      const kind = r.pick(['sum', 'at least', 'product'] as const);
      const s = kind === 'product' ? r.pick([6, 8, 10, 12]) : r.int(3, 11);
      const hit = pairs.filter(([x, y]) => (kind === 'sum' ? x + y === s : kind === 'at least' ? x + y >= s : x * y <= s)).length;
      const ans = new Frac(hit, 36);
      const what = kind === 'sum' ? `a total of ${s}` : kind === 'at least' ? `a total of at least ${s}` : `a product not greater than ${s}`;
      return {
        stem: `Two fair dice are thrown together. What is the probability of getting ${what}?`,
        answer: m(ans.tex()),
        wrong: [m(new Frac(Math.max(1, hit - 1), 36).tex()), m(new Frac(1, 11).tex()), m(new Frac(hit, 12).value <= 1 ? new Frac(hit, 12).tex() : new Frac(hit + 1, 36).tex()), m(new Frac(36 - hit, 36).tex())],
        explanation: `There are ${m('6 \\times 6 = 36')} equally likely outcomes. ${hit} of them give ${what}, so the probability is ${m(`\\frac{${hit}}{36} = ${ans.tex()}`)}.`,
      };
    },
  },

  // ── Permutation and combination ─────────────────────────────
  {
    key: 'jamb-maths/arrange-letters',
    topic: ['Permutation and Combination', 'Permutations'],
    difficulty: 2,
    variety: 20,
    make: (r) => {
      const word = r.pick(['LEADER', 'BANANA', 'ABUJA', 'ENUGU', 'KADUNA', 'IBADAN', 'OSOGBO', 'ANAMBRA', 'NIGERIA', 'SCHOOL', 'COFFEE', 'LETTER', 'MAMMAL', 'PEPPER', 'STATISTICS', 'ALGEBRA', 'CALABAR', 'KANO', 'LAGOS', 'BENIN', 'DELTA', 'TARABA']);
      const counts = [...word].reduce<Record<string, number>>((acc, ch) => ({ ...acc, [ch]: (acc[ch] ?? 0) + 1 }), {});
      const repeats = Object.entries(counts).filter(([, c]) => c > 1);
      const divisor = repeats.reduce((d, [, c]) => d * factorial(c), 1);
      const ans = factorial(word.length) / divisor;
      return {
        stem: `In how many ways can the letters of the word ${word} be arranged?`,
        answer: num(ans),
        wrong: [num(factorial(word.length)), num(divisor > 1 ? factorial(word.length) / (divisor * 2) : ans / 2), num(factorial(word.length - 1)), num(ans * 2)],
        explanation: `${word} has ${word.length} letters${repeats.length ? `, with ${repeats.map(([ch, c]) => `${ch} repeated ${c} times`).join(' and ')}` : ', all different'}.\nNumber of arrangements = ${m(repeats.length ? `\\frac{${word.length}!}{${repeats.map(([, c]) => `${c}!`).join(' \\times ')}} = ${num(ans)}` : `${word.length}! = ${num(ans)}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/choose-committee',
    topic: ['Permutation and Combination', 'Combinations'],
    difficulty: 3,
    make: (r) => {
      const men = r.int(3, 8);
      const women = r.int(3, 7);
      const k = r.int(3, 5);
      const j = r.int(1, Math.min(k - 1, women));
      if (k - j > men) return null;
      const ans = nCr(women, j) * nCr(men, k - j);
      return {
        stem: `A committee of ${k} is to be chosen from ${men} men and ${women} women. In how many ways can this be done if it must include exactly ${j} wom${j === 1 ? 'an' : 'en'}?`,
        answer: num(ans),
        wrong: [num(nCr(men + women, k)), num(nCr(women, j) + nCr(men, k - j)), num(nPr(women, j) * nPr(men, k - j)), num(nCr(women, j) * nCr(men, k))],
        explanation: `Choose the women: ${m(`^{${women}}C_{${j}} = ${nCr(women, j)}`)}. Choose the men: ${m(`^{${men}}C_{${k - j}} = ${nCr(men, k - j)}`)}.\nMultiply (each choice of women goes with each choice of men): ${m(`${nCr(women, j)} \\times ${nCr(men, k - j)} = ${ans}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/arrange-or-choose',
    topic: ['Permutation and Combination', 'Permutations'],
    difficulty: 2,
    make: (r) => {
      const n = r.int(5, 12);
      const k = r.int(2, 4);
      const ordered = r.chance(0.5);
      const ans = ordered ? nPr(n, k) : nCr(n, k);
      const words = ['', '', 'two', 'three', 'four'];
      const prizes = (count: number) => {
        const p = ['first', 'second', 'third', 'fourth'].slice(0, count);
        return `${p.slice(0, -1).join(', ')} and ${p[p.length - 1]}`;
      };
      return {
        stem: ordered
          ? `In how many ways can ${prizes(k)} prizes be awarded to ${n} students if no student can win more than one prize?`
          : `In how many ways can ${words[k]} students be chosen from a group of ${n} to represent the class?`,
        answer: num(ans),
        wrong: [num(ordered ? nCr(n, k) : nPr(n, k)), num(n ** k), num(n * k), num(factorial(k) * n)],
        explanation: ordered
          ? `Order matters (the prizes are different), so use permutations: ${m(`^{${n}}P_{${k}} = \\frac{${n}!}{${n - k}!} = ${num(ans)}`)}.`
          : `Order doesn't matter, so use combinations: ${m(`^{${n}}C_{${k}} = \\frac{${n}!}{${k}!\\,${n - k}!} = ${num(ans)}`)}.`,
      };
    },
  },

  // ── Matrices and determinants ───────────────────────────────
  {
    key: 'jamb-maths/determinant',
    topic: ['Matrices and Determinants', 'Determinants of matrices'],
    difficulty: 2,
    make: (r) => {
      if (r.chance(0.4)) {
        const M = [[r.int(-6, 9), r.int(-6, 9)], [r.int(-6, 9), r.int(-6, 9)]];
        const [[a, b], [c, d]] = M;
        return {
          stem: `Evaluate ${m(matrix(M, 'v'))}.`,
          answer: String(det2(M)),
          wrong: [String(a * d + b * c), String(b * c - a * d), String(a * b - c * d), String(a * c - b * d)],
          explanation: `${m(`\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc = (${a})(${d}) - (${b})(${c}) = ${det2(M)}`)}.`,
          difficulty: 1,
        };
      }
      const M = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => r.int(-5, 6)));
      const D = det3(M);
      const plusMiddle = M[0][0] * det2([[M[1][1], M[1][2]], [M[2][1], M[2][2]]]) + M[0][1] * det2([[M[1][0], M[1][2]], [M[2][0], M[2][2]]]) + M[0][2] * det2([[M[1][0], M[1][1]], [M[2][0], M[2][1]]]);
      if (plusMiddle === D) return null;
      const minors = [det2([[M[1][1], M[1][2]], [M[2][1], M[2][2]]]), det2([[M[1][0], M[1][2]], [M[2][0], M[2][2]]]), det2([[M[1][0], M[1][1]], [M[2][0], M[2][1]]])];
      const askX = r.chance(0.5) && M[0][0] !== 0 && minors[0] !== 0;
      if (askX) {
        const shown = M.map((row, i) => row.map((v, j) => (i === 1 && j === 0 ? 'x' : v)));
        // Put x in row 2, column 1: the determinant is linear in x.
        const x = M[1][0];
        const at = (v: number) => det3(M.map((row, i) => row.map((c, j) => (i === 1 && j === 0 ? v : c))));
        const slope = at(1) - at(0);
        if (slope === 0) return null;
        const wrongX = (D + 2 * at(0)) / slope;
        return {
          stem: `If ${m(`${matrix(shown, 'v')} = ${D}`)}, find the value of ${m('x')}.`,
          answer: String(x),
          wrong: [String(-x), String(isInt(wrongX) && wrongX !== x ? wrongX : x + 2), String(x + 1), String(x - 3)],
          explanation: `Expanding the determinant gives an expression in ${m('x')}: ${m(`${slope}x ${signed(at(0))} = ${D}`)}.\nSo ${m(`${slope}x = ${D - at(0)}`)} and ${m(`x = ${x}`)}.`,
          difficulty: 3,
        };
      }
      return {
        stem: `Find the determinant of ${m(`${matrix(M)}`)}.`,
        answer: String(D),
        wrong: [String(plusMiddle), String(-D), String(minors[0] * M[0][0]), String(D + 2)],
        explanation: `Expand along the first row, with signs + − +:\n${m(`${M[0][0]}(${minors[0]}) - (${M[0][1]})(${minors[1]}) + (${M[0][2]})(${minors[2]}) = ${D}`)}.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-maths/inverse-matrix',
    topic: ['Matrices and Determinants', 'Inverse of matrices'],
    difficulty: 3,
    make: (r) => {
      const M = [[r.int(-5, 7), r.int(-5, 7)], [r.int(-5, 7), r.int(-5, 7)]];
      const D = det2(M);
      if (D === 0 || Math.abs(D) > 20) return null;
      const [[a, b], [c, d]] = M;
      const adj = [[d, -b], [-c, a]];
      const inv = new Frac(1, D);
      // With a determinant of ±1 the inverse has whole entries; otherwise keep the fraction outside, as JAMB does.
      const show = (rows: number[][], k: Frac) => (Math.abs(D) === 1 ? m(matrix(rows.map((row) => row.map((v) => k.mul(v).n)))) : m(`${k.tex()}${matrix(rows)}`));
      return {
        stem: `Find the inverse of the matrix ${m(`A = ${matrix(M)}`)}.`,
        answer: show(adj, inv),
        wrong: [show([[a, -b], [-c, d]], inv), show([[d, b], [c, a]], inv), show(adj, inv.neg()), m(matrix(adj))],
        explanation: `${m(`|A| = (${a})(${d}) - (${b})(${c}) = ${D}`)}.\nSwap the leading diagonal, change the signs of the other two, and divide by the determinant: ${m(`A^{-1} = ${inv.tex()}${matrix(adj)}`)}.`,
      };
    },
  },
];
