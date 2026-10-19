import { factPairs, itemSet, otherValues, type Template } from '../engine.js';
import type { Cls } from './maths.js';

/** Primary 1–5 English and Basic Science, pitched by class. */

const WORDS = 'Words and Spelling';
const GRAM = 'Grammar';

/** [singular, plural, wrong plurals] for younger pupils: regular patterns only. */
const EASY_PLURALS: [string, string, string[]][] = [
  ['cat', 'cats', ['cates', 'caties', 'cat']],
  ['box', 'boxes', ['boxs', 'boxies', 'box']],
  ['baby', 'babies', ['babys', 'babyes', 'babis']],
  ['bus', 'buses', ['buss', 'busies', 'bus']],
  ['lady', 'ladies', ['ladys', 'ladyes', 'ladis']],
  ['dog', 'dogs', ['doges', 'dogies', 'dog']],
  ['church', 'churches', ['churchs', 'churchies', 'church']],
  ['city', 'cities', ['citys', 'cityes', 'citis']],
];
/** Simple opposites. */
const OPP: [string, string][] = [
  ['big', 'small'],
  ['hot', 'cold'],
  ['up', 'down'],
  ['happy', 'sad'],
  ['fast', 'slow'],
  ['day', 'night'],
  ['open', 'shut'],
  ['tall', 'short'],
  ['full', 'empty'],
  ['old', 'new'],
];
const RHYME: string[][] = [
  ['cat', 'hat', 'mat', 'bat'],
  ['ball', 'wall', 'tall', 'call'],
  ['cake', 'lake', 'bake', 'snake'],
  ['ring', 'king', 'sing', 'wing'],
  ['pen', 'hen', 'ten', 'men'],
  ['sun', 'run', 'fun', 'bun'],
  ['boat', 'goat', 'coat', 'float'],
];
/** Simple past tense. */
const PAST: [string, string, string[], string][] = [
  ['go', 'went', ['goed', 'gone', 'going'], 'to the market'],
  ['eat', 'ate', ['eated', 'eaten', 'eats'], 'all her rice'],
  ['run', 'ran', ['runned', 'runs', 'running'], 'to school'],
  ['see', 'saw', ['seed', 'seen', 'sees'], 'a big lion at the zoo'],
  ['come', 'came', ['comed', 'comes', 'coming'], 'home early'],
  ['sing', 'sang', ['singed', 'sung', 'sings'], 'a song in class'],
  ['write', 'wrote', ['writed', 'written', 'writes'], 'a letter to her aunt'],
  ['play', 'played', ['plaid', 'playing', 'plays'], 'football with her friends'],
  ['jump', 'jumped', ['jumpt', 'jumps', 'jumping'], 'over the gutter'],
];

export function primaryEnglish(c: Cls): Template[] {
  const list: Template[] = [
    {
      key: 'penglish/opposites',
      topic: [WORDS, 'Opposites'],
      difficulty: 1,
      variety: OPP.length * 2,
      make: (r) => {
        const row = r.pick(OPP);
        const flip = r.chance(0.5);
        const [w, o] = flip ? [row[1], row[0]] : row;
        return { stem: `What is the opposite of “${w}”?`, answer: o, wrong: otherValues(r, OPP, row, (x) => (flip ? x[0] : x[1])), explanation: `The opposite of “${w}” is “${o}”.` };
      },
    },
    {
      key: 'penglish/rhymes',
      topic: [WORDS, 'Rhymes and sounds'],
      difficulty: 1,
      make: (r) => {
        const set = r.pick(RHYME);
        const [w, a] = r.shuffle(set).slice(0, 2);
        const others = r.shuffle(RHYME.filter((x) => x !== set)).slice(0, 3).map((x) => r.pick(x));
        return { stem: `Which word rhymes with “${w}”?`, answer: a, wrong: others, explanation: `“${w}” and “${a}” end with the same sound.` };
      },
    },
    {
      key: 'penglish/plurals',
      topic: [GRAM, 'Nouns'],
      difficulty: 1,
      variety: EASY_PLURALS.length,
      make: (r) => {
        const [one, many, wrong] = r.pick(EASY_PLURALS);
        return { stem: `One ${one}, two ___`, answer: many, wrong, explanation: one.endsWith('y') ? `For words ending in a consonant + y, change y to i and add -es: ${many}.` : /(s|x|ch|sh)$/.test(one) ? `Words ending in s, x, ch or sh add -es: ${many}.` : `Most words just add -s: ${many}.` };
      },
    },
    {
      key: 'penglish/a-an',
      topic: [GRAM, 'Articles'],
      difficulty: 1,
      variety: 12,
      make: (r) => {
        const word = r.pick(['apple', 'egg', 'orange', 'umbrella', 'elephant', 'ant', 'boy', 'cat', 'book', 'mango', 'dog', 'girl']);
        const ans = /^[aeiou]/.test(word) ? 'an' : 'a';
        return { stem: `Fill in the gap: I saw ___ ${word}.`, answer: ans, wrong: [ans === 'an' ? 'a' : 'an', 'the two', 'some a'], explanation: `Use “an” before a vowel sound (a, e, i, o, u) and “a” before other sounds: ${ans} ${word}.` };
      },
    },
  ];
  if (c >= 3) {
    list.push({
      key: 'penglish/past-tense',
      topic: [GRAM, 'Verbs and tenses'],
      difficulty: 2,
      variety: PAST.length,
      make: (r) => {
        const [base, past, wrong, rest] = r.pick(PAST);
        return { stem: `Yesterday, Ada ___ (${base}) ${rest}.`, answer: past, wrong, explanation: `“Yesterday” tells us the action is in the past: ${base} → ${past}.` };
      },
    });
    list.push(
      itemSet('penglish/pronouns-prepositions', [GRAM, 'Pronouns and prepositions'], 2, [
        { stem: 'Musa and I are friends. ___ play together every day.', answer: 'We', wrong: ['They', 'He', 'Us'], explanation: '“Musa and I” is “we”.' },
        { stem: 'This bag belongs to Ngozi. It is ___ bag.', answer: 'her', wrong: ['his', 'their', 'she'], explanation: 'Ngozi is a girl’s name here, and “her” shows the bag is hers.' },
        { stem: 'The cat is hiding ___ the table.', answer: 'under', wrong: ['at', 'of', 'from'], explanation: '“Under” tells us where the cat is.' },
        { stem: 'We go to school ___ Monday.', answer: 'on', wrong: ['in', 'at', 'by'], explanation: 'Use “on” with days: on Monday.' },
        { stem: 'My birthday is ___ June.', answer: 'in', wrong: ['on', 'at', 'by'], explanation: 'Use “in” with months: in June.' },
        { stem: 'The children ___ playing in the field.', answer: 'are', wrong: ['is', 'am', 'was being'], explanation: '“Children” is plural, so we use “are”.' },
      ]),
    );
  }
  return list;
}

const LIVING = 'Living Things';
const WORLD = 'Our World';

export function primaryScience(c: Cls): Template[] {
  const list: Template[] = [
    factPairs(
      'pscience/senses',
      [LIVING, 'Our body and senses'],
      1,
      [
        ['eyes', 'see'],
        ['ears', 'hear'],
        ['nose', 'smell'],
        ['tongue', 'taste'],
        ['skin', 'feel'],
      ],
      { forward: (a) => `We use our ${a} to`, backward: (b) => `Which part of the body do we use to ${b}?`, why: (a, b) => `We use our ${a} to ${b}.` },
    ),
    factPairs(
      'pscience/animal-young',
      [LIVING, 'Animals'],
      1,
      [
        ['cat', 'kitten'],
        ['dog', 'puppy'],
        ['cow', 'calf'],
        ['goat', 'kid'],
        ['hen', 'chick'],
        ['sheep', 'lamb'],
      ],
      { forward: (a) => `What is the young one of a ${a} called?`, backward: (b) => `A ${b} is the young one of which animal?`, why: (a, b) => `The young one of a ${a} is a ${b}.` },
    ),
    itemSet('pscience/plant-parts', [LIVING, 'Plants'], 1, [
      { stem: 'Which part of a plant takes in water from the soil?', answer: 'the roots', wrong: ['the leaves', 'the flower', 'the fruit'], explanation: 'Roots take in water and hold the plant in the ground.' },
      { stem: 'Which part of a plant makes food using sunlight?', answer: 'the leaves', wrong: ['the roots', 'the stem', 'the seed'], explanation: 'Green leaves use sunlight to make food.' },
      { stem: 'Which part of a plant holds it up and carries water to the leaves?', answer: 'the stem', wrong: ['the roots', 'the flower', 'the leaves'], explanation: 'The stem holds the plant up.' },
      { stem: 'Which part of a plant makes seeds?', answer: 'the flower', wrong: ['the roots', 'the stem', 'the leaves'], explanation: 'Flowers make seeds, which grow into new plants.' },
    ]),
    itemSet('pscience/weather-day', [WORLD, 'Weather and the sky'], 1, [
      { stem: 'What gives us light and heat during the day?', answer: 'the sun', wrong: ['the moon', 'the stars', 'the clouds'], explanation: 'The sun gives the earth light and heat.' },
      { stem: 'Which season brings a lot of rain in Nigeria?', answer: 'the rainy season', wrong: ['the dry season', 'harmattan', 'winter'], explanation: 'Nigeria has a rainy season and a dry season.' },
      { stem: 'The cold, dry, dusty wind in the dry season is called', answer: 'harmattan', wrong: ['monsoon', 'storm', 'breeze'], explanation: 'Harmattan blows from the Sahara Desert.' },
      { stem: 'What do we use to keep dry when it rains?', answer: 'an umbrella', wrong: ['a fan', 'sunglasses', 'a torch'], explanation: 'An umbrella keeps the rain off.' },
      { stem: 'Which of these do we see in the sky at night?', answer: 'the moon and stars', wrong: ['the rainbow only', 'the sun', 'the clouds only'], explanation: 'At night we can see the moon and stars.' },
    ]),
    itemSet('pscience/health', [LIVING, 'Health and safety'], 1, [
      { stem: 'When should you wash your hands?', answer: 'before eating and after using the toilet', wrong: ['only once a week', 'only when they look dirty', 'never'], explanation: 'Washing hands removes germs that cause illness.' },
      { stem: 'Which of these helps to keep our teeth healthy?', answer: 'brushing twice a day', wrong: ['eating sweets at night', 'never brushing', 'drinking soft drinks all day'], explanation: 'Brush in the morning and at night.' },
      { stem: 'Which insect spreads malaria?', answer: 'the mosquito', wrong: ['the housefly', 'the butterfly', 'the bee'], explanation: 'Mosquito bites spread malaria, so sleep under a treated net.' },
      { stem: 'What should you do before crossing the road?', answer: 'look left, look right, then look left again', wrong: ['run across quickly', 'close your eyes', 'cross between parked cars'], explanation: 'Stop, look and listen before crossing.' },
    ]),
  ];
  if (c >= 3) {
    list.push(
      itemSet('pscience/matter-energy', [WORLD, 'Materials and energy'], 2, [
        { stem: 'Water turns into ice when it', answer: 'freezes', wrong: ['boils', 'melts', 'evaporates'], explanation: 'Freezing turns a liquid into a solid.' },
        { stem: 'Ice turns into water when it', answer: 'melts', wrong: ['freezes', 'boils', 'condenses'], explanation: 'Melting turns a solid into a liquid.' },
        { stem: 'Which of these is attracted by a magnet?', answer: 'an iron nail', wrong: ['a plastic spoon', 'a wooden ruler', 'a paper cup'], explanation: 'Magnets attract iron and steel.' },
        { stem: 'Which of these can let electricity pass through it?', answer: 'a copper wire', wrong: ['a rubber band', 'a plastic ruler', 'a piece of cloth'], explanation: 'Metals such as copper conduct electricity.' },
        { stem: 'Which of these is a solid?', answer: 'a stone', wrong: ['water', 'air', 'oil'], explanation: 'A solid keeps its own shape.' },
      ]),
    );
    list.push(
      itemSet('pscience/body-organs', [LIVING, 'Our body and senses'], 2, [
        { stem: 'Which part of the body pumps blood round the body?', answer: 'the heart', wrong: ['the lungs', 'the stomach', 'the brain'], explanation: 'The heart is a pump.' },
        { stem: 'Which parts of the body help us to breathe?', answer: 'the lungs', wrong: ['the kidneys', 'the stomach', 'the heart'], explanation: 'We breathe air in and out of our lungs.' },
        { stem: 'Which part of the body digests the food we eat?', answer: 'the stomach', wrong: ['the heart', 'the lungs', 'the brain'], explanation: 'Food is broken down in the stomach.' },
        { stem: 'Which part of the body controls the whole body?', answer: 'the brain', wrong: ['the heart', 'the stomach', 'the skin'], explanation: 'The brain controls everything we do.' },
      ]),
    );
  }
  if (c >= 4) {
    list.push(
      factPairs(
        'pscience/food-classes',
        [LIVING, 'Food and nutrition'],
        2,
        [
          ['yam', 'carbohydrates (energy foods)'],
          ['beans', 'proteins (body-building foods)'],
          ['oranges', 'vitamins (protective foods)'],
          ['palm oil', 'fats and oils'],
        ],
        { forward: (a) => `${a[0].toUpperCase() + a.slice(1)} is mainly a source of`, backward: (b) => `Which food is mainly a source of ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} gives us ${b}.` },
      ),
    );
  }
  return list;
}
