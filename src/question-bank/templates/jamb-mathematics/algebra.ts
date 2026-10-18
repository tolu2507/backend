import { Frac, isInt, m, num, poly, signed, surd, WORDS, type Rng, type Template } from '../engine.js';

const POLY = 'Polynomials';
const INDICES = 'Indices, Logarithms and Surds';

/** "a(k)^3 + b(k)^2 …" for substitution working, skipping zero terms. */
function substitute(coeffs: number[], k: number) {
  const deg = coeffs.length - 1;
  const parts: string[] = [];
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const p = deg - i;
    const body = p === 0 ? String(Math.abs(c)) : `${Math.abs(c) === 1 ? '' : Math.abs(c)}(${k})${p > 1 ? `^${p}` : ''}`;
    parts.push(parts.length ? `${c < 0 ? ' - ' : ' + '}${body}` : `${c < 0 ? '-' : ''}${body}`);
  });
  return parts.join('');
}
const evalPoly = (coeffs: number[], x: number) => coeffs.reduce((acc, c) => acc * x + c, 0);
const factorText = (k: number) => `(x ${signed(-k)})`;

/** Distinct letters for formulas, avoiding ones that look like numbers or each other. */
const letters = (r: Rng, n: number) => r.shuffle(['a', 'b', 'c', 'd', 'f', 'g', 'h', 'k', 'm', 'n', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']).slice(0, n);

const rootsText = (a: number, b: number) => {
  const [lo, hi] = [a, b].sort((x, y) => x - y);
  return m(`x = ${lo} \\text{ or } ${hi}`);
};

/** A power written as a number: base 2, exponent 3 → "8"; negative exponents as fractions. */
const powerAsNumber = (b: number, e: number) => (e === 0 ? '1' : e > 0 ? String(b ** e) : `\\frac{1}{${b ** -e}}`);

export const algebra: Template[] = [
  {
    key: 'jamb-maths/remainder-theorem',
    topic: [POLY, 'Factor and remainder theorems'],
    difficulty: 2,
    make: (r) => {
      const co = [r.int(1, 4), r.int(-6, 6), r.int(-6, 6), r.int(-9, 9)];
      const k = r.pick([-3, -2, -1, 2, 3]);
      const ans = evalPoly(co, k);
      const asRemainder = r.chance(0.5);
      return {
        stem: asRemainder
          ? `Find the remainder when ${m(`f(x) = ${poly(co)}`)} is divided by ${m(factorText(k))}.`
          : `If ${m(`f(x) = ${poly(co)}`)}, what is the value of ${m(`f(${k})`)}?`,
        answer: String(ans),
        wrong: [String(evalPoly(co, -k)), String(evalPoly(co, 1)), String(ans - 2 * co[3]), String(ans + k)],
        explanation: `${asRemainder ? `By the remainder theorem, the remainder when ${m('f(x)')} is divided by ${m(factorText(k))} is ${m(`f(${k})`)}.\n` : ''}${m(`f(${k}) = ${substitute(co, k)} = ${ans}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/factor-theorem',
    topic: [POLY, 'Factor and remainder theorems'],
    difficulty: 3,
    make: (r) => {
      const p = r.int(-5, 5);
      const q = r.int(-6, 6);
      const k = r.pick([-3, -2, -1, 1, 2, 3]);
      const rr = -(k ** 3 + p * k * k + q * k);
      const slip = -((-k) ** 3 + p * k * k - q * k); // used x = -k
      return {
        stem: `If ${m(factorText(k))} is a factor of ${m(`${poly([1, p, q, 0])} + r`)}, find the value of ${m('r')}.`,
        answer: String(rr),
        wrong: [String(slip), String(-rr), String(rr + 2 * k), String(rr - 1)],
        explanation: `If ${m(factorText(k))} is a factor, then ${m(`f(${k}) = 0`)} (factor theorem).\n${m(`(${k})^3 ${signed(p)}(${k})^2 ${signed(q)}(${k}) + r = 0`)}, so ${m(`${k ** 3 + p * k * k + q * k} + r = 0`)} and ${m(`r = ${rr}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/sum-product-of-roots',
    topic: [POLY, 'Roots of quadratic equations'],
    difficulty: 3,
    make: (r) => {
      const a = r.int(1, 4);
      const b = r.int(-9, 9);
      const c = r.int(-9, 9);
      if (b === 0 || c === 0 || b * b - 4 * a * c < 0) return null;
      const sum = new Frac(-b, a);
      const prod = new Frac(c, a);
      const eq = m(`${poly([a, b, c])} = 0`);
      const form = r.pick(['sum', 'product', 'reciprocals', 'squares'] as const);
      const t = (f: Frac) => m(f.tex());
      const base = `If ${m('\\alpha')} and ${m('\\beta')} are the roots of ${eq}, find `;
      const facts = `For ${m('ax^2 + bx + c = 0')}: ${m(`\\alpha + \\beta = -\\frac{b}{a} = ${sum.tex()}`)} and ${m(`\\alpha\\beta = \\frac{c}{a} = ${prod.tex()}`)}.`;
      if (form === 'sum') return { stem: `${base}${m('\\alpha + \\beta')}.`, answer: t(sum), wrong: [t(sum.neg()), t(prod), t(prod.neg())], explanation: facts, difficulty: 2 };
      if (form === 'product') return { stem: `${base}${m('\\alpha\\beta')}.`, answer: t(prod), wrong: [t(prod.neg()), t(sum), t(sum.neg())], explanation: facts, difficulty: 2 };
      if (form === 'reciprocals') {
        const ans = sum.div(prod);
        return {
          stem: `${base}${m('\\frac{1}{\\alpha} + \\frac{1}{\\beta}')}.`,
          answer: t(ans),
          wrong: [t(ans.neg()), t(prod.div(sum)), t(prod.div(sum).neg())],
          explanation: `${facts}\n${m(`\\frac{1}{\\alpha} + \\frac{1}{\\beta} = \\frac{\\alpha + \\beta}{\\alpha\\beta} = ${ans.tex()}`)}.`,
        };
      }
      const ans = sum.mul(sum).sub(prod.mul(2));
      return {
        stem: `${base}${m('\\alpha^2 + \\beta^2')}.`,
        answer: t(ans),
        wrong: [t(sum.mul(sum).add(prod.mul(2))), t(sum.mul(sum).sub(prod)), t(sum.mul(sum))],
        explanation: `${facts}\n${m(`\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2 - 2\\alpha\\beta = ${ans.tex()}`)}.`,
        difficulty: 4,
      };
    },
  },
  {
    key: 'jamb-maths/solve-quadratic',
    topic: [POLY, 'Roots of quadratic equations'],
    difficulty: 2,
    make: (r) => {
      const r1 = r.int(-9, 9);
      const r2 = r.int(-9, 9);
      if (r1 === 0 || r2 === 0 || r1 === r2 || r1 === -r2) return null;
      const k = r.pick([1, 1, 1, 2, 3]);
      const co = [k, -k * (r1 + r2), k * r1 * r2];
      return {
        stem: `Solve the equation ${m(`${poly(co)} = 0`)}.`,
        answer: rootsText(r1, r2),
        wrong: [rootsText(-r1, -r2), rootsText(r1, -r2), rootsText(-r1, r2)],
        explanation: `${k > 1 ? `Divide through by ${k}: ${m(`${poly([1, -(r1 + r2), r1 * r2])} = 0`)}.\n` : ''}Find two numbers that multiply to ${r1 * r2} and add to ${-(r1 + r2)}: they are ${-r1} and ${-r2}.\nSo ${m(`(x ${signed(-r1)})(x ${signed(-r2)}) = 0`)}, giving ${rootsText(r1, r2)}.`,
        difficulty: k > 1 ? 3 : 2,
      };
    },
  },
  {
    key: 'jamb-maths/change-of-subject',
    topic: [POLY, 'Factorisation and change of subject'],
    difficulty: 3,
    make: (r) => {
      const [A, B, C, D] = letters(r, 4);
      const patterns = [
        () => ({ f: `${A} = ${B} + ${C}${D}`, s: D, ans: `\\frac{${A} - ${B}}{${C}}`, wrong: [`\\frac{${A} + ${B}}{${C}}`, `${C}(${A} - ${B})`, `\\frac{${A}}{${C}} - ${B}`], steps: `Subtract ${m(B)} from both sides: ${m(`${A} - ${B} = ${C}${D}`)}. Divide by ${m(C)}.`, d: 2 }),
        () => ({ f: `${A} = \\frac{${B}${C}}{${C} + ${D}}`, s: D, ans: `\\frac{${C}(${B} - ${A})}{${A}}`, wrong: [`\\frac{${C}(${A} - ${B})}{${A}}`, `\\frac{${A}(${B} - ${C})}{${C}}`, `\\frac{${B}${C} - ${A}}{${C}}`], steps: `Multiply both sides by ${m(`(${C} + ${D})`)}: ${m(`${A}${C} + ${A}${D} = ${B}${C}`)}.\nSo ${m(`${A}${D} = ${B}${C} - ${A}${C} = ${C}(${B} - ${A})`)}. Divide by ${m(A)}.`, d: 3 }),
        () => ({ f: `${A} = 2\\pi\\sqrt{\\frac{${B}}{${C}}}`, s: B, ans: `\\frac{${C}${A}^2}{4\\pi^2}`, wrong: [`\\frac{${A}^2}{4\\pi^2 ${C}}`, `\\frac{${C}${A}}{2\\pi}`, `\\frac{4\\pi^2 ${C}}{${A}^2}`], steps: `Divide by ${m('2\\pi')} and square both sides: ${m(`\\frac{${A}^2}{4\\pi^2} = \\frac{${B}}{${C}}`)}. Multiply by ${m(C)}.`, d: 3 }),
        () => ({ f: `\\frac{1}{${A}} = \\frac{1}{${B}} + \\frac{1}{${C}}`, s: C, ans: `\\frac{${A}${B}}{${B} - ${A}}`, wrong: [`\\frac{${A}${B}}{${A} - ${B}}`, `${B} - ${A}`, `\\frac{${B} - ${A}}{${A}${B}}`], steps: `${m(`\\frac{1}{${C}} = \\frac{1}{${A}} - \\frac{1}{${B}} = \\frac{${B} - ${A}}{${A}${B}}`)}. Turn both sides upside down.`, d: 3 }),
        () => ({ f: `${A} = \\frac{${B}}{2}(${C} + ${D})`, s: C, ans: `\\frac{2${A}}{${B}} - ${D}`, wrong: [`\\frac{2${A} - ${D}}{${B}}`, `\\frac{${A}}{2${B}} - ${D}`, `\\frac{2${A}}{${B}} + ${D}`], steps: `Multiply by 2 and divide by ${m(B)}: ${m(`\\frac{2${A}}{${B}} = ${C} + ${D}`)}. Subtract ${m(D)}.`, d: 2 }),
        () => {
          const k = r.pick([3, 5, 12, 15]);
          return { f: `${A} = \\left(\\frac{${B}(${C} - ${D})}{${k}}\\right)^{\\frac{1}{3}}`, s: D, ans: `${C} - \\frac{${k}${A}^3}{${B}}`, wrong: [`\\frac{${k}${C} - ${B}}{${A}^3}`, `\\frac{${C} - ${k}${A}^3}{${B}}`, `${C} + \\frac{${k}${A}^3}{${B}}`], steps: `Cube both sides: ${m(`${A}^3 = \\frac{${B}(${C} - ${D})}{${k}}`)}, so ${m(`${C} - ${D} = \\frac{${k}${A}^3}{${B}}`)}. Rearrange for ${m(D)}.`, d: 4 };
        },
        () => ({ f: `${A} = \\frac{${B}${C} + ${D}}{${C} - 1}`, s: C, ans: `\\frac{${A} + ${D}}{${A} - ${B}}`, wrong: [`\\frac{${A} - ${D}}{${A} - ${B}}`, `\\frac{${A} + ${D}}{${B} - ${A}}`, `\\frac{${D} - ${A}}{${A} + ${B}}`], steps: `Multiply out: ${m(`${A}${C} - ${A} = ${B}${C} + ${D}`)}.\nCollect the ${m(C)} terms: ${m(`${A}${C} - ${B}${C} = ${A} + ${D}`)}, so ${m(`${C}(${A} - ${B}) = ${A} + ${D}`)}.`, d: 4 }),
      ];
      const p = r.pick(patterns)();
      return {
        stem: `Make ${m(p.s)} the subject of the formula ${m(p.f)}.`,
        answer: m(`${p.s} = ${p.ans}`),
        wrong: p.wrong.map((w) => m(`${p.s} = ${w}`)),
        explanation: `${p.steps}\n${m(`${p.s} = ${p.ans}`)}.`,
        difficulty: p.d,
      };
    },
  },
  {
    key: 'jamb-maths/expand-products',
    topic: [POLY, 'Algebraic operations and expansion'],
    difficulty: 2,
    make: (r) => {
      const nz = (lo: number, hi: number) => {
        const x = r.int(lo, hi);
        return x === 0 ? 1 : x;
      };
      if (r.chance(0.55)) {
        const [a, b, c, d] = [nz(1, 4), nz(-7, 7), nz(-4, 4), nz(-7, 7)];
        const mid = a * d + b * c;
        if (mid === 0) return null;
        return {
          stem: `Expand ${m(`(${poly([a, b])})(${poly([c, d])})`)}.`,
          answer: m(poly([a * c, mid, b * d])),
          wrong: [m(poly([a * c, a * d - b * c, b * d])), m(poly([a * c, mid, -b * d])), m(poly([a * c, 0, b * d])), m(poly([a * c, -mid, b * d]))],
          explanation: `Multiply each term in the first bracket by each in the second:\n${m(`${poly([a, 0])} \\times ${poly([c, d])} = ${poly([a * c, a * d, 0])}`)} and ${m(`${b} \\times (${poly([c, d])}) = ${poly([b * c, b * d])}`)}.\nAdd: ${m(poly([a * c, mid, b * d]))}.`,
        };
      }
      const [p, q, rr, s, t] = [nz(1, 3), nz(-5, 5), nz(-3, 3), nz(-5, 5), nz(-5, 5)];
      const co = [p * rr, p * s + q * rr, p * t + q * s, q * t];
      if (co.some((x) => x === 0)) return null;
      const flip = (i: number) => co.map((x, j) => (j === i ? -x : x));
      return {
        stem: `What is the product of ${m(poly([rr, s, t]))} and ${m(poly([p, q]))}?`,
        answer: m(poly(co)),
        wrong: [m(poly(flip(1))), m(poly(flip(2))), m(poly(flip(3))), m(poly(flip(0)))],
        explanation: `${m(`${poly([p, 0])}(${poly([rr, s, t])}) = ${poly([p * rr, p * s, p * t, 0])}`)}\n${m(`${q}(${poly([rr, s, t])}) = ${poly([q * rr, q * s, q * t])}`)}\nCollect like terms: ${m(poly(co))}.`,
        difficulty: 3,
      };
    },
  },

  // ── Indices, logarithms and surds ───────────────────────────
  {
    key: 'jamb-maths/evaluate-indices',
    topic: [INDICES, 'Laws of indices'],
    difficulty: 2,
    make: (r) => {
      const powers: [number, number][] = [[2, 2], [2, 3], [2, 4], [2, 5], [3, 2], [3, 3], [3, 4], [3, 5], [5, 2], [5, 3]];
      const terms = r.shuffle(powers).slice(0, r.pick([2, 3])).map(([b, k]) => {
        const q = r.pick([k, k, ...[2, 3, 4, 5].filter((d) => k % d === 0)]);
        const p = r.pick([-3, -2, -1, 1, 2, 3]);
        return { b, k, p, q };
      });
      const valueOf = (ts: typeof terms) => ts.reduce((acc, t) => {
        const e = (t.k * t.p) / t.q;
        return acc.mul(e >= 0 ? new Frac(t.b ** e) : new Frac(1, t.b ** -e));
      }, new Frac(1));
      if (terms.some((t) => !isInt((t.k * t.p) / t.q) || Math.abs((t.k * t.p) / t.q) > 4)) return null;
      const ans = valueOf(terms);
      if (ans.n > 2000 || ans.d > 2000) return null;
      const show = (t: (typeof terms)[number]) => `${t.b ** t.k}^{${t.p < 0 ? '-' : ''}\\frac{${Math.abs(t.p)}}{${t.q}}}`;
      return {
        stem: `Simplify ${m(terms.map(show).join(' \\times '))}.`,
        answer: m(ans.tex()),
        wrong: [m(new Frac(ans.d, ans.n).tex()), m(valueOf(terms.map((t, i) => (i === 0 ? { ...t, p: -t.p } : t))).tex()), m(valueOf(terms.map((t) => ({ ...t, p: Math.abs(t.p) }))).tex()), m(ans.mul(ans.d === 1 ? 2 : new Frac(1, 2)).tex())],
        explanation: `Write each number as a power of a prime, then multiply the indices:\n${terms.map((t) => m(`${show(t)} = (${t.b}^{${t.k}})^{${new Frac(t.p, t.q).tex()}} = ${t.b}^{${(t.k * t.p) / t.q}}`)).join('\n')}\nSo the product is ${m(ans.tex())}.`,
      };
    },
  },
  {
    key: 'jamb-maths/exponential-equation',
    topic: [INDICES, 'Laws of indices'],
    difficulty: 3,
    make: (r) => {
      const b = r.pick([2, 3, 5]);
      const [p, q] = r.shuffle([1, 2, 3, 4]).slice(0, 2);
      if (b === 5 && Math.max(p, q) > 3) return null;
      const x = r.int(-4, 6);
      const c1 = r.int(-3, 3);
      const c2 = (p * (x + c1)) / q - x;
      if (!isInt(c2) || c1 === c2) return null;
      const side = (e: number, c: number) => `${b ** e}^{x ${signed(c)}}`.replace(/\^\{x \+ 0\}/, '^{x}');
      const swapped = (p * c2 - q * c1) / (q - p);
      const times = (k: number, c: number) => (c === 0 ? (k === 1 ? 'x' : `${k}x`) : k === 1 ? `x ${signed(c)}` : `${k}(x ${signed(c)})`);
      return {
        stem: `Solve for ${m('x')}: ${m(`${side(p, c1)} = ${side(q, c2)}`)}.`,
        answer: m(`x = ${x}`),
        wrong: [m(`x = ${-x}`), m(`x = ${isInt(swapped) ? swapped : x + 2}`), m(`x = ${x + 1}`), m(`x = ${x - 2}`)],
        explanation: `Write both sides as powers of ${b}: ${m(`${b}^{${times(p, c1)}} = ${b}^{${times(q, c2)}}`)}.\nEquate the indices: ${m(`${times(p, c1)} = ${times(q, c2)}`)}, so ${p - q === 1 ? m(`x = ${x}`) : `${m(`${poly([p - q, 0])} = ${q * c2 - p * c1}`)} and ${m(`x = ${x}`)}`}.`,
      };
    },
  },
  {
    key: 'jamb-maths/evaluate-logs',
    topic: [INDICES, 'Logarithms and change of base'],
    difficulty: 2,
    make: (r) => {
      const [b1, b2] = [r.pick([2, 3, 4, 5, 10]), r.pick([2, 3, 5, 10])];
      const e1 = r.int(-3, 4);
      const e2 = r.int(-3, 4);
      if (e1 === 0 || e2 === 0 || Math.abs(b1 ** e1) > 1000 || Math.abs(b2 ** e2) > 1000) return null;
      const plus = r.chance(0.5);
      const ans = plus ? e1 + e2 : e1 - e2;
      const term = (b: number, e: number) => `\\log_{${b}} ${powerAsNumber(b, e)}`;
      return {
        stem: `Evaluate ${m(`${term(b1, e1)} ${plus ? '+' : '-'} ${term(b2, e2)}`)}.`,
        answer: String(ans),
        wrong: [String(plus ? e1 - e2 : e1 + e2), String(-ans), String(e1 * e2), String(Math.abs(e1) + Math.abs(e2))],
        explanation: `${m(`\\log_{${b1}} ${powerAsNumber(b1, e1)} = ${e1}`)} because ${m(`${b1}^{${e1}} = ${powerAsNumber(b1, e1)}`)}.\n${m(`\\log_{${b2}} ${powerAsNumber(b2, e2)} = ${e2}`)} because ${m(`${b2}^{${e2}} = ${powerAsNumber(b2, e2)}`)}.\nSo the answer is ${m(`${e1} ${plus ? '+' : '-'} (${e2}) = ${ans}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/log-laws',
    topic: [INDICES, 'Logarithms and change of base'],
    difficulty: 2,
    make: (r) => {
      const A = r.pick([2, 4, 5, 8, 20, 25, 40, 50, 80, 125, 200, 250, 400, 500]);
      const B = r.pick([2, 4, 5, 8, 20, 25, 40, 50, 80, 125, 200, 250, 400, 500]);
      const k = r.int(1, 3);
      const C = (A * B) / 10 ** k;
      if (!isInt(C) || C < 2 || C === A || C === B || A === B) return null;
      return {
        stem: `Simplify ${m(`\\log_{10} ${A} + \\log_{10} ${B} - \\log_{10} ${C}`)}.`,
        answer: String(k),
        wrong: [String(k + 1), String(-k), m(`\\log_{10} ${A + B - C}`), String(k - 1 === 0 ? k + 2 : k - 1)],
        explanation: `${m('\\log a + \\log b - \\log c = \\log\\frac{ab}{c}')}.\n${m(`\\frac{${A} \\times ${B}}{${C}} = ${num(10 ** k)}`)}, and ${m(`\\log_{10} ${num(10 ** k)} = ${k}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/simplify-surds',
    topic: [INDICES, 'Surds and rationalisation'],
    difficulty: 2,
    make: (r) => {
      const a = r.pick([2, 3, 5, 6, 7]);
      const [k1, k2, k3] = r.shuffle([1, 2, 3, 4, 5]).slice(0, 3);
      const [p, q, s] = [r.int(1, 5), r.int(1, 5), r.int(1, 5)];
      if ([k1, k2, k3].some((k) => a * k * k > 200)) return null;
      const C = p * k1 + q * k2 - s * k3;
      if (C === 0) return null;
      const show = (c: number, k: number) => `${c === 1 ? '' : c}\\sqrt{${a * k * k}}`;
      return {
        stem: `Simplify ${m(`${show(p, k1)} + ${show(q, k2)} - ${show(s, k3)}`)}.`,
        answer: m(surd(C, a)),
        wrong: [m(surd(-C, a)), m(surd(p * k1 + q * k2 + s * k3, a)), m(String(C)), m(surd(C + 1 === 0 ? C + 2 : C + 1, a))],
        explanation: `Take out square factors: ${[[p, k1], [q, k2], [s, k3]].map(([c, k]) => m(`${show(c, k)} = ${c * k === 1 ? '' : c * k}\\sqrt{${a}}`)).join(', ')}.\nSo the total is ${m(`(${p * k1} + ${q * k2} - ${s * k3})\\sqrt{${a}} = ${surd(C, a)}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/rationalise-surds',
    topic: [INDICES, 'Surds and rationalisation'],
    difficulty: 3,
    make: (r) => {
      const [a, b] = r.shuffle([2, 3, 5, 6, 7]).slice(0, 2);
      const plusTop = r.chance(0.5);
      const D = a - b;
      const c0 = 2 * (plusTop ? 1 : -1); // numerator: (a + b) ± 2√(ab)
      // √(ab) → s√t
      let s = 1;
      let t = a * b;
      for (let k = Math.floor(Math.sqrt(t)); k > 1; k--) if (t % (k * k) === 0) { s = k; t /= k * k; break; }
      const A = (a + b) / D;
      const B = (c0 * s) / D;
      if (!isInt(A) || !isInt(B) || t === 1) return null;
      const show = (x: number, y: number) => `${x} ${y < 0 ? '-' : '+'} ${surd(Math.abs(y), t)}`;
      const top = plusTop ? `\\sqrt{${a}} + \\sqrt{${b}}` : `\\sqrt{${a}} - \\sqrt{${b}}`;
      const bottom = plusTop ? `\\sqrt{${a}} - \\sqrt{${b}}` : `\\sqrt{${a}} + \\sqrt{${b}}`;
      return {
        stem: `Rationalise ${m(`\\frac{${top}}{${bottom}}`)}.`,
        answer: m(show(A, B)),
        wrong: [m(show(A, -B)), m(show(-A, B)), m(show(-A, -B))],
        explanation: `Multiply top and bottom by ${m(top)} (the conjugate of the denominator).\nBottom: ${m(`${a} - ${b} = ${D}`)}. Top: ${m(`(${top})^2 = ${a + b} ${plusTop ? '+' : '-'} 2\\sqrt{${a * b}}`)}.\nDivide by ${D}: ${m(show(A, B))}.`,
      };
    },
  },

  // ── Variation ───────────────────────────────────────────────
  {
    key: 'jamb-maths/variation',
    topic: ['Variation', 'Direct and inverse variation'],
    difficulty: 2,
    make: (r) => {
      const [y, x] = letters(r, 2).map((l) => l.toUpperCase());
      const kind = r.pick(['direct', 'inverse', 'square', 'inverse square'] as const);
      const f = { direct: (k: Frac, v: number) => k.mul(v), inverse: (k: Frac, v: number) => k.div(v), square: (k: Frac, v: number) => k.mul(v * v), 'inverse square': (k: Frac, v: number) => k.div(v * v) };
      const x1 = r.int(2, 9);
      const x2 = r.int(2, 12);
      if (x1 === x2) return null;
      const y1 = r.int(2, 40);
      const k = kind === 'direct' ? new Frac(y1, x1) : kind === 'inverse' ? new Frac(y1 * x1) : kind === 'square' ? new Frac(y1, x1 * x1) : new Frac(y1 * x1 * x1);
      const y2 = f[kind](k, x2);
      if (!y2.isInt && y2.d > 10) return null;
      const phrase = { direct: 'directly as', inverse: 'inversely as', square: 'directly as the square of', 'inverse square': 'inversely as the square of' }[kind];
      const law = { direct: `${y} = k${x}`, inverse: `${y} = \\frac{k}{${x}}`, square: `${y} = k${x}^2`, 'inverse square': `${y} = \\frac{k}{${x}^2}` }[kind];
      const others = (Object.keys(f) as (keyof typeof f)[]).filter((o) => o !== kind).map((o) => {
        const kk = o === 'direct' ? new Frac(y1, x1) : o === 'inverse' ? new Frac(y1 * x1) : o === 'square' ? new Frac(y1, x1 * x1) : new Frac(y1 * x1 * x1);
        return m(f[o](kk, x2).tex());
      });
      return {
        stem: `${m(y)} varies ${phrase} ${m(x)}. If ${m(`${y} = ${y1}`)} when ${m(`${x} = ${x1}`)}, find ${m(y)} when ${m(`${x} = ${x2}`)}.`,
        answer: m(y2.tex()),
        wrong: [...others, m(k.tex())],
        explanation: `${m(law)}. Using ${m(`${y} = ${y1}, ${x} = ${x1}`)}: ${m(`k = ${k.tex()}`)}.\nWhen ${m(`${x} = ${x2}`)}: ${m(`${y} = ${y2.tex()}`)}.`,
        difficulty: kind.includes('square') ? 3 : 2,
      };
    },
  },
  {
    key: 'jamb-maths/joint-variation',
    topic: ['Variation', 'Joint and partial variation'],
    difficulty: 3,
    make: (r) => {
      // M varies directly as N and inversely as the square root of P.
      // Built backwards so every value is a whole number: N is a multiple of √P.
      const k = new Frac(r.int(1, 6));
      const s1 = r.int(2, 7); // √P₁
      const n1 = s1 * r.int(1, 3);
      const s2 = r.int(2, 9);
      const n2 = s2 * r.int(1, 3);
      const m1 = k.mul(n1).div(s1);
      const m2 = k.mul(n2).div(s2);
      if (s1 === s2 || n1 === n2) return null;
      const [M, N, P] = ['M', 'N', 'P'];
      return {
        stem: `${M} varies directly as ${N} and inversely as the square root of ${P}. If ${m(`${M} = ${m1.n}`)} when ${m(`${N} = ${n1}`)} and ${m(`${P} = ${s1 * s1}`)}, find ${m(P)} when ${m(`${M} = ${m2.n}`)} and ${m(`${N} = ${n2}`)}.`,
        answer: String(s2 * s2),
        wrong: [String(s2), String(s2 * s2 * 2), String((s2 + 1) ** 2), String(Math.round((n2 * s1 * s1) / n1))],
        explanation: `${m(`${M} = \\frac{k${N}}{\\sqrt{${P}}}`)}. Using the first values: ${m(`${m1.n} = \\frac{k \\times ${n1}}{${s1}}`)}, so ${m(`k = ${k.tex()}`)}.\nThen ${m(`${m2.n} = \\frac{${k.tex()} \\times ${n2}}{\\sqrt{${P}}}`)}, so ${m(`\\sqrt{${P}} = ${s2}`)} and ${m(`${P} = ${s2 * s2}`)}.`,
      };
    },
  },

  // ── Inequalities ────────────────────────────────────────────
  {
    key: 'jamb-maths/linear-inequality',
    topic: ['Inequalities', 'Linear inequalities in one variable'],
    difficulty: 2,
    make: (r) => {
      const ops = ['<', '>', '\\leq', '\\geq'] as const;
      const flipOp = { '<': '>', '>': '<', '\\leq': '\\geq', '\\geq': '\\leq' } as const;
      const op = r.pick(ops);
      const x0 = r.int(-8, 8);
      if (r.chance(0.6)) {
        const a = r.int(-5, 6);
        const c = r.int(-5, 6);
        if (a === c || a === 0) return null;
        const b = r.int(-12, 12);
        const d = (a - c) * x0 + b;
        const final = a - c < 0 ? flipOp[op] : op;
        return {
          stem: `Solve the inequality ${m(`${poly([a, b])} ${op} ${poly([c, d])}`)}.`,
          answer: m(`x ${final} ${x0}`),
          wrong: [m(`x ${flipOp[final]} ${x0}`), m(`x ${final} ${-x0}`), m(`x ${flipOp[final]} ${-x0}`)],
          explanation: `Collect ${m('x')} terms on the left: ${m(`${poly([a - c, 0])} ${op} ${d - b}`)}.\n${a - c < 0 ? `Dividing by a negative number (${a - c}) reverses the sign` : `Divide by ${a - c}`}: ${m(`x ${final} ${x0}`)}.`,
          difficulty: a - c < 0 ? 3 : 2,
        };
      }
      // Fractions: (x + p)/mm − (x + q)/nn op k
      const [mm, nn] = r.shuffle([2, 3, 4, 5, 6]).slice(0, 2);
      const p = r.int(-6, 6);
      const q = r.int(-6, 6);
      const lhsAt = (x: number) => new Frac(x + p, mm).sub(new Frac(x + q, nn));
      const k = lhsAt(x0);
      if (!k.isInt) return null;
      const coef = nn - mm; // after multiplying by mm·nn: (nn − mm)x op …
      const final = coef < 0 ? flipOp[op] : op;
      return {
        stem: `Find the values of ${m('x')} for which ${m(`\\frac{x ${signed(p)}}{${mm}} - \\frac{x ${signed(q)}}{${nn}} ${op} ${k.n}`)}.`.replace(/x \+ 0/g, 'x'),
        answer: m(`x ${final} ${x0}`),
        wrong: [m(`x ${flipOp[final]} ${x0}`), m(`x ${final} ${-x0}`), m(`x ${flipOp[final]} ${-x0}`)],
        explanation: `Multiply through by ${mm * nn}: ${m(`${nn}(x ${signed(p)}) - ${mm}(x ${signed(q)}) ${op} ${k.n * mm * nn}`)}.\nSo ${m(`${poly([coef, 0])} ${op} ${k.n * mm * nn - nn * p + mm * q}`)}${coef < 0 ? ', and dividing by a negative number reverses the sign' : ''}: ${m(`x ${final} ${x0}`)}.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-maths/quadratic-inequality',
    topic: ['Inequalities', 'Quadratic inequalities'],
    difficulty: 3,
    make: (r) => {
      const r1 = r.int(-7, 6);
      const r2 = r1 + r.int(1, 7);
      const op = r.pick(['\\leq', '<', '\\geq', '>'] as const);
      const strict = op === '<' || op === '>';
      const le = strict ? '<' : '\\leq';
      const ge = strict ? '>' : '\\geq';
      const between = (a: number, b: number) => m(`${a} ${le} x ${le} ${b}`);
      const outside = (a: number, b: number) => m(`x ${le} ${a} \\text{ or } x ${ge} ${b}`);
      const below = op === '\\leq' || op === '<';
      if (r1 === -r2) return null;
      return {
        stem: `Find the range of values of ${m('x')} for which ${m(`${poly([1, -(r1 + r2), r1 * r2])} ${op} 0`)}.`,
        answer: below ? between(r1, r2) : outside(r1, r2),
        wrong: [below ? outside(r1, r2) : between(r1, r2), between(-r2, -r1), outside(-r2, -r1)],
        explanation: `Factorise: ${m(`(x ${signed(-r1)})(x ${signed(-r2)}) ${op} 0`)}. The roots are ${r1} and ${r2}.\nThe graph is a U-shape, so it is ${below ? 'below' : 'above'} zero ${below ? 'between' : 'outside'} the roots: ${below ? between(r1, r2) : outside(r1, r2)}.`,
      };
    },
  },

  // ── Binary operations ───────────────────────────────────────
  {
    key: 'jamb-maths/binary-operation',
    topic: ['Binary Operations', 'Definition and closure property'],
    difficulty: 2,
    make: (r) => {
      const op = r.pick(['*', '\\Delta', '\\oplus', '\\circ']);
      const [p, q, k] = [r.int(1, 5), r.int(1, 5), r.int(-5, 5)];
      if (p === q) return null;
      const f = (x: number, y: number) => p * x + q * y + k;
      const def = `x ${op} y = ${poly([p, 0], 'x')} + ${poly([q, 0], 'y')}${k ? ` ${signed(k)}` : ''}`;
      const [a, b, c] = [r.int(-4, 6), r.int(-4, 6), r.int(-3, 5)];
      if (r.chance(0.5)) {
        const ans = f(a, b);
        return {
          stem: `A binary operation ${m(op)} is defined on the set of real numbers by ${m(def)}. Find ${m(`${a} ${op} ${b < 0 ? `(${b})` : b}`)}.`,
          answer: String(ans),
          wrong: [String(f(b, a)), String(ans - k), String(p * a * q * b + k), String(ans + 2)],
          explanation: `Put ${m(`x = ${a}`)} and ${m(`y = ${b}`)}: ${m(`${p}(${a}) + ${q}(${b})${k ? ` ${signed(k)}` : ''} = ${ans}`)}.`,
        };
      }
      const inner = f(a, b);
      const ans = f(inner, c);
      return {
        stem: `A binary operation ${m(op)} is defined by ${m(def)}. Find ${m(`(${a} ${op} ${b}) ${op} ${c}`)}.`,
        answer: String(ans),
        wrong: [String(f(a, f(b, c))), String(inner), String(f(c, inner)), String(ans - k)],
        explanation: `Work out the bracket first: ${m(`${a} ${op} ${b} = ${inner}`)}.\nThen ${m(`${inner} ${op} ${c} = ${p}(${inner}) + ${q}(${c})${k ? ` ${signed(k)}` : ''} = ${ans}`)}.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-maths/identity-element',
    topic: ['Binary Operations', 'Identity and inverse elements'],
    difficulty: 3,
    make: (r) => {
      const op = r.pick(['*', '\\oplus', '\\circ']);
      const k = r.int(-9, 9);
      if (k === 0) return null;
      return {
        stem: `A binary operation ${m(op)} is defined on the set of real numbers by ${m(`a ${op} b = a + b ${signed(k)}`)}. Find the identity element.`,
        answer: String(-k),
        wrong: [String(k), '0', '1', String(-2 * k)],
        explanation: `The identity ${m('e')} satisfies ${m(`a ${op} e = a`)}: ${m(`a + e ${signed(k)} = a`)}, so ${m(`e = ${-k}`)}.`,
      };
    },
  },

  // ── Progressions ────────────────────────────────────────────
  {
    key: 'jamb-maths/arithmetic-progression',
    topic: ['Progression', 'Arithmetic progression'],
    difficulty: 2,
    make: (r) => {
      const a = r.int(-10, 20);
      const d = r.pick([-5, -4, -3, -2, 2, 3, 4, 5, 6, 7]);
      const n = r.int(8, 30);
      const seq = [a, a + d, a + 2 * d].join(', ');
      if (r.chance(0.5)) {
        const ans = a + (n - 1) * d;
        return {
          stem: `Find the ${n}th term of the arithmetic progression ${seq}, …`,
          answer: String(ans),
          wrong: [String(a + n * d), String(a * n), String(a + (n - 1) * -d), String(ans - d * 2)],
          explanation: `${m('a = ' + a)}, ${m('d = ' + d)}. ${m(`T_n = a + (n - 1)d = ${a} + ${n - 1}(${d}) = ${ans}`)}.`,
        };
      }
      const ans = (n * (2 * a + (n - 1) * d)) / 2;
      return {
        stem: `Find the sum of the first ${n} terms of the arithmetic progression ${seq}, …`,
        answer: num(ans),
        wrong: [num((n * (2 * a + n * d)) / 2), num(n * (a + (n - 1) * d)), num((n * (a + (n - 1) * d)) / 2), num(ans + d)],
        explanation: `${m(`S_n = \\frac{n}{2}[2a + (n - 1)d] = \\frac{${n}}{2}[${2 * a} + ${n - 1}(${d})] = ${ans}`)}.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-maths/geometric-progression',
    topic: ['Progression', 'Geometric progression'],
    difficulty: 2,
    make: (r) => {
      const ratio = r.pick([new Frac(2), new Frac(3), new Frac(1, 2), new Frac(1, 3), new Frac(-2), new Frac(2, 3)]);
      const a = new Frac(r.pick([1, 2, 3, 4, 5, 6, 8, 9, 12, 16, 18, 24, 27, 32, 81]));
      const term = (n: number) => {
        let t = a;
        for (let i = 1; i < n; i++) t = t.mul(ratio);
        return t;
      };
      const kind = r.pick(['ratio', 'nth', 'infinity'] as const);
      if (kind === 'ratio') {
        const p = r.int(1, 3);
        const q = p + r.pick([2, 4]);
        if (ratio.n < 0 && (q - p) % 2 === 0) return null; // r⁴ = 16 doesn't settle the sign
        return {
          stem: `The ${p === 1 ? 'first' : p === 2 ? 'second' : 'third'} and ${['', '', '', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][q]} terms of a G.P. are ${m(term(p).tex())} and ${m(term(q).tex())}. Find the common ratio, given that it is positive.`,
          answer: m(ratio.tex()),
          wrong: [m(new Frac(ratio.d, ratio.n).tex()), m(ratio.mul(ratio).tex()), m(ratio.neg().tex())],
          explanation: `${m(`\\frac{T_${q}}{T_${p}} = r^{${q - p}}`)}: ${m(`\\frac{${term(q).tex()}}{${term(p).tex()}} = ${term(q).div(term(p)).tex()}`)}, so ${m(`r = ${ratio.tex()}`)}.`,
          difficulty: 3,
        };
      }
      if (kind === 'nth') {
        const n = r.int(5, 8);
        const t = term(n);
        if (t.n > 100000 || t.d > 100000) return null;
        return {
          stem: `Find the ${n}th term of the G.P. ${[1, 2, 3].map((i) => m(term(i).tex())).join(', ')}, …`,
          answer: m(t.tex()),
          wrong: [m(term(n + 1).tex()), m(term(n - 1).tex()), m(a.mul(ratio).mul(n - 1).tex())],
          explanation: `${m(`a = ${a.tex()}`)}, ${m(`r = ${ratio.tex()}`)}. ${m(`T_n = ar^{n-1} = ${a.tex()} \\times (${ratio.tex()})^{${n - 1}} = ${t.tex()}`)}.`,
        };
      }
      if (Math.abs(ratio.value) >= 1) return null;
      const s = a.div(new Frac(1).sub(ratio));
      return {
        stem: `Find the sum to infinity of the G.P. ${[1, 2, 3].map((i) => m(term(i).tex())).join(', ')}, …`,
        answer: m(s.tex()),
        wrong: [m(a.div(new Frac(1).add(ratio)).tex()), m(a.mul(new Frac(1).sub(ratio)).tex()), m(s.mul(2).tex())],
        explanation: `${m(`S_\\infty = \\frac{a}{1 - r} = \\frac{${a.tex()}}{1 - ${ratio.tex()}} = ${s.tex()}`)}.`,
        difficulty: 3,
      };
    },
  },

  // ── Sets ────────────────────────────────────────────────────
  {
    key: 'jamb-maths/venn-two-sets',
    topic: ['Sets', 'Applications of set theory'],
    difficulty: 2,
    make: (r) => {
      const [s1, s2] = r.shuffle(['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government', 'French', 'Literature']).slice(0, 2);
      const both = r.int(2, 20);
      const only1 = r.int(2, 25);
      const only2 = r.int(2, 25);
      const neither = r.int(0, 10);
      const N = both + only1 + only2 + neither;
      const a = both + only1;
      const b = both + only2;
      const askOnly = r.chance(0.35);
      const stem = `In a class of ${N} students, ${a} offer ${s1}, ${b} offer ${s2}${neither ? ` and ${neither} offer neither` : ', and every student offers at least one of them'}. How many students offer ${askOnly ? `${s1} only` : 'both subjects'}?`;
      const work = `${m(`n(A \\cup B) = ${N} - ${neither} = ${N - neither}`)}.\n${m(`n(A \\cap B) = n(A) + n(B) - n(A \\cup B) = ${a} + ${b} - ${N - neither} = ${both}`)}.`;
      if (askOnly) return { stem, answer: String(only1), wrong: [String(a), String(both), String(only2), String(N - b)], explanation: `${work}\n${s1} only = ${a} - ${both} = ${only1}.`, difficulty: 3 };
      return { stem, answer: String(both), wrong: [String(a + b - N), String(both + neither), String(N - neither), String(Math.abs(a - b))], explanation: work };
    },
  },
  {
    key: 'jamb-maths/set-operations',
    topic: ['Sets', 'Set operations and Venn diagrams'],
    difficulty: 2,
    make: (r) => {
      const U = Array.from({ length: 20 }, (_, i) => i + 1);
      const isPrime = (x: number) => x > 1 && [2, 3, 5, 7, 11, 13, 17, 19].includes(x);
      const defs = [
        ...[2, 3, 4, 5].map((k) => ({ text: `multiples of ${k}`, has: (x: number) => x % k === 0 })),
        { text: 'odd numbers', has: (x: number) => x % 2 === 1 },
        { text: 'even numbers', has: (x: number) => x % 2 === 0 },
        { text: 'prime numbers', has: isPrime },
        ...[12, 16, 18, 20].map((k) => ({ text: `factors of ${k}`, has: (x: number) => k % x === 0 })),
      ];
      const [A, B] = r.shuffle(defs).slice(0, 2);
      const inter = U.filter((x) => A.has(x) && B.has(x));
      const onlyA = U.filter((x) => A.has(x) && !B.has(x));
      const onlyB = U.filter((x) => B.has(x) && !A.has(x));
      const union = U.filter((x) => A.has(x) || B.has(x));
      if (!inter.length || inter.length > 8 || !onlyA.length || !onlyB.length) return null;
      const set = (xs: number[]) => m(`\\{${xs.join(', ')}\\}`);
      return {
        stem: `The universal set is ${m('\\mu = \\{x : 1 \\leq x \\leq 20\\}')}, where ${m('x')} is a whole number. ${m('A')} is the set of ${A.text} and ${m('B')} is the set of ${B.text}. Find ${m('A \\cap B')}.`,
        answer: set(inter),
        wrong: [set(onlyA), set(onlyB), union.length <= 12 ? set(union) : set(inter.slice(0, -1).concat(onlyA.slice(0, 1)).sort((a, b) => a - b))],
        explanation: `${m('A')} = ${set(U.filter(A.has))}.\n${m('B')} = ${set(U.filter(B.has))}.\nThe intersection has the members in both: ${set(inter)}.`,
      };
    },
  },

  // ── Number bases ────────────────────────────────────────────
  {
    key: 'jamb-maths/number-bases',
    topic: ['Number Bases', 'Operations in number bases'],
    difficulty: 2,
    make: (r) => {
      const toBase = (n: number, b: number) => n.toString(b);
      const word = (b: number) => `\\text{${WORDS[b]}}`;
      const kind = r.pick(['to-ten', 'from-ten', 'difference'] as const);
      if (kind === 'to-ten') {
        const b = r.int(2, 9);
        const n = r.int(b * b, b ** 4 - 1);
        const digits = toBase(n, b);
        if (digits.length > 5) return null;
        const terms = digits.split('').map((dch, i) => `${dch} \\times ${b}^${digits.length - 1 - i}`).join(' + ');
        return {
          stem: `Convert ${m(`${digits}_{${word(b)}}`)} to a number in base ten.`,
          answer: String(n),
          wrong: [digits === String(n) ? String(n + b) : digits, String(n + b), String(n - 1), String(parseInt(digits, b + 1))],
          explanation: `${m(`${digits}_{${word(b)}} = ${terms} = ${n}`)}.`,
        };
      }
      if (kind === 'from-ten') {
        const b = r.pick([2, 3, 4, 5, 6, 7, 8]);
        const n = r.int(b * 2, b === 2 ? 63 : 400);
        const digits = toBase(n, b);
        return {
          stem: `Express ${n} in base ${WORDS[b]}.`,
          answer: m(`${digits}_{${word(b)}}`),
          wrong: [m(`${digits.endsWith('0') ? toBase(n + b, b) : digits.split('').reverse().join('')}_{${word(b)}}`), m(`${toBase(n + 1, b)}_{${word(b)}}`), m(`${toBase(n - 1, b)}_{${word(b)}}`), m(`${toBase(n, b === 8 ? 7 : b + 1)}_{${word(b)}}`)],
          explanation: `Divide by ${b} repeatedly and read the remainders from the bottom up: ${n} = ${m(`${digits}_{${word(b)}}`)}.\nCheck: ${m(digits.split('').map((dch, i) => `${dch} \\times ${b}^${digits.length - 1 - i}`).join(' + '))} = ${n}.`,
        };
      }
      const b1 = r.int(5, 9);
      const b2 = b1 - 1;
      const digits = Array.from({ length: 3 }, (_, i) => r.int(i === 0 ? 1 : 0, b2 - 1)).join('');
      const v1 = parseInt(digits, b1);
      const v2 = parseInt(digits, b2);
      return {
        stem: `Calculate ${m(`${digits}_{${word(b1)}} - ${digits}_{${word(b2)}}`)}, giving your answer in base ten.`,
        answer: String(v1 - v2),
        wrong: ['0', String(v1 + v2), String(v1), String(v1 - v2 + b2)],
        explanation: `${m(`${digits}_{${word(b1)}} = ${v1}`)} and ${m(`${digits}_{${word(b2)}} = ${v2}`)} in base ten.\n${m(`${v1} - ${v2} = ${v1 - v2}`)}.`,
        difficulty: 3,
      };
    },
  },
];
