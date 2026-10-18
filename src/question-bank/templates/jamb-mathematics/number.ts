import { Frac, gcd, isInt, lcm, m, NAMES, naira, num, tnaira, TOWNS, type Template } from '../engine.js';

const T1 = 'Fractions, Decimals, Approximations and Percentages';

/** Rounds a digit list to `keep` digits (half up). The templates avoid 9s, so there's never a carry to the front. */
const roundDigits = (ds: number[], keep: number) => {
  const out = ds.slice(0, keep);
  if (ds[keep] >= 5) out[keep - 1] += 1;
  return out;
};
const pct = (x: number | Frac) => m(`${(x instanceof Frac ? x : isInt(x) ? new Frac(x) : new Frac(Math.round(x * 1000), 1000)).mixed()}\\%`);

export const number: Template[] = [
  {
    key: 'jamb-maths/lcm-div-hcf',
    topic: [T1, 'Fractions and decimals'],
    difficulty: 2,
    make: (r) => {
      const h = r.pick([2, 3, 4, 5, 6, 8, 12, 16]);
      const ms = r.shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).slice(0, 3).sort((a, b) => a - b);
      if (gcd(gcd(ms[0], ms[1]), ms[2]) !== 1) return null;
      const [a, b, c] = ms.map((x) => x * h);
      const L = lcm(lcm(a, b), c);
      const ans = L / h;
      return {
        stem: `Divide the L.C.M. of ${a}, ${b} and ${c} by their H.C.F.`,
        answer: String(ans),
        wrong: [String(L), String(h), String(ans + h), String(a + b + c)],
        explanation: `The H.C.F. of ${a}, ${b} and ${c} is ${h}, since ${a} = ${h} × ${ms[0]}, ${b} = ${h} × ${ms[1]} and ${c} = ${h} × ${ms[2]}, and ${ms.join(', ')} share no other factor.\nThe L.C.M. is ${num(L)}.\nSo L.C.M. ÷ H.C.F. = ${num(L)} ÷ ${h} = ${ans}.`,
      };
    },
  },
  {
    key: 'jamb-maths/fraction-of-remainder',
    topic: [T1, 'Fractions and decimals'],
    difficulty: 3,
    make: (r) => {
      const q = r.pick([3, 4, 5, 6, 8]);
      const p = r.int(1, q - 1);
      const s = r.pick([2, 3, 4, 5]);
      const t = r.int(1, s - 1);
      if (gcd(p, q) !== 1 || gcd(t, s) !== 1) return null;
      const left = new Frac(q - p, q).mul(new Frac(s - t, s));
      const k = r.int(1, 12);
      const total = left.d * k;
      const W = left.n * k;
      if (total < 20 || total > 400) return null;
      const [item, unit] = r.pick([['a bag of rice', 'kg'], ['a basket of oranges', 'oranges'], ['a heap of yams', 'tubers'], ['a carton of eggs', 'eggs']] as const);
      const counted = unit !== 'kg';
      const amount = (x: number) => (counted ? `${num(x)} ${unit}` : m(`${num(x)}\\text{ kg}`));
      // Classic slips: taking the second fraction of the whole, or forgetting the second sale.
      const slip1 = W / (1 - p / q - t / s);
      const slip2 = (W * q) / (q - p);
      return {
        stem: `A trader in ${r.pick(TOWNS)} sells ${m(`\\frac{${p}}{${q}}`)} of ${item} in the morning and ${m(`\\frac{${t}}{${s}}`)} of the remainder in the afternoon. If ${amount(W)} ${counted && W !== 1 ? 'are' : 'is'} left unsold, find the original number of ${counted ? unit : 'kilograms'}.`,
        answer: amount(total),
        wrong: [slip1, slip2, total + left.d, total * 2].filter((x) => isInt(x) && x > 0).map(amount),
        explanation: `After the morning, ${m(`1 - \\frac{${p}}{${q}} = \\frac{${q - p}}{${q}}`)} is left.\nIn the afternoon ${m(`\\frac{${t}}{${s}}`)} of that is sold, so ${m(`\\frac{${s - t}}{${s}}`)} of it remains: ${m(`\\frac{${s - t}}{${s}} \\times \\frac{${q - p}}{${q}} = ${left.tex()}`)} of the original.\nSo ${m(`${left.tex()} \\times N = ${W}`)}, giving ${m(`N = ${W} \\times ${left.n === 1 ? left.d : `\\frac{${left.d}}{${left.n}}`} = ${total}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/significant-figures',
    topic: [T1, 'Approximations and significant figures'],
    difficulty: 2,
    make: (r) => {
      const keep = r.pick([2, 3]);
      const len = r.int(keep + 2, keep + 3);
      const ds = Array.from({ length: len }, (_, i) => (i === 0 ? r.int(1, 8) : r.int(0, 8)));
      ds[keep] = r.int(5, 8); // the deciding digit rounds up, so truncating gives a different (wrong) answer
      const rounded = roundDigits(ds, keep);
      const extra = roundDigits(ds, keep + 1);
      if (r.chance(0.5)) {
        // A whole number: 34,567 → 34,600
        const zeros = (n: number) => '0'.repeat(n);
        const show = (digits: number[], width: number) => num(Number(digits.join('') + zeros(width - digits.length)));
        const x = Number(ds.join(''));
        return {
          stem: `Express ${num(x)} correct to ${keep} significant figures.`,
          answer: show(rounded, len),
          wrong: [show(ds.slice(0, keep), len), rounded.join(''), show(extra, len), show(roundDigits(ds, keep - 1), len)],
          explanation: `The first ${keep} significant figures are ${ds.slice(0, keep).join('')}. The next digit is ${ds[keep]}, which is 5 or more, so round up to ${rounded.join('')}.\nKeep the place value by filling the rest with zeros: ${show(rounded, len)}.`,
        };
      }
      // A small decimal: 0.0045678 → 0.0046
      const z = r.int(1, 3);
      const dec = (digits: number[]) => `0.${'0'.repeat(z)}${digits.join('')}`;
      return {
        stem: `Express ${dec(ds)} correct to ${keep} significant figures.`,
        answer: dec(rounded),
        wrong: [dec(ds.slice(0, keep)), dec(extra), dec(roundDigits(ds, keep - 1)), `0.${'0'.repeat(z - 1)}${rounded.join('')}`],
        explanation: `Zeros before the first non-zero digit are not significant, so start counting at ${ds[0]}.\nThe first ${keep} significant figures are ${ds.slice(0, keep).join('')}; the next digit is ${ds[keep]}, so round up to ${rounded.join('')}.\nAnswer: ${dec(rounded)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/decimal-places',
    topic: [T1, 'Approximations and significant figures'],
    difficulty: 1,
    make: (r) => {
      const places = r.pick([1, 2]);
      const whole = r.int(0, 8);
      const ds = Array.from({ length: places + 2 }, () => r.int(0, 8));
      ds[places] = r.int(5, 8);
      const show = (digits: number[]) => `${whole}.${digits.join('')}`;
      const rounded = roundDigits(ds, places);
      return {
        stem: `Approximate ${show(ds)} to ${places} decimal place${places === 1 ? '' : 's'}.`,
        answer: show(rounded),
        wrong: [show(ds.slice(0, places)), show(roundDigits(ds, places + 1)), `${whole + 1}.${'0'.repeat(places)}`, show(rounded.map((d, i) => (i === places - 1 ? Math.max(0, d - 2) : d)))],
        explanation: `Look at the digit after the ${places === 1 ? 'first' : 'second'} decimal place: it is ${ds[places]}, which is 5 or more, so round up.\n${show(ds)} ≈ ${show(rounded)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/depreciation-appreciation',
    topic: [T1, 'Percentages and commercial arithmetic'],
    difficulty: 2,
    make: (r) => {
      const V = r.pick([10000, 20000, 40000, 50000, 80000, 100000, 160000, 200000, 250000, 400000, 500000, 800000]);
      const rate = r.pick([5, 10, 15, 20, 25]);
      const n = r.pick([2, 2, 3]);
      const down = r.chance(0.6);
      const f = down ? 1 - rate / 100 : 1 + rate / 100;
      const value = V * f ** n;
      if (!isInt(value)) return null;
      const simple = V * (1 + ((down ? -1 : 1) * n * rate) / 100);
      const thing = down ? r.pick(['A generator', 'A machine', 'A car', 'A grinding mill', 'A motorcycle']) : r.pick(['A plot of land', 'A house', 'A shop']);
      return {
        stem: `${thing} valued at ${naira(V)} ${down ? 'depreciates' : 'appreciates'} by ${rate}% every year. What will its value be at the end of ${n} years?`,
        answer: naira(Math.round(value)),
        wrong: [naira(Math.round(simple)), naira(Math.round(V * f ** (n - 1))), naira(Math.round(Math.abs(V - value))), naira(Math.round(V * f ** (n + 1)))],
        explanation: `Each year the value is multiplied by ${m(`${down ? '1 - ' : '1 + '}${rate / 100} = ${f}`)} (the percentage is taken on the new value each year, not the original).\nAfter ${n} years: ${m(`${tnaira(V)} \\times ${f}^${n} = ${tnaira(Math.round(value))}`)}.`,
        difficulty: n === 3 ? 3 : 2,
      };
    },
  },
  {
    key: 'jamb-maths/marked-price',
    topic: [T1, 'Percentages and commercial arithmetic'],
    difficulty: 3,
    make: (r) => {
      const p = r.pick([10, 15, 20, 25, 30]);
      const d = r.pick([4, 5, 8, 10, 20]);
      // Build the total cost so the marked price comes out in whole naira.
      const base = r.int(1, 8) * (100 - d) * 100;
      const T = r.int(2, 16) * 500;
      const C = base - T;
      if (C < 5000) return null;
      const M = ((C + T) * (100 + p)) / (100 - d);
      if (!isInt(M)) return null;
      const name = r.pick(NAMES);
      const goods = r.pick(['a bag of rice', 'a phone', 'a bicycle', 'a sewing machine', 'a television']);
      return {
        stem: `${name} bought ${goods} for ${naira(C)} and spent ${naira(T)} on transport. To make a profit of ${p}% after allowing ${d === 8 ? 'an' : 'a'} ${d}% discount to a buyer, what should the marked price be?`,
        answer: naira(Math.round(M)),
        wrong: [
          naira(Math.round((C * (1 + p / 100)) / (1 - d / 100))),
          naira(Math.round((C + T) * (1 + p / 100))),
          naira(Math.round((C + T) * (1 + (p + d) / 100))),
          naira(Math.round((C + T) * (1 + p / 100) * (1 + d / 100))),
        ],
        explanation: `Total cost = ${m(`${tnaira(C)} + ${tnaira(T)} = ${tnaira(C + T)}`)}.\nSelling price for ${p}% profit = ${m(`${1 + p / 100} \\times ${tnaira(C + T)} = ${tnaira((C + T) * (1 + p / 100))}`)}.\nThe buyer pays ${100 - d}% of the marked price ${m('M')}, so ${m(`${(100 - d) / 100}M = ${tnaira((C + T) * (1 + p / 100))}`)}, giving ${m(`M = ${tnaira(Math.round(M))}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/express-as-percentage',
    topic: [T1, 'Percentages and commercial arithmetic'],
    difficulty: 2,
    make: (r) => {
      const [small, big, factor, bigShow] = r.pick([
        ['g', 'kg', 1000, (x: number) => `${num(x)}kg`],
        ['cm', 'm', 100, (x: number) => `${num(x)}m`],
        ['kobo', 'naira', 100, (x: number) => naira(x)],
        ['minutes', 'hours', 60, (x: number) => `${num(x)} hours`],
      ] as const);
      const b = r.pick([1.5, 2, 2.5, 3, 4, 5, 6, 8, 12, 15, 16.5, 20, 25]);
      const answerPct = r.pick([1, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30]);
      const a = (b * factor * answerPct) / 100;
      if (!isInt(a) || a < 2) return null;
      if (small === 'kobo' && !isInt(b)) return null; // no ₦1.5
      if (small === 'minutes' && b > 12) return null;
      const amount = small === 'kobo' ? `${num(a)} kobo` : `${num(a)}${small === 'g' ? 'g' : small === 'cm' ? 'cm' : ' minutes'}`;
      return {
        stem: `Express ${amount} as a percentage of ${bigShow(b)}.`,
        answer: pct(answerPct),
        wrong: [pct(answerPct * factor), pct(answerPct * 10), pct(new Frac(Math.round(answerPct * 100), 1000)), pct(answerPct * 2)],
        explanation: `Put both in the same unit first: ${bigShow(b)} = ${num(b * factor)} ${small}.\nPercentage = ${m(`\\frac{${num(a)}}{${num(b * factor)}} \\times 100\\% = ${new Frac(answerPct * 100, 100).mixed()}\\%`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/profit-loss-percent',
    topic: [T1, 'Percentages and commercial arithmetic'],
    difficulty: 2,
    make: (r) => {
      const B = r.int(4, 120) * 100;
      const rate = r.pick([new Frac(5), new Frac(10), new Frac(25, 2), new Frac(15), new Frac(20), new Frac(25), new Frac(30), new Frac(40), new Frac(100, 3)]);
      const gain = r.chance(0.55);
      const exact = new Frac(B).mul(new Frac(100).add(gain ? rate : rate.neg())).div(100);
      if (!exact.isInt) return null;
      const S = exact.n;
      const diff = Math.abs(S - B);
      const word = (g: boolean) => (g ? 'profit' : 'loss');
      const onSelling = new Frac(diff * 100, S);
      return {
        stem: `${r.pick(NAMES)} bought an article for ${naira(B)} and sold it for ${naira(S)}. Find the percentage ${gain ? 'gain' : 'loss'}.`,
        answer: `${pct(rate)} ${word(gain)}`,
        wrong: [`${pct(rate)} ${word(!gain)}`, `${pct(onSelling)} ${word(gain)}`, `${pct(rate.add(5))} ${word(gain)}`, `${pct(onSelling)} ${word(!gain)}`],
        explanation: `${gain ? 'Profit' : 'Loss'} = ${m(`${tnaira(Math.max(S, B))} - ${tnaira(Math.min(S, B))} = ${tnaira(diff)}`)}.\nPercentage ${gain ? 'profit' : 'loss'} is always worked out on the cost price: ${m(`\\frac{${diff}}{${B}} \\times 100\\% = ${rate.mixed()}\\%`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/share-in-ratio',
    topic: [T1, 'Ratios, proportions and rates'],
    difficulty: 1,
    make: (r) => {
      const parts = r.shuffle([1, 2, 3, 4, 5, 6, 7]).slice(0, 3);
      const k = r.pick([100, 200, 500, 1000, 1500, 2000, 2500]);
      const total = k * (parts[0] + parts[1] + parts[2]);
      const names = r.shuffle(NAMES).slice(0, 3);
      const who = r.int(0, 2);
      const shares = parts.map((p) => p * k);
      return {
        stem: `${naira(total)} is shared among ${names[0]}, ${names[1]} and ${names[2]} in the ratio ${parts.join(' : ')}. How much does ${names[who]} get?`,
        answer: naira(shares[who]),
        wrong: [...shares.filter((_, i) => i !== who).map(naira), naira(Math.round(total / 3)), naira(shares[who] * 2)],
        explanation: `Total parts = ${parts.join(' + ')} = ${parts[0] + parts[1] + parts[2]}, so one part is ${m(`\\frac{${tnaira(total)}}{${parts[0] + parts[1] + parts[2]}} = ${tnaira(k)}`)}.\n${names[who]} gets ${parts[who]} part${parts[who] === 1 ? '' : 's'}: ${m(`${parts[who]} \\times ${tnaira(k)} = ${tnaira(shares[who])}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/speed-conversion',
    topic: [T1, 'Ratios, proportions and rates'],
    difficulty: 2,
    make: (r) => {
      const d = r.int(6, 60) * 100;
      const t = r.pick([5, 10, 12, 15, 20, 25, 30, 40, 45, 50, 60]);
      const kmh = (d / 1000) / (t / 60);
      if (!isInt(kmh * 10)) return null;
      const who = r.pick(['A boy walks', 'A girl cycles', 'A man jogs', 'A woman walks']);
      return {
        stem: `${who} ${num(d)}m in ${t} minutes. Calculate the average speed in km/h.`,
        answer: num(kmh),
        wrong: [num(Math.round((d / t) * 10) / 10), num(kmh * 10), num(kmh / 10), num(Math.round((t / 60 / (d / 1000)) * 100) / 100)],
        explanation: `Distance = ${num(d)}m = ${num(d / 1000)}km. Time = ${t} minutes = ${t === 60 ? '1 hour' : `${m(new Frac(t, 60).tex())} hour`}.\nSpeed = distance ÷ time = ${m(`${num(d / 1000)} \\times \\frac{60}{${t}} = ${num(kmh)}\\text{ km/h}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/simple-interest-two-amounts',
    topic: [T1, 'Percentages and commercial arithmetic'],
    difficulty: 3,
    make: (r) => {
      const P = r.int(4, 40) * 5000;
      const R = r.pick([4, 5, 6, 8, 10, 12, 15]);
      const t1 = r.pick([2, 3, 4]);
      const t2 = t1 + r.pick([1, 2, 3]);
      const I = (P * R) / 100;
      const A1 = P + I * t1;
      const A2 = P + I * t2;
      const askRate = r.chance(0.6);
      const stem = `At simple interest, a sum of money amounts to ${naira(A1)} in ${t1} years and ${naira(A2)} in ${t2} years. ${askRate ? 'Find the rate of interest per annum.' : 'Find the sum of money (the principal).'}`;
      const working = `Interest for ${t2 - t1} year${t2 - t1 === 1 ? '' : 's'} = ${m(`${tnaira(A2)} - ${tnaira(A1)} = ${tnaira(A2 - A1)}`)}, so interest per year = ${m(tnaira(I))}.\nPrincipal = ${m(`${tnaira(A1)} - ${t1} \\times ${tnaira(I)} = ${tnaira(P)}`)}.`;
      if (askRate) {
        return {
          stem,
          answer: pct(R),
          wrong: [pct(Math.round((I * 100) / A1)), pct(R * 2), pct(Math.round(((A2 - A1) * 100) / A2)), pct(R + 5)],
          explanation: `${working}\nRate = ${m(`\\frac{${tnaira(I)}}{${tnaira(P)}} \\times 100\\% = ${R}\\%`)}.`,
        };
      }
      return {
        stem,
        answer: naira(P),
        wrong: [naira(A1 - I), naira(A1), naira(A2 - A1), naira(P + I)],
        explanation: working,
      };
    },
  },
];
