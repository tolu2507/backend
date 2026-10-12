import type { ActivityType, EducationLevel } from '@prisma/client';

import { numbered, q, type Q } from './helpers.js';

type Activity = { level: EducationLevel; subject: string; title: string; topic: string; type: ActivityType; xpReward: number; questions: Q[] };

const a = (level: EducationLevel, subject: string, title: string, topic: string, qs: ReturnType<typeof q>[], xpReward = 20): Activity => ({
  level, subject, title, topic, type: 'QUIZ', xpReward, questions: numbered(qs),
});

/** Student quests. Every answer has been checked by hand. */
export const ACTIVITIES: Activity[] = [
  // ── Primary ────────────────────────────────────────────
  a('PRIMARY', 'Mathematics', 'Counting in 2s, 5s and 10s', 'Skip counting', [
    q('What comes next? 2, 4, 6, 8, …', ['9', '10', '12', '11'], 1),
    q('What comes next? 5, 10, 15, 20, …', ['21', '30', '25', '22'], 2),
    q('What comes next? 10, 20, 30, …', ['40', '31', '35', '50'], 0),
    q('Tobi counts 5 hands. How many fingers are there?', ['20', '15', '25', '10'], 2),
    q('Ada has 6 pairs of shoes. How many shoes is that?', ['6', '8', '10', '12'], 3),
  ], 10),
  a('PRIMARY', 'Mathematics', 'Adding and taking away', 'Addition and subtraction', [
    q('14 + 7 = ?', ['20', '21', '22', '19'], 1),
    q('30 − 12 = ?', ['18', '22', '12', '28'], 0),
    q('Mama bought 25 oranges and gave away 9. How many are left?', ['14', '16', '34', '15'], 1),
    q('There are 48 pupils in Primary 3 and 37 in Primary 4. How many pupils altogether?', ['75', '85', '84', '95'], 1),
    q('₦50 − ₦35 = ?', ['₦25', '₦15', '₦20', '₦5'], 1),
  ], 10),
  a('PRIMARY', 'English Language', 'Spell it right', 'Spelling everyday words', [
    q('Which word is spelt correctly?', ['scool', 'school', 'skool', 'schol'], 1),
    q('Which word is spelt correctly?', ['frend', 'freind', 'friend', 'friand'], 2),
    q('Which word is spelt correctly?', ['because', 'becos', 'becuase', 'bicause'], 0),
    q('Which word is spelt correctly?', ['tomorow', 'tommorrow', 'tomorrow', 'tomorro'], 2),
    q('Which word is spelt correctly?', ['beautiful', 'beutiful', 'beautifull', 'butiful'], 0),
  ], 10),
  a('PRIMARY', 'English Language', 'Naming and doing words', 'Nouns and verbs', [
    q('Which word is a naming word (noun)?', ['run', 'happy', 'table', 'quickly'], 2),
    q('Which word is a doing word (verb)?', ['jump', 'chair', 'blue', 'Lagos'], 0),
    q('In "The dog barked", which word is the verb?', ['The', 'dog', 'barked', 'none'], 2),
    q('In "Kemi reads a book", which word is a noun?', ['reads', 'a', 'Kemi', 'none'], 2),
    q('Which of these is a verb?', ['swim', 'river', 'fish', 'water'], 0),
  ], 10),
  a('PRIMARY', 'Basic Science', 'Living or non-living?', 'Living and non-living things', [
    q('Which of these is a living thing?', ['Stone', 'Goat', 'Chair', 'Bucket'], 1),
    q('Which of these is NOT a living thing?', ['Mango tree', 'Hen', 'Car', 'Grass'], 2),
    q('Living things need ___ to stay alive.', ['food and water', 'paint', 'music', 'shoes'], 0),
    q('Plants make their food using ___.', ['moonlight', 'sunlight', 'sand', 'stones'], 1),
    q('Which of these can grow?', ['A table', 'A baby', 'A spoon', 'A pencil'], 1),
  ], 10),
  a('PRIMARY', 'Verbal Reasoning', 'Opposites', 'Antonyms', [
    q('What is the opposite of "hot"?', ['warm', 'cold', 'sunny', 'big'], 1),
    q('What is the opposite of "tall"?', ['short', 'long', 'high', 'thin'], 0),
    q('What is the opposite of "happy"?', ['glad', 'sad', 'kind', 'funny'], 1),
    q('What is the opposite of "open"?', ['shut', 'door', 'wide', 'push'], 0),
    q('What is the opposite of "early"?', ['soon', 'quick', 'late', 'first'], 2),
  ], 10),
  a('PRIMARY', 'Quantitative Reasoning', 'Number patterns', 'Patterns', [
    q('Find the missing number: 3, 6, 9, __, 15', ['10', '11', '12', '13'], 2),
    q('Find the missing number: 20, 18, 16, __, 12', ['15', '14', '13', '10'], 1),
    q('Find the missing number: 1, 2, 4, 8, __', ['10', '12', '14', '16'], 3),
    q('Find the missing number: 7, 14, 21, __', ['27', '28', '24', '35'], 1),
    q('Find the missing number: 100, 90, 80, __', ['60', '75', '70', '79'], 2),
  ], 10),

  // ── Junior Secondary ───────────────────────────────────
  a('JUNIOR_SECONDARY', 'Mathematics', 'Fractions workout', 'Fractions', [
    q('1/2 + 1/4 = ?', ['2/6', '3/4', '1/6', '2/4'], 1),
    q('Simplify 12/18.', ['2/3', '3/4', '6/9', '4/6'], 0),
    q('3/5 of ₦200 is:', ['₦60', '₦100', '₦120', '₦150'], 2),
    q('Which fraction is the largest?', ['2/5', '1/2', '3/8', '1/3'], 1),
    q('2/3 × 3/4 = ?', ['1/2', '5/7', '6/7', '2/4'], 0),
  ]),
  a('JUNIOR_SECONDARY', 'Mathematics', 'Solve for x', 'Simple equations', [
    q('Solve: x + 7 = 15', ['x = 22', 'x = 8', 'x = 7', 'x = 9'], 1),
    q('Solve: 3x = 27', ['x = 24', 'x = 30', 'x = 9', 'x = 81'], 2),
    q('Solve: 2x − 5 = 11', ['x = 3', 'x = 8', 'x = 6', 'x = 16'], 1),
    q('Solve: x/4 = 5', ['x = 20', 'x = 9', 'x = 1.25', 'x = 1'], 0),
    q('A number plus 12 is 30. What is the number?', ['42', '18', '12', '28'], 1),
  ]),
  a('JUNIOR_SECONDARY', 'English Language', 'Parts of speech', 'Parts of speech', [
    q('In "She sang beautifully", "beautifully" is an:', ['adjective', 'adverb', 'noun', 'pronoun'], 1),
    q('In "The red car is new", "red" is an:', ['adjective', 'adverb', 'verb', 'preposition'], 0),
    q('Which word is a pronoun?', ['quickly', 'they', 'under', 'table'], 1),
    q('In "The book is on the table", "on" is a:', ['conjunction', 'verb', 'preposition', 'noun'], 2),
    q('Which word is a conjunction?', ['and', 'run', 'big', 'he'], 0),
  ]),
  a('JUNIOR_SECONDARY', 'English Language', 'Punctuation check', 'Punctuation', [
    q('Which sentence is punctuated correctly?', ['where are you going', 'Where are you going?', 'where are you going?', 'Where are you going.'], 1),
    q('Which shows correct use of the apostrophe?', ["The boys's bag", "The boy's bag", "The boys bag's", "The boy bag's"], 1),
    q('Which mark ends an exclamation?', ['.', ',', '!', ';'], 2),
    q('"I bought yams, rice and beans." The commas separate:', ['items in a list', 'two sentences', 'a question', 'speech'], 0),
    q('Which needs a capital letter?', ['monday', 'table', 'school', 'water'], 0),
  ]),
  a('JUNIOR_SECONDARY', 'Basic Science', 'States of matter', 'Solids, liquids and gases', [
    q('Ice is water in which state?', ['Liquid', 'Gas', 'Solid', 'Plasma'], 2),
    q('When water boils, it changes into:', ['ice', 'steam', 'sand', 'salt'], 1),
    q('Which state of matter has a fixed shape?', ['Solid', 'Liquid', 'Gas', 'None'], 0),
    q('The change from liquid to solid is called:', ['melting', 'boiling', 'freezing', 'evaporation'], 2),
    q('Which of these is a gas?', ['Palm oil', 'Oxygen', 'Iron', 'Wood'], 1),
  ]),
  a('JUNIOR_SECONDARY', 'Basic Technology', 'Simple machines', 'Simple machines', [
    q('A see-saw is an example of a:', ['pulley', 'lever', 'wheel and axle', 'screw'], 1),
    q('A ramp used to load a lorry is an:', ['inclined plane', 'pulley', 'wedge', 'gear'], 0),
    q('The fixed point a lever turns on is the:', ['load', 'effort', 'fulcrum', 'axle'], 2),
    q('Which machine is used to raise a flag up a pole?', ['Pulley', 'Wedge', 'Screw', 'Lever'], 0),
    q('An axe blade is an example of a:', ['wedge', 'pulley', 'wheel', 'gear'], 0),
  ]),

  // ── Senior Secondary ───────────────────────────────────
  a('SENIOR_SECONDARY', 'Mathematics', 'Quadratic equations sprint', 'Quadratic equations', [
    q('Solve x² − 5x + 6 = 0', ['x = 2 or 3', 'x = −2 or −3', 'x = 1 or 6', 'x = −1 or 6'], 0),
    q('Solve x² − 9 = 0', ['x = 9', 'x = 3 only', 'x = ±3', 'x = ±9'], 2),
    q('The sum of the roots of x² − 7x + 10 = 0 is:', ['−7', '7', '10', '−10'], 1),
    q('The product of the roots of 2x² − 8x + 6 = 0 is:', ['3', '4', '6', '−3'], 0),
    q('Solve x² + 4x + 4 = 0', ['x = 2', 'x = −2', 'x = ±2', 'x = 4'], 1),
  ], 30),
  a('SENIOR_SECONDARY', 'Mathematics', 'Indices and logarithms', 'Indices and logarithms', [
    q('Simplify 2³ × 2⁴', ['2⁷', '2¹²', '4⁷', '2¹'], 0),
    q('Evaluate 27^(1/3)', ['9', '3', '1/3', '81'], 1),
    q('log₁₀ 1000 = ?', ['2', '3', '10', '100'], 1),
    q('If 2ˣ = 32, then x =', ['4', '5', '6', '16'], 1),
    q('log₂ 8 + log₂ 2 = ?', ['3', '4', '5', '16'], 1),
  ], 30),
  a('SENIOR_SECONDARY', 'English Language', 'Concord', 'Subject–verb agreement', [
    q('Each of the students ___ a textbook.', ['have', 'has', 'are having', 'were having'], 1),
    q('Neither Musa nor his brothers ___ at home.', ['is', 'was', 'are', 'has been'], 2),
    q('The news ___ good.', ['are', 'were', 'is', 'have been'], 2),
    q('Bread and butter ___ my favourite breakfast.', ['is', 'are', 'were', 'have'], 0),
    q('The committee ___ reached a decision.', ['have', 'has', 'are', 'were'], 1),
  ], 30),
  a('SENIOR_SECONDARY', 'Physics', 'Motion basics', 'Speed, velocity and acceleration', [
    q('A car travels 120 km in 2 hours. Its average speed is:', ['240 km/h', '60 km/h', '30 km/h', '122 km/h'], 1),
    q('The SI unit of acceleration is:', ['m/s', 'm/s²', 'N', 'kg·m'], 1),
    q('Velocity differs from speed because velocity has:', ['mass', 'direction', 'time', 'energy'], 1),
    q('A body starts from rest and reaches 20 m/s in 4 s. Its acceleration is:', ['5 m/s²', '80 m/s²', '16 m/s²', '24 m/s²'], 0),
    q('Which quantity is a scalar?', ['Displacement', 'Velocity', 'Force', 'Speed'], 3),
  ], 30),
  a('SENIOR_SECONDARY', 'Chemistry', 'Chemistry: acids & bases', 'Acids, bases and salts', [
    q('A solution with pH 3 is:', ['strongly basic', 'neutral', 'acidic', 'weakly basic'], 2),
    q('Which is a strong acid?', ['Ethanoic acid', 'Carbonic acid', 'Sulphuric acid', 'Citric acid'], 2),
    q('Phenolphthalein turns ___ in a basic solution.', ['colourless', 'pink', 'yellow', 'blue'], 1),
    q('Acid + base → salt + ___', ['hydrogen', 'water', 'oxygen', 'carbon dioxide'], 1),
    q('25 cm³ of 0.1 M NaOH neutralises 20 cm³ of HCl. The HCl concentration is:', ['0.080 M', '0.125 M', '0.250 M', '1.25 M'], 1),
  ], 30),
  a('SENIOR_SECONDARY', 'Chemistry', 'The mole', 'Mole concept', [
    q('One mole of any substance contains about ___ particles.', ['6.02 × 10²³', '3.0 × 10⁸', '9.8', '1.6 × 10⁻¹⁹'], 0),
    q('The molar mass of water (H₂O) is (H = 1, O = 16):', ['17 g/mol', '18 g/mol', '16 g/mol', '20 g/mol'], 1),
    q('How many moles are in 44 g of CO₂? (C = 12, O = 16)', ['0.5', '1', '2', '44'], 1),
    q('The molar mass of NaCl is (Na = 23, Cl = 35.5):', ['58.5 g/mol', '35.5 g/mol', '23 g/mol', '46 g/mol'], 0),
    q('2 moles of O₂ have a mass of (O = 16):', ['32 g', '16 g', '64 g', '48 g'], 2),
  ], 30),
  a('SENIOR_SECONDARY', 'Biology', 'The cell', 'Cell structure', [
    q('The "powerhouse" of the cell is the:', ['nucleus', 'mitochondrion', 'ribosome', 'vacuole'], 1),
    q('Which structure is found in plant cells but NOT animal cells?', ['Cell membrane', 'Nucleus', 'Cell wall', 'Cytoplasm'], 2),
    q('The part of the cell that controls its activities is the:', ['nucleus', 'cell wall', 'vacuole', 'chloroplast'], 0),
    q('Photosynthesis takes place in the:', ['mitochondria', 'chloroplasts', 'ribosomes', 'nucleus'], 1),
    q('Proteins are made at the:', ['ribosomes', 'vacuole', 'cell wall', 'chloroplast'], 0),
  ], 30),
  a('SENIOR_SECONDARY', 'Economics', 'Demand and supply', 'Demand and supply', [
    q('When the price of a normal good rises, quantity demanded usually:', ['rises', 'falls', 'stays the same', 'doubles'], 1),
    q('The point where demand equals supply is the:', ['equilibrium', 'surplus', 'shortage', 'ceiling'], 0),
    q('A fall in the price of tea may ___ the demand for coffee (substitutes).', ['increase', 'reduce', 'not change', 'double'], 1),
    q('If supply rises and demand stays the same, price tends to:', ['rise', 'fall', 'stay fixed', 'disappear'], 1),
    q('Goods used together, like cars and petrol, are called:', ['substitutes', 'complements', 'inferior goods', 'free goods'], 1),
  ], 30),
  a('SENIOR_SECONDARY', 'Literature in English', 'Literary devices', 'Figures of speech', [
    q('"The wind whispered through the trees" is an example of:', ['simile', 'personification', 'hyperbole', 'irony'], 1),
    q('"She is as brave as a lion" is a:', ['metaphor', 'simile', 'pun', 'oxymoron'], 1),
    q('"I have told you a million times" is an example of:', ['hyperbole', 'litotes', 'euphemism', 'alliteration'], 0),
    q('Repeating the first consonant sound, as in "Peter picked peppers", is:', ['assonance', 'alliteration', 'rhyme', 'onomatopoeia'], 1),
    q('Chinua Achebe wrote:', ['Things Fall Apart', 'The Lion and the Jewel', 'Purple Hibiscus', 'Half of a Yellow Sun'], 0),
  ], 30),
];
