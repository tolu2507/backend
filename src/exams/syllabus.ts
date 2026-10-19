import type { ExamBody } from '@prisma/client';

import type { TopicTree } from '../question-bank/question-ai.js';
import { ELECTIVES } from '../question-bank/templates/electives/index.js';
import type { Template } from '../question-bank/templates/engine.js';

/**
 * For electives we haven't typed a brochure syllabus in for yet: the topics their templates use,
 * in order. Replace with the exam body's own list when it's typed in.
 */
function fromTemplates(list: Template[]): TopicTree {
  const tree = new Map<string, string[]>();
  for (const { topic: [t, sub] } of list) {
    const subs = tree.get(t) ?? [];
    if (!subs.includes(sub)) subs.push(sub);
    tree.set(t, subs);
  }
  return [...tree].map(([name, subtopics]) => ({ name, subtopics }));
}

/** Biology is set from one shared body of content by JAMB, WAEC and NECO; the topic tree is the same. */
const BIOLOGY: TopicTree = [
  { name: 'Variety of Organisms', subtopics: ['Characteristics of living things', 'Classification of organisms', 'Microorganisms and fungi', 'Plants', 'Invertebrates', 'Vertebrates'] },
  { name: 'Cell Biology', subtopics: ['Cell structure and organelles', 'Cell division', 'The cell and its environment'] },
  { name: 'Nutrition', subtopics: ['Photosynthesis', 'Mineral nutrition in plants', 'Food substances and balanced diet', 'Digestion and enzymes'] },
  { name: 'Transport', subtopics: ['Blood and circulation', 'Transport in plants'] },
  { name: 'Respiration', subtopics: ['Aerobic and anaerobic respiration', 'Respiratory systems'] },
  { name: 'Excretion', subtopics: ['Excretory organs and products'] },
  { name: 'Support and Movement', subtopics: ['Skeleton and joints', 'Plant responses and tropisms'] },
  { name: 'Reproduction', subtopics: ['Reproduction in plants', 'Reproduction in animals'] },
  { name: 'Coordination and Control', subtopics: ['Nervous system', 'Hormones', 'Sense organs'] },
  { name: 'Ecology', subtopics: ['Ecological factors and habitats', 'Feeding relationships and energy flow', 'Population studies', 'Symbiotic relationships', 'Nutrient cycles', 'Pollution and conservation'] },
  { name: 'Diseases and Health', subtopics: ['Pathogens and vectors', 'Immunity and hygiene'] },
  { name: 'Heredity and Variation', subtopics: ['Variation', 'Genetics and inheritance', 'Sex determination and sex-linked traits'] },
  { name: 'Evolution', subtopics: ['Theories of evolution', 'Evidence of evolution', 'Adaptation'] },
];

/** The objective parts of JAMB Use of English and WAEC/NECO English Language. */
const ENGLISH: TopicTree = [
  { name: 'Comprehension and Summary', subtopics: ['Comprehension passages', 'Cloze passages', 'Summary'] },
  { name: 'Lexis and Structure', subtopics: ['Synonyms', 'Antonyms', 'Idioms and figurative expressions', 'Concord', 'Tenses and verb forms', 'Question tags', 'Prepositions and phrasal verbs', 'Pronouns', 'Spelling', 'Nouns and plurals'] },
  { name: 'Oral Forms', subtopics: ['Vowels', 'Consonants', 'Word stress', 'Rhymes'] },
];

/** UTME Chemistry brochure, in its order; WAEC and NECO cover the same ground. */
const CHEMISTRY: TopicTree = [
  { name: 'Separation of Mixtures and Purification', subtopics: ['Pure and impure substances', 'Separation techniques', 'Physical and chemical changes'] },
  { name: 'Chemical Combination', subtopics: ['Laws of chemical combination', 'Formulae and equations', 'The mole concept', 'Stoichiometry'] },
  { name: 'Kinetic Theory of Matter and Gas Laws', subtopics: ['States of matter', 'Gas laws', "Graham's law of diffusion", 'Molar volume and vapour density'] },
  { name: 'Atomic Structure and Bonding', subtopics: ['Atomic structure and isotopes', 'Electronic configuration', 'Periodic table and periodicity', 'Chemical bonding and shapes'] },
  { name: 'Air', subtopics: ['Composition of air', 'Gases in air'] },
  { name: 'Water', subtopics: ['Water and its composition', 'Hardness of water', 'Water of crystallization'] },
  { name: 'Solubility', subtopics: ['Solubility and saturated solutions', 'Solubility curves', 'Colloids and suspensions'] },
  { name: 'Environmental Pollution', subtopics: ['Air pollution', 'Water and soil pollution'] },
  { name: 'Acids, Bases and Salts', subtopics: ['Acids and bases', 'pH and indicators', 'Salts', 'Concentration and titration'] },
  { name: 'Oxidation and Reduction', subtopics: ['Oxidation numbers', 'Redox reactions and IUPAC naming'] },
  { name: 'Electrolysis', subtopics: ['Electrolytes and electrolysis', "Faraday's laws", 'Electrochemical cells'] },
  { name: 'Energy Changes', subtopics: ['Heat of reaction', 'Entropy and spontaneity'] },
  { name: 'Rates of Chemical Reaction', subtopics: ['Factors affecting rates', 'Collision theory and activation energy'] },
  { name: 'Chemical Equilibria', subtopics: ['Reversible reactions', "Le Chatelier's principle", 'Equilibrium constant'] },
  { name: 'Non-metals and their Compounds', subtopics: ['Hydrogen and halogens', 'Oxygen, sulphur and nitrogen', 'Carbon and its compounds'] },
  { name: 'Metals and their Compounds', subtopics: ['Alkali and alkaline earth metals', 'Aluminium, tin, iron and copper', 'Extraction of metals'] },
  { name: 'Organic Compounds', subtopics: ['Hydrocarbons', 'Alkanols, alkanals and alkanones', 'Alkanoic acids and esters', 'Isomerism and naming', 'Polymers and carbohydrates'] },
  { name: 'Chemistry and Industry', subtopics: ['Chemical industries', 'Fats, oils and soaps'] },
  { name: 'Nuclear Chemistry', subtopics: ['Radioactivity', 'Nuclear reactions and half-life'] },
];

/** Physics as the past papers are organised (built from JAMB papers); WAEC and NECO set the same topics. */
const PHYSICS: TopicTree = [
  { name: 'Measurements and Units', subtopics: ['Physical quantities and units', 'Position, distance and displacement', 'Measuring instruments'] },
  { name: 'Motion', subtopics: ['Linear motion', 'Projectiles', "Newton's laws and momentum", 'Circular and simple harmonic motion'] },
  { name: 'Equilibrium of Forces', subtopics: ['Equilibrium and moments', 'Friction', 'Machines'] },
  { name: 'Work, Energy and Power', subtopics: ['Work, energy and power', 'Conservation and forms of energy'] },
  { name: 'Properties of Matter', subtopics: ['Elasticity', 'Pressure in fluids', 'Upthrust and floatation', 'Surface tension and capillarity', 'Diffusion and kinetic theory'] },
  { name: 'Temperature and Heat', subtopics: ['Measurement of temperature', 'Thermal expansion', 'Heat transfer', 'Quantity of heat and calorimetry', 'Vapours and humidity'] },
  { name: 'Waves and Wave Motion', subtopics: ['Types and properties of waves', 'Sound waves and acoustics', 'Electromagnetic waves'] },
  { name: 'Light Waves and Optical Instruments', subtopics: ['Reflection at plane surfaces', 'Reflection at curved mirrors', 'Refraction of light', 'Optical instruments'] },
  { name: 'Electrostatics and Electric Fields', subtopics: ['Electric charges and fields', 'Capacitors and dielectric'] },
  { name: 'Current Electricity', subtopics: ["Electric circuits and Ohm's law", 'Electrical energy, power and heating'] },
  { name: 'Magnetism and Electromagnetism', subtopics: ['Magnets and magnetic fields', 'Alternating current circuits'] },
  { name: 'Atomic and Nuclear Physics', subtopics: ['Structure of the atom', 'Radioactivity and nuclear energy', 'Conduction through gases and cathode rays'] },
];

/** WASSCE / NECO Further Mathematics. */
const FURTHER_MATHEMATICS: TopicTree = [
  { name: 'Pure Mathematics', subtopics: ['Binary operations', 'Polynomials', 'Quadratic inequalities', 'Permutations and combinations', 'Matrices and determinants'] },
  { name: 'Calculus', subtopics: ['Differentiation', 'Applications of differentiation', 'Integration'] },
];

/** WASSCE / NECO SSCE General Mathematics, in the syllabus order. */
const SSCE_MATHEMATICS: TopicTree = [
  { name: 'Number and Numeration', subtopics: ['Number bases', 'Modular arithmetic', 'Fractions, decimals and approximations', 'Indices and logarithms', 'Surds', 'Sequences and series', 'Sets', 'Ratio, proportion and rates', 'Percentages and financial arithmetic', 'Variation'] },
  { name: 'Algebraic Processes', subtopics: ['Algebraic expressions and change of subject', 'Quadratic equations', 'Linear inequalities', 'Algebraic fractions'] },
  { name: 'Mensuration', subtopics: ['Lengths and perimeters', 'Areas', 'Volumes and surface areas'] },
  { name: 'Plane Geometry', subtopics: ['Angles and polygons', 'Circle theorems', 'Constructions and loci'] },
  { name: 'Coordinate Geometry', subtopics: ['Straight lines'] },
  { name: 'Trigonometry', subtopics: ['Trigonometric ratios', 'Angles of elevation and depression', 'Bearings'] },
  { name: 'Statistics and Probability', subtopics: ['Mean, median and mode', 'Measures of dispersion', 'Data presentation', 'Probability'] },
  { name: 'Vectors and Transformation', subtopics: ['Vectors', 'Transformations'] },
];

/** BECE (JSS3) Mathematics. */
const BECE_MATHEMATICS: TopicTree = [
  { name: 'Number and Numeration', subtopics: ['Whole numbers and place value', 'Fractions, decimals and percentages', 'Number bases', 'Approximation', 'Ratio, proportion and rates', 'Commercial arithmetic', 'Sets'] },
  { name: 'Algebraic Processes', subtopics: ['Simplifying expressions', 'Linear equations', 'Linear inequalities'] },
  { name: 'Geometry and Mensuration', subtopics: ['Angles and polygons', 'Perimeter and area', 'Volume', "Pythagoras' rule"] },
  { name: 'Everyday Statistics', subtopics: ['Mean, median and mode', 'Data presentation', 'Probability'] },
];

/** Common Entrance (primary 6) Mathematics. */
const CE_MATHEMATICS: TopicTree = [
  { name: 'Number', subtopics: ['Place value and rounding', 'Factors, multiples and primes', 'Fractions', 'Percentages', 'Roman numerals'] },
  { name: 'Operations', subtopics: ['Order of operations'] },
  { name: 'Measurement', subtopics: ['Money', 'Time', 'Length, mass and capacity', 'Perimeter and area'] },
  { name: 'Everyday Statistics', subtopics: ['Averages'] },
];

/** Basic Science (BECE Basic Science and Technology; Common Entrance Basic Science). */
const BASIC_SCIENCE: TopicTree = [
  { name: 'Living Things', subtopics: ['Characteristics of living things', 'The human body', 'Food and nutrition', 'Health and diseases'] },
  { name: 'Matter and Materials', subtopics: ['States of matter', 'Mixtures and separation', 'Conductors, insulators and magnets'] },
  { name: 'Energy and Forces', subtopics: ['Forms of energy', 'Simple machines', 'Motion and measurement'] },
  { name: 'Earth and Space', subtopics: ['The solar system', 'Weather and the environment'] },
];

const QUANTITATIVE: TopicTree = [
  { name: 'Number Patterns', subtopics: ['Sequences', 'Number machines'] },
  { name: 'Number Relationships', subtopics: ['Missing numbers', 'Odd one out'] },
];
const VERBAL: TopicTree = [
  { name: 'Word Relationships', subtopics: ['Analogies', 'Opposites', 'Odd one out'] },
  { name: 'Letters and Codes', subtopics: ['Alphabet positions', 'Letter codes', 'Alphabetical order'] },
];
const SOCIAL_STUDIES: TopicTree = [
  { name: 'Nigeria', subtopics: ['States and capitals', 'National symbols'] },
  { name: 'Government', subtopics: ['Arms of government'] },
];

/** The other BECE subjects. */
const BECE_OTHER: Record<string, TopicTree> = {
  'business-studies': [
    { name: 'Commerce', subtopics: ['Trade', 'Aids to trade'] },
    { name: 'Office Practice', subtopics: ['Office equipment', 'Keyboarding'] },
    { name: 'Book-keeping', subtopics: ['Source documents', 'Books of original entry', 'Trading account'] },
    { name: 'Consumer Education', subtopics: ['Consumer rights and protection'] },
  ],
  'christian-religious-studies': [
    { name: 'The Old Testament', subtopics: ['Creation and the patriarchs', 'Moses and the Exodus'] },
    { name: 'The Life of Jesus', subtopics: ['Birth and ministry', 'Miracles and parables'] },
    { name: 'The Early Church', subtopics: ['Pentecost and the apostles'] },
  ],
  'islamic-religion-studies': [
    { name: "Qur'an and Hadith", subtopics: ["The Qur'an"] },
    { name: 'Tawhid and Fiqh', subtopics: ['Pillars of Islam', 'Salat'] },
    { name: 'Sirah', subtopics: ['Life of the Prophet'] },
    { name: 'Festivals', subtopics: ['Islamic festivals'] },
  ],
  history: [
    { name: 'Pre-colonial Nigeria', subtopics: ['Ancient kingdoms and empires'] },
    { name: 'Colonial Nigeria', subtopics: ['Colonial rule'] },
    { name: 'Independent Nigeria', subtopics: ['Independence and the republics'] },
  ],
  'national-value-education': [
    { name: 'Values', subtopics: ['National values'] },
    { name: 'Citizenship', subtopics: ['Citizenship, rights and duties'] },
    { name: 'Security and Safety', subtopics: ['Security agencies', 'Safety and emergencies'] },
  ],
  'pre-vocational-studies': [
    { name: 'Agriculture', subtopics: ['Farm tools', 'Crops'] },
    { name: 'Home Economics', subtopics: ['Food and cooking'] },
  ],
  'cultural-and-creative-arts': [
    { name: 'Visual Arts', subtopics: ['Colour', 'Art tools and crafts'] },
    { name: 'Music', subtopics: ['Note values', 'Musical instruments'] },
    { name: 'Drama', subtopics: ['Elements of drama'] },
  ],
  french: [
    { name: 'Vocabulary', subtopics: ['Greetings', 'Numbers', 'Days and months', 'Colours', 'Family'] },
    { name: 'Grammar', subtopics: ['The verbs être and avoir'] },
  ],
};

/** Senior arts and commercial subjects: one tree each, shared by JAMB, WAEC and NECO. */
const SENIOR: Record<string, TopicTree> = {
  economics: [
    { name: 'Basic Concepts', subtopics: ['Basic economic concepts', 'Utility'] },
    { name: 'Demand, Supply and Price', subtopics: ['Market equilibrium', 'Elasticity'] },
    { name: 'Production and Costs', subtopics: ['Factors of production', 'Costs and revenue'] },
    { name: 'Market Structures', subtopics: ['Types of market'] },
    { name: 'National Income and Public Finance', subtopics: ['National income', 'Public finance and taxation'] },
    { name: 'Money, Banking and Inflation', subtopics: ['Money and banking', 'Inflation and price indices'] },
    { name: 'International Trade and Organisations', subtopics: ['International economic organisations'] },
  ],
  government: [
    { name: 'Elements of Government', subtopics: ['Basic concepts', 'Political thinkers', 'Constitutions', 'Elections and political parties'] },
    { name: 'Nigerian Government and Politics', subtopics: ['Constitutional development'] },
    { name: 'International Relations', subtopics: ['International organisations'] },
  ],
  commerce: [
    { name: 'Business Units', subtopics: ['Types of business organisation'] },
    { name: 'Trade', subtopics: ['Home trade', 'Foreign trade'] },
    { name: 'Aids to Trade', subtopics: ['Insurance', 'Banking and the stock exchange'] },
  ],
  'accounts-principles-of-accounts': [
    { name: 'Accounting Basics', subtopics: ['The accounting equation', 'Double entry', 'Accounting concepts', 'Books of original entry'] },
    { name: 'Final Accounts', subtopics: ['Trading, profit and loss account', 'Interpretation of accounts'] },
    { name: 'Fixed Assets', subtopics: ['Depreciation'] },
  ],
  geography: [
    { name: 'Practical Geography', subtopics: ['Map reading and scale'] },
    { name: 'Physical Geography', subtopics: ['The earth and its movements', 'Weather and climate', 'Rocks'] },
    { name: 'Geography of Nigeria', subtopics: ['Vegetation and climate of Nigeria', 'Physical features of Nigeria'] },
  ],
  'agricultural-science': [
    { name: 'Crop Production', subtopics: ['Pests and diseases of crops', 'Planting and fertilisers'] },
    { name: 'Animal Production', subtopics: ['Animal health', 'Breeds of farm animals', 'Reproduction in farm animals'] },
    { name: 'Agricultural Engineering', subtopics: ['Farm machinery'] },
    { name: 'Soil Science', subtopics: ['Soil properties'] },
  ],
  'christian-religious-studies-crs': [
    { name: 'The Old Testament', subtopics: ['Creation and the patriarchs', 'Moses and the Exodus', 'Kings and prophets'] },
    { name: 'The Life of Jesus', subtopics: ['Birth and ministry', 'Miracles and parables'] },
    { name: 'The Early Church', subtopics: ['Pentecost and the apostles'] },
  ],
  'islamic-religious-studies-irs': [
    { name: "Qur'an and Hadith", subtopics: ["The Qur'an"] },
    { name: 'Tawhid and Fiqh', subtopics: ['Pillars of Islam', 'Salat', 'Sources of Shari’ah'] },
    { name: 'Sirah', subtopics: ['Life of the Prophet', 'Battles and treaties'] },
    { name: 'Festivals', subtopics: ['Islamic festivals'] },
  ],
  history: [
    { name: 'Pre-colonial Nigeria', subtopics: ['Ancient kingdoms and empires'] },
    { name: 'Colonial Nigeria', subtopics: ['Colonial rule'] },
    { name: 'Independent Nigeria', subtopics: ['Independence and the republics'] },
  ],
};
const CIVIC: TopicTree = [
  { name: 'Values', subtopics: ['National values'] },
  { name: 'Citizenship', subtopics: ['Citizenship, rights and duties'] },
  { name: 'Government', subtopics: ['Arms of government'] },
  { name: 'Nigeria', subtopics: ['National symbols'] },
  { name: 'Security and Safety', subtopics: ['Security agencies', 'Safety and emergencies'] },
];

/**
 * Syllabuses we type in from the exam body's own brochure, so we don't pay the AI to guess them.
 * scripts/past-papers/tag.ts uses these when a subject has no syllabus yet, and only asks the AI
 * for subjects that aren't listed here.
 */
export const OFFICIAL_SYLLABUS: Partial<Record<ExamBody, Record<string, TopicTree>>> = {
  BECE: { mathematics: BECE_MATHEMATICS, 'english-language': ENGLISH, 'basic-science-and-technology': BASIC_SCIENCE, ...BECE_OTHER },
  COMMON_ENTRANCE: { mathematics: CE_MATHEMATICS, 'english-language': ENGLISH, 'basic-science': BASIC_SCIENCE, 'quantitative-reasoning': QUANTITATIVE, 'verbal-reasoning': VERBAL, 'social-studies': SOCIAL_STUDIES },
  WAEC: { ...SENIOR, 'civic-education': CIVIC, physics: PHYSICS, chemistry: CHEMISTRY, 'further-mathematics': FURTHER_MATHEMATICS, mathematics: SSCE_MATHEMATICS, biology: BIOLOGY, 'english-language': ENGLISH },
  NECO: { ...SENIOR, 'civic-education': CIVIC, physics: PHYSICS, chemistry: CHEMISTRY, 'further-mathematics': FURTHER_MATHEMATICS, mathematics: SSCE_MATHEMATICS, biology: BIOLOGY, 'english-language': ENGLISH },
  JAMB: {
    ...SENIOR,
    biology: BIOLOGY,
    'english-language': ENGLISH,
    chemistry: CHEMISTRY,
  },
};

for (const [slug, { exams, templates }] of Object.entries(ELECTIVES)) {
  for (const exam of exams) (OFFICIAL_SYLLABUS[exam] ??= {})[slug] ??= fromTemplates(templates);
}
