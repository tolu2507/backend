import type { ExamBody } from '@prisma/client';

import type { TopicTree } from '../question-bank/question-ai.js';

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

/**
 * Syllabuses we type in from the exam body's own brochure, so we don't pay the AI to guess them.
 * scripts/past-papers/tag.ts uses these when a subject has no syllabus yet, and only asks the AI
 * for subjects that aren't listed here.
 */
export const OFFICIAL_SYLLABUS: Partial<Record<ExamBody, Record<string, TopicTree>>> = {
  WAEC: { mathematics: SSCE_MATHEMATICS, biology: BIOLOGY, 'english-language': ENGLISH },
  NECO: { mathematics: SSCE_MATHEMATICS, biology: BIOLOGY, 'english-language': ENGLISH },
  JAMB: {
    biology: BIOLOGY,
    'english-language': ENGLISH,
    // UTME Chemistry brochure, in its order.
    chemistry: [
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
    ],
  },
};
