import { factPairs, groupPick, itemSet, naira, num, type Template } from '../engine.js';

/** Animal Husbandry, Fisheries, Insurance, Marketing and Office Practice (WAEC/NECO electives). */

const LIVE = 'Livestock Management';

export const animalHusbandry: Template[] = [
  factPairs(
    'husbandry/terms',
    [LIVE, 'Terms used for farm animals'],
    2,
    [
      ['heifer', 'a young female cow that has not yet calved'],
      ['steer', 'a castrated male cattle'],
      ['gilt', 'a young female pig that has not yet farrowed'],
      ['ewe', 'an adult female sheep'],
      ['doe', 'an adult female goat or rabbit'],
      ['pullet', 'a young female chicken before it starts laying'],
    ],
    { forward: (a) => `In animal husbandry, a ${a} is`, backward: (b) => `What is ${b} called?`, why: (a, b) => `A ${a} is ${b}.` },
  ),
  factPairs(
    'husbandry/rumen',
    [LIVE, 'Digestion in ruminants'],
    3,
    [
      ['rumen', 'the largest chamber, where microbes ferment grass'],
      ['reticulum', 'the honeycomb chamber that forms the cud'],
      ['omasum', 'the chamber that absorbs water from the food'],
      ['abomasum', 'the true stomach, which produces digestive juices'],
    ],
    { forward: (a) => `In a cow’s stomach, the ${a} is`, backward: (b) => `Which part of a ruminant’s stomach is ${b}?`, why: (a, b) => `The ${a} is ${b}.` },
  ),
  groupPick(
    'husbandry/feeds',
    ['Animal Nutrition', 'Feeds and feeding'],
    2,
    { concentrate: ['maize grain', 'groundnut cake', 'fish meal', 'palm kernel cake'], roughage: ['hay', 'silage', 'fresh grass', 'straw'] },
    { stem: (g) => `Which of these feeds is a ${g}?`, why: (a, g) => `${a[0].toUpperCase() + a.slice(1)} is a ${g}: ${g === 'concentrate' ? 'rich in energy or protein and low in fibre' : 'bulky and high in fibre'}.` },
  ),
  itemSet('husbandry/systems', [LIVE, 'Systems of keeping animals'], 2, [
    { stem: 'Keeping hens in small wire cages, usually one to three birds each, is the', answer: 'battery cage system', wrong: ['deep litter system', 'free range system', 'extensive system'], explanation: 'Battery cages save space and make egg collection easy.' },
    { stem: 'Keeping poultry indoors on a thick layer of wood shavings or sawdust is the', answer: 'deep litter system', wrong: ['battery cage system', 'free range system', 'paddocking'], explanation: 'The litter absorbs droppings and is changed regularly.' },
    { stem: 'Which breed of cattle can tolerate trypanosomiasis?', answer: 'N’Dama', wrong: ['White Fulani', 'Red Bororo', 'Sokoto Gudali'], explanation: 'The N’Dama is trypanotolerant, so it survives in tsetse areas.' },
    { stem: 'Removing the testes of a male animal is called', answer: 'castration', wrong: ['dehorning', 'debeaking', 'culling'], explanation: 'Castration makes males calmer and improves meat quality.' },
  ]),
];

export const fisheries: Template[] = [
  itemSet('fisheries/basics', ['Fish Farming', 'Fish culture'], 2, [
    { stem: 'Young fish stocked into a pond are called', answer: 'fingerlings', wrong: ['tadpoles', 'larvae of insects', 'spawn'], explanation: 'Fingerlings are young fish about the size of a finger.' },
    { stem: 'Which two fish are most widely farmed in Nigeria?', answer: 'catfish and tilapia', wrong: ['shark and tuna', 'salmon and trout', 'mackerel and sardine'], explanation: 'Catfish (Clarias) and tilapia grow fast in ponds.' },
    { stem: 'Which organ helps a bony fish stay at the right depth in water?', answer: 'swim bladder', wrong: ['gills', 'lateral line', 'operculum'], explanation: 'The swim bladder controls buoyancy.' },
    { stem: 'The lateral line of a fish detects', answer: 'vibrations and water movement', wrong: ['light', 'oxygen', 'food taste'], explanation: 'The lateral line senses movement and pressure changes.' },
    { stem: 'Through which organ does a fish take in oxygen?', answer: 'gills', wrong: ['swim bladder', 'fins', 'lateral line'], explanation: 'Water passes over the gills, where oxygen enters the blood.' },
  ]),
  groupPick(
    'fisheries/gear',
    ['Fishing', 'Fishing gear and preservation'],
    2,
    { 'fishing gear': ['gill net', 'cast net', 'hook and line', 'fish trap'], 'method of preserving fish': ['smoking', 'sun-drying', 'salting', 'freezing'] },
    { stem: (g) => `Which of these is a ${g}?`, why: (a, g) => `${a[0].toUpperCase() + a.slice(1)} is a ${g}.` },
  ),
];

const INS = 'Principles and Practice of Insurance';

export const insurance: Template[] = [
  factPairs(
    'insurance/terms',
    [INS, 'Insurance terms'],
    2,
    [
      ['premium', 'the amount the insured pays for cover'],
      ['policy', 'the document that contains the insurance contract'],
      ['proposal form', 'the form filled in to apply for insurance'],
      ['claim', 'a request for payment after a loss'],
      ['actuary', 'an expert who works out risks and premiums'],
      ['broker', 'an agent who arranges insurance for clients with insurers'],
    ],
    { forward: (a) => `In insurance, what is a ${a}?`, backward: (b) => `In insurance, what is ${b} called?`, why: (a, b) => `A ${a} is ${b}.` },
  ),
  {
    key: 'insurance/sums',
    topic: [INS, 'Premiums and claims'],
    difficulty: 3,
    make: (r) => {
      if (r.chance(0.5)) {
        const sum = r.pick([500_000, 1_000_000, 2_000_000, 5_000_000]);
        const rate = r.pick([0.5, 1, 1.5, 2, 2.5]);
        const prem = (sum * rate) / 100;
        return {
          stem: `A building is insured for ${naira(sum)} at a premium rate of ${num(rate)}%. What is the yearly premium?`,
          answer: naira(prem),
          wrong: [prem * 10, prem / 10, sum - prem].map(naira),
          explanation: `Premium = ${num(rate)}% of ${naira(sum)} = ${naira(prem)}.`,
        };
      }
      const value = r.pick([1_000_000, 2_000_000, 4_000_000]);
      const insured = value * r.pick([0.5, 0.6, 0.75, 0.8]);
      const loss = r.pick([200_000, 400_000, 500_000, 800_000]);
      const pay = (loss * insured) / value;
      return {
        stem: `Goods worth ${naira(value)} are insured for only ${naira(insured)}, under a policy with an average clause. A fire causes a loss of ${naira(loss)}. How much will the insurer pay?`,
        answer: naira(pay),
        wrong: [loss, insured, loss - pay].filter((x) => x !== pay).map(naira),
        explanation: `Under-insured goods are paid in proportion: ${naira(loss)} × ${naira(insured)} ÷ ${naira(value)} = ${naira(pay)}.`,
      };
    },
  },
  itemSet('insurance/types', [INS, 'Types of insurance'], 2, [
    { stem: 'Which type of motor insurance is compulsory by law in Nigeria?', answer: 'third-party insurance', wrong: ['comprehensive insurance', 'fire and theft insurance', 'accident insurance'], explanation: 'Every vehicle must have at least third-party cover.' },
    { stem: 'Assurance (rather than insurance) covers', answer: 'an event that is certain to happen, such as death', wrong: ['fire', 'theft', 'accidents'], explanation: 'Life assurance covers something certain to happen; insurance covers what may happen.' },
    { stem: 'Which body regulates insurance companies in Nigeria?', answer: 'NAICOM', wrong: ['CBN', 'SEC', 'NAFDAC'], explanation: 'The National Insurance Commission (NAICOM) regulates insurance.' },
    { stem: 'Insurance of ships and their cargo is called', answer: 'marine insurance', wrong: ['fire insurance', 'life assurance', 'fidelity guarantee'], explanation: 'Marine insurance covers ships, cargo and freight.' },
  ]),
];

const MKT = 'Principles of Marketing';

export const marketing: Template[] = [
  factPairs(
    'marketing/plc',
    [MKT, 'Product life cycle'],
    2,
    [
      ['introduction', 'the product is new, sales are low and promotion costs are high'],
      ['growth', 'sales rise quickly and competitors appear'],
      ['maturity', 'sales level off and competition is strongest'],
      ['decline', 'sales fall as buyers move to newer products'],
    ],
    { forward: (a) => `At the ${a} stage of the product life cycle,`, backward: (b) => `At which stage of the product life cycle do we see that ${b}?`, why: (a, b) => `At the ${a} stage, ${b}.` },
  ),
  itemSet('marketing/mix', [MKT, 'The marketing mix'], 2, [
    { stem: 'The four Ps of the marketing mix are', answer: 'product, price, place and promotion', wrong: ['people, profit, plan and price', 'product, profit, place and packaging', 'promotion, people, power and price'], explanation: 'The marketing mix is product, price, place and promotion.' },
    { stem: 'Setting a high price when a new product is launched is called', answer: 'price skimming', wrong: ['penetration pricing', 'cost-plus pricing', 'psychological pricing'], explanation: 'Skimming charges a high early price to early buyers.' },
    { stem: 'Setting a low price to win a large market share quickly is', answer: 'penetration pricing', wrong: ['price skimming', 'premium pricing', 'price discrimination'], explanation: 'Penetration pricing attracts many buyers fast.' },
    { stem: 'Dividing a market into groups of buyers with similar needs is called', answer: 'market segmentation', wrong: ['market research', 'branding', 'distribution'], explanation: 'Segments can be based on age, income, location and so on.' },
    { stem: 'Which of these is part of the promotion mix?', answer: 'personal selling', wrong: ['warehousing', 'packaging design', 'production planning'], explanation: 'The promotion mix is advertising, personal selling, sales promotion and public relations.' },
  ]),
];

export const officePractice: Template[] = [
  factPairs(
    'office/meetings',
    ['Office Procedures', 'Meetings and correspondence'],
    2,
    [
      ['agenda', 'the list of items to be discussed at a meeting'],
      ['minutes', 'the written record of what was decided at a meeting'],
      ['memorandum (memo)', 'a short written message sent within an organisation'],
      ['quorum', 'the least number of members needed for a meeting to be valid'],
    ],
    { forward: (a) => `What is a${/^[aeiou]/.test(a) ? 'n' : ''} ${a}?`, backward: (b) => `What is ${b} called?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)}: ${b}.` },
  ),
  factPairs(
    'office/filing',
    ['Office Procedures', 'Filing and records'],
    2,
    [
      ['alphabetical filing', 'by the names of people or firms, A to Z'],
      ['numerical filing', 'by numbers given to each file'],
      ['geographical filing', 'by place, such as state or town'],
      ['subject filing', 'by topic, such as “Salaries” or “Repairs”'],
      ['chronological filing', 'by date'],
    ],
    { forward: (a) => `In ${a}, files are arranged`, backward: (b) => `Which filing system arranges files ${b}?`, why: (a, b) => `In ${a}, files are arranged ${b}.` },
  ),
];
