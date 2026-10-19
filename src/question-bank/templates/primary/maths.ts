import { Frac, gcd, m, NAMES, naira, num, type Template } from '../engine.js';

/**
 * Primary 1–5 Mathematics. Each template takes the class and scales its numbers to it, following
 * the NERDC primary scheme: counting and small sums in Primary 1, up to decimals and percentages in Primary 5.
 */

export type Cls = 1 | 2 | 3 | 4 | 5;
const NUM = 'Numbers';
const MEAS = 'Measurement';
const SHAPES = 'Shapes and Data';
const FRUITS = ['oranges', 'mangoes', 'sweets', 'pencils', 'biscuits', 'eggs', 'balloons'];
const big = (x: number) => num(x, undefined, 4);
/** The largest number each class works with. */
const LIMIT: Record<Cls, number> = { 1: 20, 2: 100, 3: 1000, 4: 10_000, 5: 100_000 };

export function primaryMaths(c: Cls): Template[] {
  const list: Template[] = [
    {
      key: 'pmaths/add-sub',
      topic: [NUM, 'Addition and subtraction'],
      difficulty: 1,
      make: (r) => {
        const max = LIMIT[c];
        const a = r.int(Math.ceil(max / 10), Math.floor(max * 0.6));
        const b = r.int(1, Math.floor(max * 0.4));
        const add = r.chance(0.5);
        const ans = add ? a + b : a - b;
        if (ans < 0) return null;
        const who = r.pick(NAMES);
        const thing = r.pick(FRUITS);
        const story = c <= 3 && r.chance(0.5);
        return {
          stem: story ? (add ? `${who} has ${big(a)} ${thing} and gets ${big(b)} more. How many ${thing} does ${who} have now?` : `${who} has ${big(a)} ${thing} and gives away ${big(b)}. How many are left?`) : `Work out ${big(a)} ${add ? '+' : '−'} ${big(b)}.`,
          answer: big(ans),
          wrong: [add ? a - b : a + b, ans + 1, ans - 1, ans + 10].filter((x) => x >= 0 && x !== ans).map(big),
          explanation: `${big(a)} ${add ? '+' : '−'} ${big(b)} = ${big(ans)}.${story ? (add ? ' “More” means add.' : ' “Gives away” means take away.') : ''}`,
        };
      },
    },
    {
      key: 'pmaths/place-value',
      topic: [NUM, 'Counting and place value'],
      difficulty: 1,
      make: (r) => {
        if (c === 1) {
          const n = r.int(1, 19);
          const kind = r.pick(['after', 'before', 'bigger'] as const);
          if (kind === 'bigger') {
            const x = r.int(1, 20);
            const y = r.int(1, 20);
            if (x === y) return null;
            return { stem: `Which number is bigger, ${x} or ${y}?`, answer: String(Math.max(x, y)), wrong: [String(Math.min(x, y)), String(Math.max(x, y) + 5), String(Math.abs(x - y))].filter((w) => w !== String(Math.max(x, y))), explanation: `${Math.max(x, y)} comes later when we count, so it is bigger.` };
          }
          const ans = kind === 'after' ? n + 1 : n - 1;
          if (ans < 0) return null;
          return { stem: `What number comes just ${kind} ${n}?`, answer: String(ans), wrong: [String(kind === 'after' ? n - 1 : n + 1), String(n), String(ans + 2)].filter((w) => w !== String(ans)), explanation: `Count: ${n - 1}, ${n}, ${n + 1}. The number just ${kind} ${n} is ${ans}.` };
        }
        const n = r.int(LIMIT[c] / 10 + 1, LIMIT[c] - 1);
        const digits = String(n);
        const pos = r.int(0, Math.min(digits.length - 1, 3));
        const d = Number(digits[digits.length - 1 - pos]);
        if (d === 0 || digits.split('').filter((x) => x === String(d)).length > 1) return null;
        const place = ['ones', 'tens', 'hundreds', 'thousands'][pos];
        const value = d * 10 ** pos;
        return {
          stem: `What is the value of the digit ${d} in ${big(n)}?`,
          answer: big(value),
          wrong: [d, value * 10, value / 10, d * 10 ** (pos + 2)].filter((x) => Number.isInteger(x) && x !== value).map(big),
          explanation: `The ${d} is in the ${place} place, so it is worth ${d} × ${big(10 ** pos)} = ${big(value)}.`,
        };
      },
    },
    {
      key: 'pmaths/money',
      topic: [MEAS, 'Money'],
      difficulty: c <= 2 ? 1 : 2,
      make: (r) => {
        const who = r.pick(NAMES);
        if (c <= 2) {
          const notes = c === 1 ? [5, 10, 20] : [5, 10, 20, 50];
          const [x, y] = [r.pick(notes), r.pick(notes)];
          return {
            stem: `${who} has a ₦${x} note and a ₦${y} note. How much money is that altogether?`,
            answer: naira(x + y),
            wrong: [Math.abs(x - y) || x + y + 10, x + y + 5, x * y].filter((w) => w !== x + y).map(naira),
            explanation: `₦${x} + ₦${y} = ${naira(x + y)}.`,
          };
        }
        const price = c === 3 ? r.pick([20, 30, 50, 70, 80]) : r.pick([150, 250, 300, 450, 600, 750]);
        const n = r.int(2, c === 3 ? 4 : 6);
        const pay = [100, 200, 500, 1000, 2000, 5000].find((x) => x > price * n)!;
        return {
          stem: `${who} buys ${n} pencils at ${naira(price)} each and pays with ${naira(pay)}. How much change does ${who} get?`,
          answer: naira(pay - price * n),
          wrong: [price * n, pay - price, pay - price * n + price].filter((w) => w > 0 && w !== pay - price * n).map(naira),
          explanation: `Cost: ${n} × ${naira(price)} = ${naira(price * n)}. Change: ${naira(pay)} − ${naira(price * n)} = ${naira(pay - price * n)}.`,
        };
      },
    },
    {
      key: 'pmaths/time',
      topic: [MEAS, 'Time'],
      difficulty: 1,
      make: (r) => {
        const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        if (c <= 2) {
          const months = c === 2 && r.chance(0.5);
          const listX = months ? MONTHS : DAYS;
          const i = r.int(0, listX.length - 2);
          return {
            stem: `Which ${months ? 'month' : 'day'} comes after ${listX[i]}?`,
            answer: listX[i + 1],
            wrong: [listX[(i + 2) % listX.length], listX[(i - 1 + listX.length) % listX.length], listX[(i + 3) % listX.length]],
            explanation: `In order: ${listX[i]}, then ${listX[i + 1]}.`,
          };
        }
        if (c === 3) {
          const [unit, per, a, w] = r.pick([
            ['hours', 'one day', '24', ['12', '60', '7']],
            ['minutes', 'one hour', '60', ['24', '100', '30']],
            ['days', 'one week', '7', ['5', '10', '12']],
            ['months', 'one year', '12', ['10', '7', '52']],
            ['seconds', 'one minute', '60', ['100', '24', '30']],
          ] as [string, string, string, string[]][]);
          return { stem: `How many ${unit} are in ${per}?`, answer: a, wrong: w, explanation: `There are ${a} ${unit} in ${per}.` };
        }
        const start = r.int(7, 14) * 60 + r.pick([0, 15, 30, 45]);
        const dur = c === 4 ? r.pick([30, 45, 60, 90, 120]) : r.int(35, 175);
        const fmt = (t: number) => `${Math.floor(t / 60) % 12 || 12}:${String(t % 60).padStart(2, '0')} ${Math.floor(t / 60) < 12 ? 'a.m.' : 'p.m.'}`;
        return {
          stem: `A football match starts at ${fmt(start)} and lasts ${dur >= 60 ? `${Math.floor(dur / 60)} hour${dur >= 120 ? 's' : ''}` : ''}${dur % 60 ? `${dur >= 60 ? ' ' : ''}${dur % 60} minutes` : ''}. What time does it end?`,
          answer: fmt(start + dur),
          wrong: [start + dur + 30, start + dur - 15, start + dur + 60].map(fmt),
          explanation: `Add the time on: ${fmt(start)} + ${Math.floor(dur / 60)} h ${dur % 60} min = ${fmt(start + dur)}`,
        };
      },
    },
    {
      key: 'pmaths/shapes-measure',
      topic: [SHAPES, 'Shapes and measuring'],
      difficulty: c <= 2 ? 1 : 2,
      make: (r) => {
        if (c <= 2) {
          const [shape, sides] = r.pick([
            ['triangle', 3],
            ['square', 4],
            ['rectangle', 4],
            ['pentagon', 5],
            ['hexagon', 6],
          ] as const);
          return { stem: `How many sides does a ${shape} have?`, answer: String(sides), wrong: [3, 4, 5, 6, 8].filter((x) => x !== sides).map(String), explanation: `A ${shape} has ${sides} straight sides.` };
        }
        if (c === 3) {
          const metres = r.int(2, 9);
          return { stem: `How many centimetres are there in ${metres} metres?`, answer: big(metres * 100), wrong: [metres * 10, metres * 1000, metres + 100].map(big), explanation: `1 metre = 100 centimetres, so ${metres} metres = ${metres * 100} cm.` };
        }
        const l = r.int(3, 20);
        const w = r.int(2, l);
        if (c === 4) return { stem: `A rectangle is ${l} cm long and ${w} cm wide. What is its perimeter?`, answer: `${2 * (l + w)} cm`, wrong: [l * w, l + w, 4 * l].filter((x) => x !== 2 * (l + w)).map((x) => `${x} cm`), explanation: `Perimeter is the distance all the way round: ${l} + ${w} + ${l} + ${w} = ${2 * (l + w)} cm.` };
        return { stem: `A rectangular garden is ${l} m long and ${w} m wide. What is its area?`, answer: `${l * w} square metres`, wrong: [2 * (l + w), l + w, l * w * 2].filter((x) => x !== l * w).map((x) => `${x} square metres`), explanation: `Area = length × width = ${l} × ${w} = ${l * w} square metres.` };
      },
    },
  ];

  if (c >= 2) {
    list.push({
      key: 'pmaths/times-divide',
      topic: [NUM, 'Multiplication and division'],
      difficulty: c <= 3 ? 1 : 2,
      make: (r) => {
        const tables = c === 2 ? [2, 5, 10] : [2, 3, 4, 5, 6, 7, 8, 9, 10];
        const a = c <= 3 ? r.pick(tables) : c === 4 ? r.int(11, 99) : r.int(101, 999);
        const b = c <= 3 ? r.int(1, 10) : c === 4 ? r.int(2, 9) : r.int(11, 49);
        const p = a * b;
        if (c >= 3 && r.chance(0.4)) {
          return {
            stem: c === 3 ? `${p} oranges are shared equally among ${b} children. How many does each child get?` : `Work out ${big(p)} ÷ ${b}.`,
            answer: big(a),
            wrong: [a + 1, a - 1, p - b, b].filter((x) => x > 0 && x !== a).map(big),
            explanation: `${big(p)} ÷ ${b} = ${big(a)}, because ${big(a)} × ${b} = ${big(p)}.`,
          };
        }
        return {
          stem: `Work out ${big(a)} × ${b}.`,
          answer: big(p),
          wrong: [a + b, p + a, p - b, a * (b + 1)].filter((x) => x !== p).map(big),
          explanation: c <= 3 ? `${big(a)} × ${b} means ${b} lots of ${big(a)}: ${big(p)}.` : `${big(a)} × ${b} = ${big(p)}.`,
        };
      },
    });
    list.push({
      key: 'pmaths/fractions',
      topic: [NUM, 'Fractions'],
      difficulty: c <= 3 ? 1 : 2,
      make: (r) => {
        if (c <= 3) {
          const d = c === 2 ? 2 : r.pick([2, 3, 4]);
          const whole = d * r.int(2, c === 2 ? 10 : 12);
          const word = { 2: 'half', 3: 'one third', 4: 'one quarter' }[d]!;
          return { stem: `What is ${word} of ${whole}?`, answer: String(whole / d), wrong: [whole * d, whole - d, whole / d + 1, whole / 2 === whole / d ? whole / 4 : whole / 2].filter((x) => Number.isInteger(x) && x !== whole / d).map(String), explanation: `To find ${word}, share ${whole} into ${d} equal parts: ${whole} ÷ ${d} = ${whole / d}.` };
        }
        const d = r.pick(c === 4 ? [5, 6, 8, 10] : [4, 6, 8, 12]);
        const a = r.int(1, d - 2);
        const b = r.int(1, d - a - 1);
        if (c === 4) {
          const ans = new Frac(a + b, d);
          return { stem: `Add ${m(`\\frac{${a}}{${d}} + \\frac{${b}}{${d}}`)}.`, answer: m(ans.tex()), wrong: [new Frac(a + b, 2 * d), new Frac(a * b, d), new Frac(a + b + 1, d)].filter((x) => !x.equals(ans)).map((x) => m(x.tex())), explanation: `The bottom numbers are the same, so add the tops: ${a} + ${b} = ${a + b}. ${m(`\\frac{${a + b}}{${d}}${gcd(a + b, d) > 1 ? ` = ${ans.tex()}` : ''}`)}.` };
        }
        // A numerator with no factor in common with the denominator, so the fraction is in lowest terms.
        const n = r.pick(Array.from({ length: d - 1 }, (_, i) => i + 1).filter((x) => gcd(x, d) === 1 && x > 1));
        const q = d * r.int(2, 10) * (r.chance(0.5) ? 10 : 1);
        return { stem: `What is ${m(`\\frac{${n}}{${d}}`)} of ${big(q)}?`, answer: big((q / d) * n), wrong: [q / d, (q / d) * (n + 1), q * n].filter((x) => x !== (q / d) * n).map(big), explanation: `First find ${m(`\\frac{1}{${d}}`)}: ${big(q)} ÷ ${d} = ${big(q / d)}. Then multiply by ${n}: ${big((q / d) * n)}.` };
      },
    });
  }

  if (c === 5) {
    list.push({
      key: 'pmaths/decimals-percent',
      topic: [NUM, 'Decimals and percentages'],
      difficulty: 2,
      make: (r) => {
        if (r.chance(0.5)) {
          const x = r.int(11, 99) / 10;
          const y = r.int(11, 99) / 10;
          const s = Math.round((x + y) * 10) / 10;
          return { stem: `Add ${num(x)} + ${num(y)}.`, answer: num(s), wrong: [s + 1, s - 0.1, Math.round((x + y) * 100) / 1000, s * 10].map((v) => num(Math.round(v * 100) / 100)), explanation: `Line up the decimal points and add: ${num(x)} + ${num(y)} = ${num(s)}.` };
        }
        const p = r.pick([10, 20, 25, 50, 75]);
        const whole = r.pick([40, 80, 120, 200, 400, 600]);
        return { stem: `What is ${p}% of ${whole}?`, answer: num((p * whole) / 100), wrong: [whole - (p * whole) / 100, p, (p * whole) / 10].map((v) => num(v)), explanation: `${p}% means ${p} out of every 100: ${p} ÷ 100 × ${whole} = ${num((p * whole) / 100)}.` };
      },
    });
  }
  return list;
}
