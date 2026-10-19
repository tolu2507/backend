import { factPairs, itemSet, num, type Template } from '../engine.js';

/** Agricultural Science, and the senior parts of CRS and IRS, for JAMB, WAEC and NECO. */

export const agriculture: Template[] = [
  factPairs(
    'agric/pests-diseases',
    ['Crop Production', 'Pests and diseases of crops'],
    2,
    [
      ['stem borer', 'maize'],
      ['cassava mosaic disease', 'cassava'],
      ['black pod disease', 'cocoa'],
      ['groundnut rosette', 'groundnut'],
      ['rice blast', 'rice'],
    ],
    { forward: (a) => `${a[0].toUpperCase() + a.slice(1)} is a serious problem of which crop?`, backward: (b) => `Which of these attacks ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} attacks ${b}.` },
  ),
  factPairs(
    'agric/animal-diseases',
    ['Animal Production', 'Animal health'],
    2,
    [
      ['Newcastle disease', 'a virus'],
      ['trypanosomiasis', 'a protozoan spread by tsetse flies'],
      ['coccidiosis', 'a protozoan in the gut'],
      ['anthrax', 'a bacterium'],
      ['ringworm', 'a fungus'],
    ],
    { forward: (a) => `${a[0].toUpperCase() + a.slice(1)} in farm animals is caused by`, backward: (b) => `Which animal disease is caused by ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} is caused by ${b}.` },
  ),
  factPairs(
    'agric/breeds',
    ['Animal Production', 'Breeds of farm animals'],
    2,
    [
      ['White Fulani', 'cattle'],
      ['Large White', 'pigs'],
      ['West African Dwarf', 'goats'],
      ['Rhode Island Red', 'poultry'],
      ['New Zealand White', 'rabbits'],
    ],
    { forward: (a) => `${a} is a breed of`, backward: (b) => `Which of these is a breed of ${b}?`, why: (a, b) => `${a} is a breed of ${b}.` },
  ),
  factPairs(
    'agric/gestation',
    ['Animal Production', 'Reproduction in farm animals'],
    3,
    [
      ['cow', 'about 9 months (283 days)'],
      ['goat', 'about 5 months (150 days)'],
      ['pig', 'about 114 days (3 months, 3 weeks, 3 days)'],
      ['rabbit', 'about 31 days'],
    ],
    { forward: (a) => `What is the gestation period of a ${a}?`, backward: (b) => `Which farm animal has a gestation period of ${b}?`, why: (a, b) => `A ${a}’s gestation period is ${b}.` },
  ),
  factPairs(
    'agric/implements',
    ['Agricultural Engineering', 'Farm machinery'],
    2,
    [
      ['plough', 'turns the soil over in the first tillage'],
      ['harrow', 'breaks up clods after ploughing'],
      ['ridger', 'makes ridges for planting'],
      ['planter', 'sows seeds at set spacing and depth'],
      ['cultivator', 'loosens the soil and removes weeds between rows'],
    ],
    { forward: (a) => `What does a tractor-drawn ${a} do?`, backward: (b) => `Which implement ${b}?`, why: (a, b) => `A ${a} ${b}.` },
  ),
  {
    key: 'agric/farm-sums',
    topic: ['Crop Production', 'Planting and fertilisers'],
    difficulty: 3,
    make: (r) => {
      if (r.chance(0.5)) {
        const [n, p, k] = r.pick([
          [15, 15, 15],
          [20, 10, 10],
          [12, 12, 17],
          [27, 13, 13],
        ]);
        const bag = r.pick([25, 50, 100]);
        const nut = r.pick(['nitrogen (N)', 'phosphate (P₂O₅)', 'potash (K₂O)'] as const);
        const share = { 'nitrogen (N)': n, 'phosphate (P₂O₅)': p, 'potash (K₂O)': k }[nut];
        const kg = (bag * share) / 100;
        return {
          stem: `How many kilograms of ${nut} are in a ${bag} kg bag of NPK ${n}:${p}:${k} fertiliser?`,
          answer: `${num(kg)} kg`,
          wrong: [share, (bag * (n + p + k)) / 100, kg * 2, bag / 3].filter((x) => x !== kg).map((x) => `${num(Math.round(x * 100) / 100)} kg`),
          explanation: `The three numbers are percentages by mass of nitrogen, phosphate and potash, in that order. ${nut[0].toUpperCase() + nut.slice(1)} is ${share}%: ${share}% of ${bag} kg = ${num(kg)} kg.`,
        };
      }
      const [rowCm, plantCm] = r.pick([
        [100, 50],
        [50, 50],
        [100, 100],
        [50, 25],
        [100, 25],
        [75, 50],
        [90, 30],
      ]);
      const ha = r.pick([1, 2]);
      const plants = (ha * 10_000) / ((rowCm / 100) * (plantCm / 100));
      if (!Number.isInteger(Math.round(plants * 1000) / 1000)) return null;
      return {
        stem: `Maize is planted at a spacing of ${rowCm} cm × ${plantCm} cm, one plant per stand. How many plants are needed for ${ha} hectare${ha > 1 ? 's' : ''}?`,
        answer: num(Math.round(plants)),
        wrong: [plants / 2, plants * 2, (ha * 10_000) / (rowCm * plantCm), (ha * 10_000) / ((rowCm + plantCm) / 100)].map((x) => num(Math.round(x))),
        explanation: `1 hectare = 10,000 m². Each plant takes ${rowCm / 100} m × ${plantCm / 100} m = ${num((rowCm * plantCm) / 10_000)} m².\nPlants = ${num(ha * 10_000)} ÷ ${num((rowCm * plantCm) / 10_000)} = ${num(Math.round(plants))}.`,
      };
    },
  },
  itemSet('agric/soil', ['Soil Science', 'Soil properties'], 2, [
    { stem: 'Which material is added to an acidic soil to raise its pH?', answer: 'lime', wrong: ['sulphur', 'ammonium sulphate', 'sawdust'], explanation: 'Liming (calcium carbonate) neutralises soil acidity.' },
    { stem: 'Which soil has the best balance of drainage and water holding for crops?', answer: 'loam', wrong: ['sand', 'clay', 'gravel'], explanation: 'Loam mixes sand, silt and clay with humus.' },
    { stem: 'The dark, decayed organic matter in soil is called', answer: 'humus', wrong: ['subsoil', 'parent rock', 'laterite'], explanation: 'Humus improves soil structure, water holding and fertility.' },
    { stem: 'Growing different crops on the same land in a planned order each season is', answer: 'crop rotation', wrong: ['mixed cropping', 'monocropping', 'shifting cultivation'], explanation: 'Crop rotation keeps soil fertile and breaks pest cycles.' },
    { stem: 'Which of these is a legume that improves soil nitrogen?', answer: 'cowpea', wrong: ['maize', 'sorghum', 'cassava'], explanation: 'Legumes host nitrogen-fixing Rhizobium bacteria in root nodules.' },
  ]),
];

export const crsSenior: Template[] = [
  itemSet('crs/prophets', ['The Old Testament', 'Kings and prophets'], 3, [
    { stem: 'Which prophet is best known for preaching social justice and condemning the oppression of the poor?', answer: 'Amos', wrong: ['Hosea', 'Jonah', 'Elisha'], explanation: 'Amos said, “Let justice roll down like waters” (Amos 5:24).' },
    { stem: 'Which prophet married an unfaithful wife, Gomer, as a picture of God’s love for Israel?', answer: 'Hosea', wrong: ['Amos', 'Isaiah', 'Ezekiel'], explanation: 'Hosea’s marriage showed God’s faithful love despite Israel’s unfaithfulness.' },
    { stem: 'Which prophet received his call in a vision of God in the temple, saying “Here am I; send me”?', answer: 'Isaiah', wrong: ['Jeremiah', 'Ezekiel', 'Amos'], explanation: 'Isaiah 6 describes his call in the temple.' },
    { stem: 'Which prophet was swallowed by a great fish after running from God’s call?', answer: 'Jonah', wrong: ['Elijah', 'Daniel', 'Micah'], explanation: 'Jonah fled from his mission to Nineveh (Jonah 1).' },
    { stem: 'Who was thrown into the lions’ den for praying to God?', answer: 'Daniel', wrong: ['Shadrach', 'Ezekiel', 'Jeremiah'], explanation: 'God shut the lions’ mouths and Daniel was unharmed (Daniel 6).' },
  ]),
  itemSet('crs/teachings', ['The Life of Jesus', 'Miracles and parables'], 3, [
    { stem: '“Blessed are the meek, for they shall inherit the earth” is part of the', answer: 'Sermon on the Mount', wrong: ['Lord’s Prayer', 'Ten Commandments', 'Great Commission'], explanation: 'The Beatitudes open the Sermon on the Mount (Matthew 5).' },
    { stem: 'In his letter to the Romans, Paul teaches that people are made right with God by', answer: 'faith in Jesus Christ', wrong: ['keeping the law of Moses', 'offering sacrifices', 'giving to the poor'], explanation: 'Romans teaches justification by faith.' },
    { stem: 'The Great Commission is Jesus’ command to', answer: 'make disciples of all nations', wrong: ['build a temple', 'keep the Sabbath', 'sell all possessions'], explanation: 'Matthew 28:19: “Go therefore and make disciples of all nations.”' },
  ]),
];

export const irsSenior: Template[] = [
  factPairs(
    'irs/battles',
    ['Sirah', 'Battles and treaties'],
    3,
    [
      ['the Battle of Badr', '624 CE (2 AH)'],
      ['the Battle of Uhud', '625 CE (3 AH)'],
      ['the Battle of the Trench (Khandaq)', '627 CE (5 AH)'],
      ['the Treaty of Hudaybiyyah', '628 CE (6 AH)'],
      ['the conquest of Makkah', '630 CE (8 AH)'],
    ],
    { forward: (a) => `When did ${a} take place?`, backward: (b) => `What took place in ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} took place in ${b}.` },
  ),
  itemSet('irs/shariah', ['Tawhid and Fiqh', 'Sources of Shari’ah'], 3, [
    { stem: 'Which is the first and main source of the Shari’ah?', answer: 'the Qur’an', wrong: ['Ijma', 'Qiyas', 'Hadith'], explanation: 'The sources in order are the Qur’an, the Sunnah (Hadith), Ijma (consensus) and Qiyas (analogy).' },
    { stem: 'In Islamic law, Ijma means', answer: 'the agreement of Muslim scholars on a matter', wrong: ['reasoning by analogy', 'the sayings of the Prophet', 'personal opinion'], explanation: 'Ijma is the consensus of qualified scholars.' },
    { stem: 'In Islamic law, Qiyas means', answer: 'reasoning by analogy from an existing ruling', wrong: ['the consensus of scholars', 'the practice of Madinah', 'a revealed verse'], explanation: 'Qiyas applies an existing ruling to a new case with the same cause.' },
    { stem: 'Who compiled the most widely accepted collection of Hadith, the Sahih?', answer: 'Imam al-Bukhari', wrong: ['Imam Malik', 'Imam Abu Hanifa', 'Imam Shafi’i'], explanation: 'Sahih al-Bukhari (with Sahih Muslim) is the most widely accepted Hadith collection.' },
  ]),
];
