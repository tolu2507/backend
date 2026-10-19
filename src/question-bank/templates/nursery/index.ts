import { groupPick, itemSet, otherValues, type Rng, type Template } from '../engine.js';

/**
 * Nursery 1–2: picture questions a child answers by tapping, with the question read aloud by the app.
 *
 * Stem layout (paragraphs split by a blank line):
 *   1. the question, shown and spoken;
 *   2. optional picture lines of emoji, shown big;
 *   3. optional "🔊 …" line, spoken but not shown (the letter or number to listen for).
 * Option labels are a word or number ("7", "B"), emoji alone ("🔴", "🍎🍎🍎"), or emoji and a word ("🐝 bee").
 */

export type NurseryCls = 1 | 2;

const SAY = '🔊';
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const stem = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join('\n\n');
/** A row of pictures, five to a line so they're easy to count. */
const rows = (e: string, n: number) => Array.from({ length: Math.ceil(n / 5) }, (_, i) => e.repeat(Math.min(5, n - i * 5))).join('\n');
const near = (n: number, lo: number, hi: number) => [n + 1, n - 1, n + 2, n - 2, n + 3].filter((x) => x >= lo && x <= hi && x !== n);

// ── Numbers ───────────────────────────────────────────────────

const COUNT = 'Counting';
const SUMS = 'Adding and Taking Away';

/** [picture, one, many] */
const THINGS: [string, string, string][] = [
  ['🍊', 'orange', 'oranges'],
  ['🍎', 'apple', 'apples'],
  ['🍌', 'banana', 'bananas'],
  ['⚽', 'ball', 'balls'],
  ['🐟', 'fish', 'fish'],
  ['⭐', 'star', 'stars'],
  ['🌸', 'flower', 'flowers'],
  ['🚗', 'car', 'cars'],
  ['🐤', 'chick', 'chicks'],
  ['🎈', 'balloon', 'balloons'],
  ['🥚', 'egg', 'eggs'],
  ['🍬', 'sweet', 'sweets'],
];
const counted = (n: number, t: [string, string, string]) => `${n} ${n === 1 ? t[1] : t[2]}`;
const countAloud = (n: number) => (n <= 10 ? `${Array.from({ length: n }, (_, i) => i + 1).join(', ')}.` : `Count them one by one, all the way to ${n}.`);
const level = (n: number): 1 | 2 | 3 => (n <= 5 ? 1 : n <= 10 ? 2 : 3);

export function nurseryNumbers(c: NurseryCls): Template[] {
  const max = c === 1 ? 10 : 20;
  const list: Template[] = [
    {
      key: 'nnum/count',
      topic: [COUNT, 'Count the pictures'],
      difficulty: 1,
      make: (r) => {
        const n = r.int(1, max);
        const t = r.pick(THINGS);
        return {
          stem: stem(`How many ${t[2]} can you count?`, rows(t[0], n)),
          answer: String(n),
          wrong: near(n, 1, max + 2).map(String),
          explanation: `${countAloud(n)} There ${n === 1 ? 'is' : 'are'} ${counted(n, t)}.`,
          difficulty: level(n),
        };
      },
    },
    {
      key: 'nnum/find-number',
      topic: [COUNT, 'Find the number'],
      difficulty: 1,
      variety: max,
      make: (r) => {
        const n = r.int(1, max);
        // Numbers that look alike are the real test: 6 and 9, 12 and 21.
        const lookAlike = [n === 6 ? 9 : n === 9 ? 6 : 0, n > 9 && n % 10 !== 0 && n % 10 !== 1 ? Number(String(n).split('').reverse().join('')) : 0].filter((x) => x >= 1 && x !== n);
        return {
          stem: stem('Find the number you hear.', `${SAY} ${WORDS[n]}`),
          answer: String(n),
          wrong: [...lookAlike, ...r.shuffle(near(n, 1, max))].map(String),
          explanation: `This is ${WORDS[n]}: ${n}.`,
          difficulty: level(n),
        };
      },
    },
    {
      key: 'nnum/more',
      topic: [COUNT, 'More and fewer'],
      difficulty: c === 1 ? 2 : 1,
      make: (r) => {
        const t = r.pick(THINGS);
        const counts = r.shuffle(Array.from({ length: c === 1 ? 5 : 8 }, (_, i) => i + 1)).slice(0, 4);
        const fewer = c === 2 && r.chance(0.4);
        const best = fewer ? Math.min(...counts) : Math.max(...counts);
        return {
          stem: `Which one has the ${fewer ? 'fewest' : 'most'} ${t[2]}?`,
          answer: t[0].repeat(best),
          wrong: counts.filter((n) => n !== best).map((n) => t[0].repeat(n)),
          explanation: `This one has ${counted(best, t)}. That is the ${fewer ? 'fewest' : 'most'}.`,
        };
      },
    },
    {
      key: 'nnum/order',
      topic: [COUNT, 'What comes next'],
      difficulty: 2,
      variety: max * (c === 1 ? 1 : 2),
      make: (r) => {
        const before = c === 2 && r.chance(0.5);
        const n = before ? r.int(2, max) : r.int(1, max - 1);
        const ans = before ? n - 1 : n + 1;
        return {
          stem: stem(`What number comes ${before ? 'just before' : 'after'} ${n}?`, before ? `❓ ➡️ ${n}` : `${n} ➡️ ❓`),
          answer: String(ans),
          wrong: [n, ...near(ans, 1, max + 1).filter((x) => x !== n)].map(String),
          explanation: `Count: ${[ans - 1, ans, ans + 1].filter((x) => x >= 1).join(', ')}. ${before ? `Just before ${n} comes ${ans}.` : `After ${n} comes ${ans}.`}`,
          difficulty: n > 10 ? 3 : 2,
        };
      },
    },
  ];
  if (c === 1) return list;
  return [
    ...list,
    {
      key: 'nnum/add',
      topic: [SUMS, 'Adding pictures'],
      difficulty: 2,
      make: (r) => {
        const t = r.pick(THINGS);
        const a = r.int(1, 6);
        const b = r.int(1, 4);
        const sum = a + b;
        return {
          stem: stem(`${counted(a, t)} and ${b} more. How many altogether?`, `${t[0].repeat(a)} ➕ ${t[0].repeat(b)}`),
          answer: String(sum),
          wrong: near(sum, 1, 12).map(String),
          explanation: `Count them all: ${countAloud(sum)} ${a} and ${b} make ${sum}.`,
          difficulty: sum <= 5 ? 2 : 3,
        };
      },
    },
    {
      key: 'nnum/take-away',
      topic: [SUMS, 'Taking away'],
      difficulty: 3,
      make: (r) => {
        const t = r.pick(THINGS);
        const a = r.int(3, 9);
        const b = r.int(1, a - 1);
        const left = a - b;
        return {
          stem: stem(`There are ${counted(a, t)}. Take away ${b}. How many are left?`, `${rows(t[0], a)}\n➖ ${t[0].repeat(b)}`),
          answer: String(left),
          wrong: [a, b, ...near(left, 0, 10)].filter((x) => x !== left).map(String),
          explanation: `${a} take away ${b} leaves ${left}.`,
          difficulty: a <= 5 ? 2 : 3,
        };
      },
    },
  ];
}

// ── Letters and sounds ────────────────────────────────────────

const LETTERS = 'Letters';
const SOUNDS = 'Sounds';

/** Pictures every child knows, by first letter. Letters with no clear picture are left out. */
const PICTURES: Record<string, [string, string][]> = {
  A: [['🍎', 'apple'], ['🐜', 'ant']],
  B: [['⚽', 'ball'], ['🐝', 'bee'], ['🍌', 'banana'], ['🚌', 'bus'], ['🐦', 'bird']],
  C: [['🐱', 'cat'], ['🚗', 'car'], ['🐄', 'cow'], ['🎂', 'cake']],
  D: [['🐶', 'dog'], ['🦆', 'duck'], ['🚪', 'door']],
  E: [['🥚', 'egg'], ['🐘', 'elephant']],
  F: [['🐟', 'fish'], ['🐸', 'frog'], ['🔥', 'fire'], ['🦊', 'fox']],
  G: [['🐐', 'goat'], ['🍇', 'grapes']],
  H: [['🎩', 'hat'], ['🏠', 'house'], ['🐔', 'hen'], ['✋', 'hand']],
  K: [['🔑', 'key'], ['👑', 'king']],
  L: [['🦁', 'lion'], ['🍋', 'lemon'], ['🍃', 'leaf']],
  M: [['🥭', 'mango'], ['🐒', 'monkey'], ['🌙', 'moon'], ['🥛', 'milk']],
  N: [['👃', 'nose'], ['🥜', 'nuts']],
  O: [['🍊', 'orange'], ['🐙', 'octopus']],
  P: [['🖊️', 'pen'], ['🐷', 'pig'], ['🍍', 'pineapple']],
  Q: [['👸', 'queen']],
  R: [['🐀', 'rat'], ['🌈', 'rainbow'], ['🤖', 'robot']],
  S: [['☀️', 'sun'], ['🐍', 'snake'], ['⭐', 'star'], ['🧦', 'socks']],
  T: [['🌳', 'tree'], ['🍅', 'tomato'], ['🐯', 'tiger'], ['🚂', 'train']],
  U: [['☂️', 'umbrella']],
  V: [['🚐', 'van']],
  W: [['⌚', 'watch'], ['🍉', 'watermelon']],
  Z: [['🦓', 'zebra']],
};
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
/** Letters children mix up, used as the wrong options first. */
const MIX_UPS: Record<string, string> = { b: 'dpq', d: 'bpq', p: 'qbd', q: 'pdb', m: 'nwu', n: 'mhu', u: 'nvw', w: 'mvu', E: 'FBP', F: 'EPT', M: 'NWV', N: 'MZH', O: 'QCD', Q: 'OGC', C: 'GOU', G: 'COQ', i: 'jlt', j: 'igy', g: 'qyj' };
const mixUps = (r: Rng, l: string, pool: string[]) => [...(MIX_UPS[l] ?? '').split(''), ...r.shuffle(pool.filter((x) => x !== l))];
const pic = ([e, word]: [string, string]) => `${e} ${word}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Rhyming picture sets: any two from a set rhyme, and no word rhymes with another set. */
const RHYMES: [string, string][][] = [
  [['🐱', 'cat'], ['🎩', 'hat'], ['🐀', 'rat'], ['🦇', 'bat']],
  [['🐝', 'bee'], ['🌳', 'tree'], ['🔑', 'key']],
  [['🐐', 'goat'], ['⛵', 'boat'], ['🧥', 'coat']],
  [['⭐', 'star'], ['🚗', 'car']],
  [['🌙', 'moon'], ['🥄', 'spoon']],
  [['👑', 'king'], ['💍', 'ring']],
  [['🦊', 'fox'], ['📦', 'box'], ['🧦', 'socks']],
  [['🐔', 'hen'], ['🖊️', 'pen']],
  [['🎂', 'cake'], ['🐍', 'snake']],
];

export function nurseryLetters(c: NurseryCls): Template[] {
  const letters = Object.keys(PICTURES);
  const list: Template[] = [
    {
      key: 'nlet/find-letter',
      topic: [LETTERS, 'Find the letter'],
      difficulty: 1,
      variety: c === 1 ? 26 : 52,
      make: (r) => {
        const small = c === 2 && r.chance(0.5);
        const pool = small ? ALPHABET.map((x) => x.toLowerCase()) : ALPHABET;
        const l = r.pick(pool);
        return {
          stem: stem(`Find the ${small ? 'small ' : ''}letter you hear.`, `${SAY} ${l.toUpperCase()}`),
          answer: l,
          wrong: mixUps(r, l, pool),
          explanation: `This is the ${small ? 'small ' : ''}letter ${l.toUpperCase()}: ${l}.`,
          difficulty: small ? 2 : 1,
        };
      },
    },
    {
      key: 'nlet/first-letter',
      topic: [SOUNDS, 'First sounds'],
      difficulty: 2,
      variety: Object.values(PICTURES).flat().length,
      make: (r) => {
        const l = r.pick(letters);
        const p = r.pick(PICTURES[l]);
        return {
          stem: stem(`${cap(p[1])} starts with which letter?`, p[0]),
          answer: l,
          wrong: r.shuffle(letters.filter((x) => x !== l)),
          explanation: `${cap(p[1])} starts with ${l}. ${l} for ${p[1]}!`,
        };
      },
    },
    {
      key: 'nlet/starts-with',
      topic: [SOUNDS, 'First sounds'],
      difficulty: 2,
      make: (r) => {
        const l = r.pick(letters);
        const p = r.pick(PICTURES[l]);
        const others = r.shuffle(letters.filter((x) => x !== l)).slice(0, 3).map((x) => pic(r.pick(PICTURES[x])));
        return {
          stem: stem(`Which one starts with ${l}?`, `${SAY} ${l}`),
          answer: pic(p),
          wrong: others,
          explanation: `${cap(p[1])} starts with ${l}. ${l} for ${p[1]}!`,
        };
      },
    },
  ];
  if (c === 1) return list;
  return [
    ...list,
    {
      key: 'nlet/big-small',
      topic: [LETTERS, 'Big and small letters'],
      difficulty: 3,
      variety: 52,
      make: (r) => {
        const big = r.pick(ALPHABET);
        const toSmall = r.chance(0.5);
        const [from, to] = toSmall ? [big, big.toLowerCase()] : [big.toLowerCase(), big];
        const pool = toSmall ? ALPHABET.map((x) => x.toLowerCase()) : ALPHABET;
        return {
          stem: stem(`Find the ${toSmall ? 'small' : 'big'} letter that matches.`, from),
          answer: to,
          wrong: mixUps(r, to, pool),
          explanation: `Big ${big} and small ${big.toLowerCase()} are the same letter, ${big}.`,
        };
      },
    },
    {
      key: 'nlet/rhyme',
      topic: [SOUNDS, 'Rhyming words'],
      difficulty: 3,
      make: (r) => {
        const set = r.pick(RHYMES);
        const [w, a] = r.shuffle(set);
        const others = r.shuffle(RHYMES.filter((x) => x !== set)).slice(0, 3).map((x) => pic(r.pick(x)));
        return {
          stem: stem(`Which one rhymes with ${w[1]}?`, w[0]),
          answer: pic(a),
          wrong: others,
          explanation: `${cap(w[1])} and ${a[1]} sound the same at the end: ${w[1]}, ${a[1]}!`,
        };
      },
    },
  ];
}

// ── My world: colours, shapes, my body, animals, things around me ──

const COLOURS = 'Colours';
const SHAPES = 'Shapes';
const BODY = 'My Body';
const ANIMALS = 'Animals';
const AROUND = 'Things Around Me';

const COLOUR: Record<string, string> = { red: '🔴', yellow: '🟡', blue: '🔵', green: '🟢', orange: '🟠', purple: '🟣', brown: '🟤', black: '⚫', white: '⚪' };
const FIRST_COLOURS = ['red', 'yellow', 'blue', 'green'];
/** [picture, thing, colour]: things whose colour is never in doubt. */
const COLOURED: [string, string, string][] = [
  ['🍌', 'a ripe banana', 'yellow'],
  ['🍅', 'a tomato', 'red'],
  ['🍃', 'a leaf', 'green'],
  ['🐸', 'a frog', 'green'],
  ['🥕', 'a carrot', 'orange'],
  ['🥛', 'milk', 'white'],
  ['☀️', 'the sun', 'yellow'],
  ['🥥', 'a coconut', 'brown'],
];
/** Shapes drawn in one colour where emoji allow, so the shape is the only difference. */
const SHAPE: Record<string, string> = { circle: '🔴', square: '🟥', triangle: '🔺', heart: '❤️', star: '⭐', diamond: '♦️' };
const FIRST_SHAPES = ['circle', 'square', 'triangle', 'star'];
const SHAPED: [string, string, string][] = [
  ['⚽', 'a ball', 'circle'],
  ['🍪', 'a biscuit', 'circle'],
  ['🕐', 'a clock', 'circle'],
  ['🍕', 'a slice of pizza', 'triangle'],
  ['⚠️', 'this sign', 'triangle'],
  ['🎲', 'a dice', 'square'],
  ['📦', 'a box', 'square'],
];

/** [what we do with it, picture, part, is it a pair] */
const BODY_PARTS: [string, string, string, boolean][] = [
  ['see', '👀', 'eyes', true],
  ['hear', '👂', 'ears', true],
  ['smell', '👃', 'nose', false],
  ['eat', '👄', 'mouth', false],
  ['clap', '👏', 'hands', true],
  ['walk', '🦶', 'feet', true],
];

const SOUNDS_OF: [string, [string, string]][] = [
  ['moo', ['🐄', 'cow']],
  ['baa', ['🐑', 'sheep']],
  ['woof', ['🐶', 'dog']],
  ['meow', ['🐱', 'cat']],
  ['cock-a-doodle-doo', ['🐓', 'cock']],
  ['quack', ['🦆', 'duck']],
  ['roar', ['🦁', 'lion']],
  ['buzz', ['🐝', 'bee']],
  ['hiss', ['🐍', 'snake']],
];

const pics = (xs: [string, string][]) => xs.map(pic);

export function nurseryWorld(c: NurseryCls): Template[] {
  const colours = c === 1 ? FIRST_COLOURS : Object.keys(COLOUR);
  const shapes = c === 1 ? FIRST_SHAPES : Object.keys(SHAPE);
  const coloured = COLOURED.filter(([, , col]) => colours.includes(col));
  const list: Template[] = [
    {
      key: 'nworld/find-colour',
      topic: [COLOURS, 'Find the colour'],
      difficulty: 1,
      variety: colours.length,
      make: (r) => {
        const col = r.pick(colours);
        return {
          stem: `Find the ${col} one.`,
          answer: COLOUR[col],
          wrong: r.shuffle(colours.filter((x) => x !== col)).map((x) => COLOUR[x]),
          explanation: `This one is ${col}.`,
        };
      },
    },
    {
      key: 'nworld/colour-of',
      topic: [COLOURS, 'Colours of things'],
      difficulty: 2,
      variety: coloured.length,
      make: (r) => {
        const [e, thing, col] = r.pick(coloured);
        return {
          stem: stem(`What colour is ${thing}?`, e),
          answer: COLOUR[col],
          wrong: r.shuffle(colours.filter((x) => x !== col)).map((x) => COLOUR[x]),
          explanation: `${cap(thing)} is ${col}.`,
        };
      },
    },
    {
      key: 'nworld/find-shape',
      topic: [SHAPES, 'Find the shape'],
      difficulty: 1,
      variety: shapes.length,
      make: (r) => {
        const s = r.pick(shapes);
        return {
          stem: `Find the ${s}.`,
          answer: SHAPE[s],
          wrong: r.shuffle(shapes.filter((x) => x !== s)).map((x) => SHAPE[x]),
          explanation: `This is a ${s}.`,
        };
      },
    },
    {
      key: 'nworld/body',
      topic: [BODY, 'Parts of my body'],
      difficulty: 1,
      variety: BODY_PARTS.length * 2,
      make: (r) => {
        const row = r.pick(BODY_PARTS);
        const [does, e, part, pair] = row;
        const point = r.chance(0.5);
        return {
          stem: point ? `Find the ${part}.` : `What do we use to ${does}?`,
          answer: `${e} ${part}`,
          wrong: otherValues(r, BODY_PARTS, row, (x) => `${x[1]} ${x[2]}`),
          explanation: point ? `${pair ? 'These are' : 'This is'} the ${part}.` : `We use our ${part} to ${does}.`,
          difficulty: point ? 1 : 2,
        };
      },
    },
    {
      key: 'nworld/animal-sounds',
      topic: [ANIMALS, 'Animal sounds'],
      difficulty: 1,
      variety: SOUNDS_OF.length,
      make: (r) => {
        const row = r.pick(SOUNDS_OF);
        const [sound, animal] = row;
        return {
          stem: `Which animal says “${sound}”?`,
          answer: pic(animal),
          wrong: otherValues(r, SOUNDS_OF, row, (x) => pic(x[1])),
          explanation: `The ${animal[1]} says “${sound}”!`,
        };
      },
    },
    itemSet('nworld/things-we-use', [AROUND, 'Things we use'], 2, [
      { stem: 'What do we wear on our feet?', answer: '👟 shoes', wrong: ['🧢 cap', '👕 shirt', '🕶️ glasses'], explanation: 'We wear shoes on our feet.' },
      { stem: 'What do we wear on our head?', answer: '🧢 cap', wrong: ['👟 shoes', '🧦 socks', '👖 trousers'], explanation: 'We wear a cap on our head.' },
      { stem: 'What do we use when it rains?', answer: '☂️ umbrella', wrong: ['🕶️ glasses', '🎈 balloon', '⚽ ball'], explanation: 'An umbrella keeps us dry in the rain.' },
      { stem: 'Where do we sleep?', answer: '🛏️ bed', wrong: ['🚗 car', '🛁 bath', '🚪 door'], explanation: 'We sleep on a bed.' },
      { stem: 'What do we eat rice with?', answer: '🥄 spoon', wrong: ['✏️ pencil', '🧦 sock', '🔑 key'], explanation: 'We eat rice with a spoon.' },
      { stem: 'What do we write with?', answer: '✏️ pencil', wrong: ['🥄 spoon', '⚽ ball', '🍌 banana'], explanation: 'We write with a pencil.' },
      { stem: 'What do we wash our hands with?', answer: '🧼 soap', wrong: ['🍞 bread', '🎈 balloon', '🧢 cap'], explanation: 'We wash our hands with soap and water.' },
      { stem: 'Which one is hot?', answer: '🔥 fire', wrong: ['🧊 ice', '🍦 ice cream', '⚽ ball'], explanation: 'Fire is hot. Never touch it!' },
      { stem: 'What do we see in the sky at night?', answer: '🌙 moon', wrong: ['☀️ sun', '🌈 rainbow', '🦋 butterfly'], explanation: 'We see the moon at night.' },
      { stem: 'What gives us light in the day?', answer: '☀️ sun', wrong: ['🌙 moon', '⭐ star', '🌧️ rain'], explanation: 'The sun shines in the day.' },
    ]),
  ];
  if (c === 1) return list;
  return [
    ...list,
    {
      key: 'nworld/shape-of',
      topic: [SHAPES, 'Shapes around us'],
      difficulty: 3,
      variety: SHAPED.length,
      make: (r) => {
        const [e, thing, s] = r.pick(SHAPED);
        return {
          stem: stem(`Which shape is ${thing} like?`, e),
          answer: SHAPE[s],
          wrong: r.shuffle(shapes.filter((x) => x !== s)).map((x) => SHAPE[x]),
          explanation: `${cap(thing)} is shaped like a ${s}.`,
        };
      },
    },
    groupPick(
      'nworld/animal-homes',
      [ANIMALS, 'Where animals live'],
      2,
      {
        'lives in water': pics([['🐟', 'fish'], ['🐙', 'octopus'], ['🦀', 'crab'], ['🐳', 'whale']]),
        'can fly': pics([['🐦', 'bird'], ['🦋', 'butterfly'], ['🦅', 'eagle']]),
        'lives with people at home': pics([['🐶', 'dog'], ['🐱', 'cat'], ['🐐', 'goat']]),
        'lives in the bush': pics([['🦁', 'lion'], ['🐘', 'elephant'], ['🦒', 'giraffe'], ['🦓', 'zebra']]),
      },
      { stem: (g) => `Which animal ${g}?`, why: (a, g) => `The ${a.split(' ').slice(1).join(' ')} ${g}.` },
    ),
    {
      key: 'nworld/odd-one-out',
      topic: [AROUND, 'Odd one out'],
      difficulty: 3,
      make: (r) => {
        // [is not …, these are …]: the group, and the pictures in it.
        const groups: [string, string, [string, string][]][] = [
          ['a fruit', 'fruits', [['🍎', 'apple'], ['🍌', 'banana'], ['🍊', 'orange'], ['🥭', 'mango'], ['🍍', 'pineapple'], ['🍇', 'grapes']]],
          ['an animal', 'animals', [['🐶', 'dog'], ['🐱', 'cat'], ['🐐', 'goat'], ['🐄', 'cow'], ['🐔', 'hen']]],
          ['something we ride in', 'things we ride in', [['🚗', 'car'], ['🚌', 'bus'], ['🚲', 'bicycle'], ['✈️', 'aeroplane']]],
          ['something we wear', 'things we wear', [['👕', 'shirt'], ['👗', 'dress'], ['👟', 'shoes'], ['🧢', 'cap']]],
        ];
        const g = r.pick(groups);
        const three = r.shuffle(g[2]).slice(0, 3);
        const odd = r.pick(r.pick(groups.filter((x) => x !== g))[2]);
        return {
          stem: `Which one is not ${g[0]}?`,
          answer: pic(odd),
          wrong: three.map(pic),
          explanation: `The ${odd[1]} is not ${g[0]}. The ${three[0][1]}, ${three[1][1]} and ${three[2][1]} are ${g[1]}.`,
        };
      },
    },
  ];
}
