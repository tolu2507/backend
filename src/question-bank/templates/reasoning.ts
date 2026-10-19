import { otherValues, type Rng, type Template } from './engine.js';

/** Common Entrance Quantitative and Verbal Reasoning: pattern questions generated and checked by code. */

const PAT = 'Number Patterns';
const REL = 'Number Relationships';
const WORDS = 'Word Relationships';
const LETTERS = 'Letters and Codes';

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const quantitative: Template[] = [
  {
    key: 'qr/sequences',
    topic: [PAT, 'Sequences'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['add', 'multiply', 'squares', 'growing', 'alternate'] as const);
      let xs: number[];
      let rule: string;
      if (kind === 'add') {
        const a = r.int(1, 30);
        const d = r.pick([2, 3, 4, 5, 6, 7, 9, 11, -3, -4, -5]);
        xs = Array.from({ length: 6 }, (_, i) => a + d * i + (d < 0 ? 60 : 0));
        rule = `${d > 0 ? 'add' : 'subtract'} ${Math.abs(d)} each time`;
      } else if (kind === 'multiply') {
        const a = r.pick([1, 2, 3, 5]);
        const k = r.pick([2, 3]);
        xs = Array.from({ length: 6 }, (_, i) => a * k ** i);
        rule = `multiply by ${k} each time`;
      } else if (kind === 'squares') {
        const s = r.int(1, 5);
        xs = Array.from({ length: 6 }, (_, i) => (s + i) ** 2);
        rule = `square numbers: ${s}², ${s + 1}², ${s + 2}², …`;
      } else if (kind === 'growing') {
        const a = r.int(1, 10);
        const d0 = r.int(1, 3);
        xs = [a];
        for (let i = 1; i < 6; i++) xs.push(xs[i - 1] + d0 + i - 1);
        rule = `the gap grows by 1 each time (+${d0}, +${d0 + 1}, +${d0 + 2}, …)`;
      } else {
        const a = r.int(2, 9);
        const [p, q] = [r.int(2, 5), r.int(1, 4)];
        xs = [a];
        for (let i = 1; i < 6; i++) xs.push(i % 2 ? xs[i - 1] + p : xs[i - 1] * 2 - q);
        if (xs.some((x) => x < 0)) return null;
        rule = `add ${p}, then double and take away ${q}, in turn`;
      }
      const shown = xs.slice(0, 5);
      const ans = xs[5];
      return {
        stem: `What number comes next? ${shown.join(', ')}, ___`,
        answer: String(ans),
        wrong: [ans + 1, ans - 1, ans + (xs[4] - xs[3]), xs[4] + (xs[1] - xs[0]), ans + 2].filter((x) => x !== ans && x >= 0).map(String),
        explanation: `The rule: ${rule}. So the next number is ${ans}.`,
      };
    },
  },
  {
    key: 'qr/number-machine',
    topic: [PAT, 'Number machines'],
    difficulty: 3,
    make: (r) => {
      const a = r.int(2, 6);
      const b = r.int(-5, 9);
      const f = (x: number) => a * x + b;
      const ins = r.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, 4);
      const [x1, x2, x3, q] = ins;
      if (f(x1) < 0) return null;
      const rule = `multiply by ${a}${b ? `, then ${b > 0 ? 'add' : 'subtract'} ${Math.abs(b)}` : ''}`;
      return {
        stem: `A number machine changes ${x1} → ${f(x1)}, ${x2} → ${f(x2)} and ${x3} → ${f(x3)}. What does it change ${q} into?`,
        answer: String(f(q)),
        wrong: [a * q, q + (f(x1) - x1), f(q) + a, f(q) - 1].filter((x) => x !== f(q)).map(String),
        explanation: `The rule is "${rule}": check it with ${x1} → ${a} × ${x1}${b ? ` ${b > 0 ? '+' : '−'} ${Math.abs(b)}` : ''} = ${f(x1)}.\nSo ${q} → ${a} × ${q}${b ? ` ${b > 0 ? '+' : '−'} ${Math.abs(b)}` : ''} = ${f(q)}.`,
      };
    },
  },
  {
    key: 'qr/missing-number',
    topic: [REL, 'Missing numbers'],
    difficulty: 1,
    make: (r) => {
      const a = r.int(2, 12);
      const b = r.int(2, 12);
      const op = r.pick(['×', '+', '÷', '−'] as const);
      const [lhs, rhs, ans] =
        op === '×' ? [`___ × ${b}`, a * b, a] : op === '+' ? [`${a} + ___`, a + b * 3, b * 3] : op === '÷' ? [`___ ÷ ${b}`, a, a * b] : [`${a * 4} − ___`, a * 4 - b, b];
      if (rhs < 0) return null;
      return {
        stem: `Find the missing number: ${lhs} = ${rhs}`,
        answer: String(ans),
        wrong: [ans + 1, ans - 1, rhs, op === '×' ? rhs * b : ans * 2].filter((x) => x !== ans && x >= 0).map(String),
        explanation: op === '×' ? `${rhs} ÷ ${b} = ${a}, and ${a} × ${b} = ${rhs}.` : op === '+' ? `${rhs} − ${a} = ${ans}.` : op === '÷' ? `${a} × ${b} = ${a * b}, and ${a * b} ÷ ${b} = ${a}.` : `${a * 4} − ${rhs} = ${b}.`,
      };
    },
  },
  {
    key: 'qr/odd-number-out',
    topic: [REL, 'Odd one out'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['multiples', 'even', 'squares'] as const);
      if (kind === 'multiples') {
        const k = r.pick([3, 4, 6, 7, 8, 9]);
        const ms = r.shuffle(Array.from({ length: 12 }, (_, i) => k * (i + 2))).slice(0, 4);
        const odd = r.pick(ms) + r.pick([1, 2]);
        return {
          stem: 'Which number is the odd one out?',
          answer: String(odd),
          wrong: ms.slice(0, 3).map(String),
          explanation: `All the others are multiples of ${k}; ${odd} is not.`,
        };
      }
      if (kind === 'even') {
        const evens = r.shuffle(Array.from({ length: 30 }, (_, i) => 2 * (i + 5))).slice(0, 3);
        const odd = 2 * r.int(5, 40) + 1;
        return { stem: 'Which number is the odd one out?', answer: String(odd), wrong: evens.map(String), explanation: `The others are all even numbers; ${odd} is odd.` };
      }
      const sq = r.shuffle([4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144]).slice(0, 4);
      const odd = sq[3] + r.pick([1, 2, 3]);
      return { stem: 'Which number is the odd one out?', answer: String(odd), wrong: sq.slice(0, 3).map(String), explanation: `The others are square numbers (${sq.slice(0, 3).map((x) => `${Math.sqrt(x)}² = ${x}`).join(', ')}); ${odd} is not.` };
    },
  },
];

/** [a, b] pairs that share one relationship; analogies pick two pairs from the same list. */
const ANALOGIES: { rel: string; pairs: [string, string][] }[] = [
  { rel: 'an animal and its young', pairs: [['cat', 'kitten'], ['dog', 'puppy'], ['cow', 'calf'], ['goat', 'kid'], ['sheep', 'lamb'], ['hen', 'chick'], ['horse', 'foal'], ['frog', 'tadpole']] },
  { rel: 'a male and a female', pairs: [['king', 'queen'], ['father', 'mother'], ['uncle', 'aunt'], ['cock', 'hen'], ['bull', 'cow'], ['nephew', 'niece'], ['prince', 'princess'], ['husband', 'wife']] },
  { rel: 'a worker and a tool', pairs: [['farmer', 'hoe'], ['tailor', 'needle'], ['carpenter', 'saw'], ['barber', 'clippers'], ['painter', 'brush'], ['doctor', 'stethoscope']] },
  { rel: 'an animal and its home', pairs: [['bird', 'nest'], ['bee', 'hive'], ['lion', 'den'], ['horse', 'stable'], ['pig', 'sty'], ['dog', 'kennel'], ['spider', 'web']] },
  { rel: 'a word and its opposite', pairs: [['hot', 'cold'], ['tall', 'short'], ['rich', 'poor'], ['early', 'late'], ['up', 'down'], ['empty', 'full'], ['day', 'night']] },
];

const CATEGORIES: { name: string; words: string[] }[] = [
  { name: 'fruits', words: ['mango', 'orange', 'pawpaw', 'banana', 'pineapple', 'guava', 'apple'] },
  { name: 'vegetables', words: ['spinach', 'cabbage', 'carrot', 'bitterleaf', 'lettuce', 'onion'] },
  { name: 'animals', words: ['goat', 'lion', 'elephant', 'monkey', 'rabbit', 'zebra'] },
  { name: 'colours', words: ['red', 'blue', 'green', 'yellow', 'purple', 'brown'] },
  { name: 'means of transport', words: ['bus', 'train', 'bicycle', 'canoe', 'aeroplane', 'motorcycle'] },
  { name: 'parts of the body', words: ['elbow', 'knee', 'ankle', 'shoulder', 'wrist', 'chin'] },
];

/** Simple opposites for primary 6. */
const OPPOSITES: [string, string][] = [
  ['happy', 'sad'], ['strong', 'weak'], ['brave', 'cowardly'], ['clean', 'dirty'], ['heavy', 'light'], ['open', 'close'], ['buy', 'sell'], ['arrive', 'depart'],
  ['victory', 'defeat'], ['friend', 'enemy'], ['ancient', 'modern'], ['wide', 'narrow'], ['polite', 'rude'], ['always', 'never'], ['accept', 'refuse'], ['visible', 'invisible'],
];

const shift = (word: string, k: number) => word.toUpperCase().replace(/[A-Z]/g, (c) => ALPHA[(ALPHA.indexOf(c) + k + 26) % 26]);
const CODE_WORDS = ['BOOK', 'GOAT', 'FARM', 'RICE', 'BALL', 'SHOE', 'DOOR', 'LAMP', 'FISH', 'SALT', 'MILK', 'ROAD', 'BEAN', 'COIN'];

function oddWord(r: Rng) {
  const [main, other] = r.shuffle(CATEGORIES).slice(0, 2);
  const same = r.shuffle(main.words).slice(0, 3);
  const odd = r.pick(other.words);
  return { stem: 'Which word is the odd one out?', answer: odd, wrong: same, explanation: `${same[0][0].toUpperCase() + same[0].slice(1)}, ${same.slice(1).join(' and ')} are all ${main.name}; ${odd} is not.` };
}

export const verbal: Template[] = [
  {
    key: 'vr/analogies',
    topic: [WORDS, 'Analogies'],
    difficulty: 2,
    make: (r) => {
      const group = r.pick(ANALOGIES);
      const [[a, b], [c, d]] = r.shuffle(group.pairs).slice(0, 2);
      const others = r.shuffle(ANALOGIES.filter((g) => g !== group).flatMap((g) => g.pairs.map((p) => p[1]))).slice(0, 2);
      return {
        stem: `${a[0].toUpperCase() + a.slice(1)} is to ${b} as ${c} is to ___`,
        answer: d,
        wrong: [...others, c === d ? a : b].filter((w) => w !== d),
        explanation: `${a[0].toUpperCase() + a.slice(1)} and ${b} are ${group.rel}. In the same way, ${c} and ${d} are ${group.rel}.`,
      };
    },
  },
  {
    key: 'vr/opposites',
    topic: [WORDS, 'Opposites'],
    difficulty: 1,
    variety: 32,
    make: (r) => {
      const row = r.pick(OPPOSITES);
      const flip = r.chance(0.5);
      const [w, opp] = flip ? [row[1], row[0]] : row;
      return {
        stem: `Which word is opposite in meaning to "${w}"?`,
        answer: opp,
        wrong: otherValues(r, OPPOSITES, row, (x) => (flip ? x[0] : x[1])),
        explanation: `The opposite of "${w}" is "${opp}".`,
      };
    },
  },
  {
    key: 'vr/odd-word-out',
    topic: [WORDS, 'Odd one out'],
    difficulty: 1,
    make: oddWord,
  },
  {
    key: 'vr/alphabet',
    topic: [LETTERS, 'Alphabet positions'],
    difficulty: 2,
    make: (r) => {
      const i = r.int(2, 21);
      const k = r.int(2, 4);
      const dir = r.chance(0.6) ? 1 : -1;
      const j = i + dir * k;
      if (j < 0 || j > 25) return null;
      return {
        stem: `Which letter is ${k} places ${dir > 0 ? 'after' : 'before'} ${ALPHA[i]} in the alphabet?`,
        answer: ALPHA[j],
        wrong: [ALPHA[j + 1], ALPHA[j - 1], ALPHA[i - dir * k]].filter((x) => x && x !== ALPHA[j]),
        explanation: `Count ${dir > 0 ? 'forwards' : 'backwards'} from ${ALPHA[i]}: ${Array.from({ length: k }, (_, n) => ALPHA[i + dir * (n + 1)]).join(', ')}. The answer is ${ALPHA[j]}.`,
      };
    },
  },
  {
    key: 'vr/letter-codes',
    topic: [LETTERS, 'Letter codes'],
    difficulty: 3,
    make: (r) => {
      const k = r.pick([1, 2, 3, -1, -2]);
      const [w1, w2] = r.shuffle(CODE_WORDS).slice(0, 2);
      return {
        stem: `In a certain code, ${w1} is written as ${shift(w1, k)}. How is ${w2} written in the same code?`,
        answer: shift(w2, k),
        wrong: [shift(w2, -k), shift(w2, k + 1), shift(w2, k).split('').reverse().join('')].filter((x) => x !== shift(w2, k)),
        explanation: `Each letter moves ${Math.abs(k)} place${Math.abs(k) > 1 ? 's' : ''} ${k > 0 ? 'forward' : 'back'} in the alphabet (${w1[0]} → ${shift(w1, k)[0]}). So ${w2} → ${shift(w2, k)}.`,
      };
    },
  },
  {
    key: 'vr/alphabetical-order',
    topic: [LETTERS, 'Alphabetical order'],
    difficulty: 1,
    make: (r) => {
      const stem = r.pick(['ba', 'ca', 'ma', 'pa', 'st', 'tr']);
      const pool: Record<string, string[]> = {
        ba: ['basket', 'banana', 'bath', 'battle', 'bake', 'ball'],
        ca: ['camel', 'candle', 'carrot', 'castle', 'cabbage', 'cattle'],
        ma: ['market', 'mango', 'matter', 'machine', 'magnet', 'master'],
        pa: ['paper', 'palace', 'parent', 'pastor', 'parrot', 'pawpaw'],
        st: ['station', 'story', 'student', 'stamp', 'stone', 'string'],
        tr: ['travel', 'trader', 'trouble', 'tree', 'trip', 'truck'],
      };
      const words = r.shuffle(pool[stem]).slice(0, 4);
      const first = [...words].sort()[0];
      return {
        stem: `Which of these words comes first in alphabetical order? ${words.join(', ')}`,
        answer: first,
        wrong: words.filter((w) => w !== first),
        explanation: `They all start with "${stem}", so compare the next letters: ${[...words].sort().join(', ')}. "${first}" comes first.`,
      };
    },
  },
];
