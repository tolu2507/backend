import type { ExamBody } from '@prisma/client';

import type { TopicTree } from '../question-bank/question-ai.js';

/**
 * Syllabuses we type in from the exam body's own brochure, so we don't pay the AI to guess them.
 * scripts/past-papers/tag.ts uses these when a subject has no syllabus yet, and only asks the AI
 * for subjects that aren't listed here.
 */
export const OFFICIAL_SYLLABUS: Partial<Record<ExamBody, Record<string, TopicTree>>> = {
  JAMB: {
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
