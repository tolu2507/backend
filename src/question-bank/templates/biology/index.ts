import { frac, m, num, otherValues, type Template } from '../engine.js';
import { sci, sig } from '../jamb-physics/kit.js';

/**
 * Biology for JAMB, WAEC and NECO. Most of biology is facts, so most templates ask from checked
 * fact tables (both directions, wrong options from the other rows); the rest work out the numbers.
 * Keys have no exam prefix: index.ts adds one per exam.
 */

const VARIETY = 'Variety of Organisms';
const CELL = 'Cell Biology';
const NUT = 'Nutrition';
const TRANS = 'Transport';
const RESP = 'Respiration';
const EXCR = 'Excretion';
const SUPPORT = 'Support and Movement';
const COORD = 'Coordination and Control';
const ECO = 'Ecology';
const HEALTH = 'Diseases and Health';
const HERED = 'Heredity and Variation';

const DEFICIENCY: [nutrient: string, disease: string][] = [
  ['vitamin A', 'night blindness'],
  ['vitamin B1 (thiamine)', 'beriberi'],
  ['vitamin B3 (niacin)', 'pellagra'],
  ['vitamin C', 'scurvy'],
  ['vitamin D', 'rickets'],
  ['vitamin K', 'slow blood clotting'],
  ['iron', 'anaemia'],
  ['iodine', 'goitre'],
  ['protein', 'kwashiorkor'],
];

const HORMONES: [hormone: string, gland: string, effect: string][] = [
  ['insulin', 'pancreas (islets of Langerhans)', 'lowers the blood sugar level'],
  ['glucagon', 'pancreas (islets of Langerhans)', 'raises the blood sugar level'],
  ['adrenaline', 'adrenal gland', 'prepares the body for "fight or flight"'],
  ['thyroxine', 'thyroid gland', 'controls the rate of metabolism'],
  ['antidiuretic hormone (ADH)', 'pituitary gland', 'increases water reabsorption in the kidney'],
  ['growth hormone', 'pituitary gland', 'controls body growth'],
  ['testosterone', 'testes', 'controls male secondary sexual characteristics'],
  ['oestrogen', 'ovaries', 'controls female secondary sexual characteristics'],
  ['progesterone', 'ovaries (corpus luteum)', 'maintains the lining of the uterus in pregnancy'],
];

const ORGANELLES: [organelle: string, job: string][] = [
  ['mitochondrion', 'releases energy by aerobic respiration'],
  ['ribosome', 'makes proteins'],
  ['chloroplast', 'carries out photosynthesis'],
  ['nucleus', 'contains the genetic material and controls the cell'],
  ['cell membrane', 'controls what enters and leaves the cell'],
  ['cell wall', 'gives a plant cell shape and support'],
  ['Golgi apparatus', 'packages and secretes substances'],
  ['lysosome', 'contains digestive enzymes that break down worn-out parts'],
  ['centriole', 'forms the spindle during cell division in animal cells'],
  ['large central vacuole', 'stores cell sap and keeps a plant cell turgid'],
];

const ENZYMES: [enzyme: string, where: string, substrate: string, product: string][] = [
  ['ptyalin (salivary amylase)', 'the mouth', 'starch', 'maltose'],
  ['pepsin', 'the stomach', 'proteins', 'peptides'],
  ['rennin', 'the stomach', 'caseinogen (milk protein)', 'casein'],
  ['lipase', 'the duodenum', 'fats and oils', 'fatty acids and glycerol'],
  ['trypsin', 'the duodenum', 'proteins', 'peptides'],
  ['maltase', 'the small intestine', 'maltose', 'glucose'],
  ['sucrase', 'the small intestine', 'sucrose', 'glucose and fructose'],
  ['lactase', 'the small intestine', 'lactose', 'glucose and galactose'],
  ['erepsin', 'the small intestine', 'peptides', 'amino acids'],
];

const DISEASES: [disease: string, cause: string, vector: string | null][] = [
  ['malaria', 'Plasmodium (a protozoan)', 'female Anopheles mosquito'],
  ['sleeping sickness', 'Trypanosoma (a protozoan)', 'tsetse fly'],
  ['river blindness', 'Onchocerca volvulus (a roundworm)', 'blackfly (Simulium)'],
  ['yellow fever', 'a virus', 'Aedes mosquito'],
  ['elephantiasis', 'Wuchereria bancrofti (a roundworm)', 'Culex mosquito'],
  ['schistosomiasis (bilharzia)', 'Schistosoma (a flatworm)', 'freshwater snail'],
  ['guinea worm disease', 'Dracunculus medinensis (a roundworm)', 'Cyclops (water flea)'],
  ['cholera', 'Vibrio cholerae (a bacterium)', null],
  ['typhoid fever', 'Salmonella typhi (a bacterium)', null],
  ['tuberculosis', 'Mycobacterium tuberculosis (a bacterium)', null],
  ['gonorrhoea', 'Neisseria gonorrhoeae (a bacterium)', null],
  ['AIDS', 'HIV (a virus)', null],
  ['ringworm', 'a fungus', null],
];

const GROUPS: [organism: string, group: string][] = [
  ['earthworm', 'Annelida'],
  ['tapeworm', 'Platyhelminthes'],
  ['Hydra', 'Cnidaria (Coelenterata)'],
  ['snail', 'Mollusca'],
  ['cockroach', 'Arthropoda'],
  ['Ascaris', 'Nematoda'],
  ['starfish', 'Echinodermata'],
  ['Amoeba', 'Protozoa'],
  ['frog', 'Amphibia'],
  ['lizard', 'Reptilia'],
  ['bat', 'Mammalia'],
  ['tilapia', 'Pisces'],
  ['pigeon', 'Aves'],
  ['fern', 'Pteridophyta'],
  ['moss', 'Bryophyta'],
  ['Rhizopus (bread mould)', 'Fungi'],
];

const EXCRETORY: [organism: string, organ: string][] = [
  ['flatworm (Planaria)', 'flame cells'],
  ['earthworm', 'nephridia'],
  ['insect', 'Malpighian tubules'],
  ['mammal', 'kidneys'],
  ['Amoeba', 'the body surface and contractile vacuole'],
];

const BREATHING: [organism: string, organ: string][] = [
  ['fish', 'gills'],
  ['insect', 'tracheae (opening at spiracles)'],
  ['earthworm', 'moist skin'],
  ['mammal', 'lungs (alveoli)'],
  ['spider', 'book lungs'],
  ['flowering plant', 'stomata and lenticels'],
];

const TROPISMS: [stimulus: string, name: string][] = [
  ['light', 'phototropism'],
  ['gravity', 'geotropism'],
  ['water', 'hydrotropism'],
  ['touch', 'thigmotropism'],
  ['chemicals', 'chemotropism'],
];

const JOINTS: [where: string, joint: string][] = [
  ['the shoulder', 'ball-and-socket joint'],
  ['the hip', 'ball-and-socket joint'],
  ['the knee', 'hinge joint'],
  ['the elbow', 'hinge joint'],
  ['the atlas and axis vertebrae', 'pivot joint'],
  ['the wrist bones', 'gliding joint'],
];

const NITROGEN: [organism: string, job: string][] = [
  ['Rhizobium', 'fixes nitrogen in the root nodules of legumes'],
  ['Azotobacter', 'fixes nitrogen while living free in the soil'],
  ['Nitrosomonas', 'changes ammonium compounds to nitrites'],
  ['Nitrobacter', 'changes nitrites to nitrates'],
  ['Pseudomonas (denitrifying bacteria)', 'changes nitrates back to nitrogen gas'],
];

const SYMBIOSIS: [pair: string, kind: string][] = [
  ['a tapeworm living in the human intestine', 'parasitism'],
  ['Rhizobium in the root nodules of a bean plant', 'mutualism'],
  ['the alga and fungus that make up a lichen', 'mutualism'],
  ['a remora fish riding on a shark', 'commensalism'],
  ['protozoa that digest cellulose in the gut of a termite', 'mutualism'],
  ['dodder growing on another plant', 'parasitism'],
  ['ticks feeding on a cow', 'parasitism'],
];

const EYE_EAR: [part: string, job: string][] = [
  ['retina', 'contains the light-sensitive cells where the image forms'],
  ['iris', 'controls the size of the pupil'],
  ['lens', 'focuses light onto the retina'],
  ['ciliary muscle', 'changes the shape of the lens'],
  ['optic nerve', 'carries impulses from the eye to the brain'],
  ['cochlea', 'changes sound vibrations into nerve impulses'],
  ['semicircular canals', 'detect movement of the head and help balance'],
  ['ear ossicles', 'pass on and amplify vibrations from the eardrum'],
  ['Eustachian tube', 'equalises air pressure on both sides of the eardrum'],
];

const BLOOD: [part: string, job: string][] = [
  ['red blood cells', 'carry oxygen using haemoglobin'],
  ['white blood cells', 'defend the body against infection'],
  ['platelets', 'help the blood to clot'],
  ['plasma', 'carries dissolved food, hormones and wastes'],
  ['pulmonary artery', 'carries deoxygenated blood from the heart to the lungs'],
  ['pulmonary vein', 'carries oxygenated blood from the lungs to the heart'],
  ['aorta', 'carries oxygenated blood from the heart to the body'],
  ['hepatic portal vein', 'carries blood from the intestines to the liver'],
];

/** One fact-table question in either direction. */
function fact<T>(rows: readonly T[], opts: { a: (x: T) => string; b: (x: T) => string; forward: (row: T) => string; backward?: (row: T) => string; why: (row: T) => string }): Template['make'] {
  return (r) => {
    const row = r.pick(rows);
    if (opts.backward && r.chance(0.5)) {
      // A value can belong to several rows (two hormones from the pancreas), so ask only for unique ones.
      if (rows.filter((x) => opts.b(x) === opts.b(row)).length > 1) return null;
      return { stem: opts.backward(row), answer: opts.a(row), wrong: otherValues(r, rows, row, opts.a), explanation: opts.why(row) };
    }
    return { stem: opts.forward(row), answer: opts.b(row), wrong: otherValues(r, rows, row, opts.b), explanation: opts.why(row) };
  };
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
/** "the earthworm", but genus names like Amoeba and Hydra stand alone. */
const the = (o: string) => (/^[A-Z]/.test(o) ? o : `the ${o}`);
const an = (o: string) => (/^[A-Z]/.test(o) ? o : `${/^[aeiou]/.test(o) ? 'an' : 'a'} ${o}`);

export const biology: Template[] = [
  {
    key: 'biology/deficiency-diseases',
    topic: [NUT, 'Food substances and balanced diet'],
    difficulty: 1,
    variety: 18,
    make: fact(DEFICIENCY, {
      a: ([n]) => n,
      b: ([, d]) => d,
      forward: ([n]) => `A shortage of ${n} in the diet causes`,
      backward: ([, d]) => `${cap(d)} is caused by a shortage of which nutrient in the diet?`,
      why: ([n, d]) => `${cap(d)} is a deficiency disease caused by too little ${n}.`,
    }),
  },
  {
    key: 'biology/hormones',
    topic: [COORD, 'Hormones'],
    difficulty: 2,
    variety: 20,
    make: (r) => {
      const row = r.pick(HORMONES);
      const [h, gland, effect] = row;
      const why = `${cap(h)} is made by the ${gland} and ${effect}.`;
      const kind = r.pick(['gland', 'effect', 'which'] as const);
      if (kind === 'gland') return { stem: `Which gland produces ${h}?`, answer: gland, wrong: otherValues(r, HORMONES, row, (x) => x[1]), explanation: why };
      if (kind === 'effect') return { stem: `What does ${h} do in the body?`, answer: `It ${effect}`, wrong: otherValues(r, HORMONES, row, (x) => `It ${x[2]}`), explanation: why };
      return { stem: `Which hormone ${effect}?`, answer: h, wrong: otherValues(r, HORMONES, row, (x) => x[0]), explanation: why };
    },
  },
  {
    key: 'biology/organelles',
    topic: [CELL, 'Cell structure and organelles'],
    difficulty: 1,
    variety: 20,
    make: fact(ORGANELLES, {
      a: ([o]) => o,
      b: ([, j]) => j,
      forward: ([o]) => `What is the main function of the ${o}?`,
      backward: ([, j]) => `Which part of a cell ${j}?`,
      why: ([o, j]) => `The ${o} ${j}.`,
    }),
  },
  {
    key: 'biology/digestive-enzymes',
    topic: [NUT, 'Digestion and enzymes'],
    difficulty: 2,
    variety: 20,
    make: (r) => {
      const row = r.pick(ENZYMES);
      const [e, where, sub, prod] = row;
      const why = `${cap(e)}, found in ${where}, breaks down ${sub} into ${prod}.`;
      if (r.chance(0.5)) return { stem: `What is the product when ${e} acts on ${sub}?`, answer: prod, wrong: otherValues(r, ENZYMES, row, (x) => x[3]), explanation: why };
      if (ENZYMES.filter((x) => x[2] === sub).length > 1) return { stem: `Which enzyme in ${where} breaks down ${sub}?`, answer: e, wrong: otherValues(r, ENZYMES.filter((x) => x[1] !== where || x[0] === e), row, (x) => x[0]), explanation: why };
      return { stem: `Which enzyme breaks down ${sub} into ${prod}?`, answer: e, wrong: otherValues(r, ENZYMES, row, (x) => x[0]), explanation: why };
    },
  },
  {
    key: 'biology/diseases',
    topic: [HEALTH, 'Pathogens and vectors'],
    difficulty: 2,
    variety: 20,
    make: (r) => {
      const row = r.pick(DISEASES);
      const [d, cause, vector] = row;
      if (vector && r.chance(0.5)) {
        return {
          stem: `Which organism transmits (is the vector of) ${d}?`,
          answer: vector,
          wrong: otherValues(r, DISEASES.filter((x) => x[2]), row, (x) => x[2]!),
          explanation: `${cap(d)} is caused by ${cause} and spread by the ${vector}.`,
        };
      }
      return {
        stem: `What causes ${d}?`,
        answer: cause,
        wrong: otherValues(r, DISEASES, row, (x) => x[1]),
        explanation: `${cap(d)} is caused by ${cause}${vector ? ` and spread by the ${vector}` : ''}.`,
      };
    },
  },
  {
    key: 'biology/classification',
    topic: [VARIETY, 'Classification of organisms'],
    difficulty: 2,
    variety: 24,
    make: fact(GROUPS, {
      a: ([o]) => o,
      b: ([, g]) => g,
      forward: ([o]) => `To which group does ${the(o)} belong?`,
      backward: ([, g]) => `Which of these organisms belongs to the group ${g}?`,
      why: ([o, g]) => `${cap(o)} belongs to ${g}.`,
    }),
  },
  {
    key: 'biology/excretory-organs',
    topic: [EXCR, 'Excretory organs and products'],
    difficulty: 2,
    variety: 10,
    make: fact(EXCRETORY, {
      a: ([o]) => o,
      b: ([, x]) => x,
      forward: ([o]) => `What is the excretory structure of ${an(o)}?`,
      backward: ([, x]) => `Which organism excretes through ${x}?`,
      why: ([o, x]) => `${cap(the(o))} excretes through ${x}.`,
    }),
  },
  {
    key: 'biology/respiratory-organs',
    topic: [RESP, 'Respiratory systems'],
    difficulty: 1,
    variety: 12,
    make: fact(BREATHING, {
      a: ([o]) => o,
      b: ([, x]) => x,
      forward: ([o]) => `Through which structures does ${an(o)} exchange gases?`,
      backward: ([, x]) => `Which organism exchanges gases through ${x}?`,
      why: ([o, x]) => `${cap(an(o))} exchanges gases through ${x}.`,
    }),
  },
  {
    key: 'biology/tropisms',
    topic: [SUPPORT, 'Plant responses and tropisms'],
    difficulty: 1,
    variety: 10,
    make: fact(TROPISMS, {
      a: ([s]) => s,
      b: ([, n]) => n,
      forward: ([s]) => `A plant part grows towards or away from ${s}. What is this response called?`,
      backward: ([, n]) => `${cap(n)} is a growth response to`,
      why: ([s, n]) => `A growth response to ${s} is ${n}.`,
    }),
  },
  {
    key: 'biology/joints',
    topic: [SUPPORT, 'Skeleton and joints'],
    difficulty: 1,
    variety: 6,
    make: (r) => {
      const row = r.pick(JOINTS);
      return {
        stem: `What type of joint is found at ${row[0]}?`,
        answer: row[1],
        wrong: ['ball-and-socket joint', 'hinge joint', 'pivot joint', 'gliding joint', 'fixed (immovable) joint'].filter((x) => x !== row[1]),
        explanation: `There is a ${row[1]} at ${row[0]}.`,
      };
    },
  },
  {
    key: 'biology/nitrogen-cycle',
    topic: [ECO, 'Nutrient cycles'],
    difficulty: 2,
    variety: 10,
    make: fact(NITROGEN, {
      a: ([o]) => o,
      b: ([, j]) => j,
      forward: ([o]) => `What does ${o} do in the nitrogen cycle?`,
      backward: ([, j]) => `Which organism ${j}?`,
      why: ([o, j]) => `${o} ${j}.`,
    }),
  },
  {
    key: 'biology/symbiosis',
    topic: [ECO, 'Symbiotic relationships'],
    difficulty: 2,
    variety: 7,
    make: (r) => {
      const [pair, kind] = r.pick(SYMBIOSIS);
      const meaning = { parasitism: 'one partner benefits and the other is harmed', mutualism: 'both partners benefit', commensalism: 'one partner benefits and the other is neither helped nor harmed' }[kind]!;
      return {
        stem: `What type of relationship exists between ${pair}?`,
        answer: kind,
        wrong: ['parasitism', 'mutualism', 'commensalism', 'competition', 'predation'].filter((x) => x !== kind),
        explanation: `This is ${kind}: ${meaning}.`,
      };
    },
  },
  {
    key: 'biology/sense-organs',
    topic: [COORD, 'Sense organs'],
    difficulty: 2,
    variety: 18,
    make: fact(EYE_EAR, {
      a: ([p]) => p,
      b: ([, j]) => j,
      forward: ([p]) => `What is the function of the ${p}?`,
      backward: ([, j]) => `Which part ${j}?`,
      why: ([p, j]) => `The ${p} ${j}.`,
    }),
  },
  {
    key: 'biology/blood',
    topic: [TRANS, 'Blood and circulation'],
    difficulty: 2,
    variety: 16,
    make: fact(BLOOD, {
      a: ([p]) => p,
      b: ([, j]) => j,
      forward: ([p]) => `What is the main job of the ${p}?`,
      backward: ([, j]) => `Which ${/vein|artery|aorta/.test(j) ? 'blood vessel' : 'part of the blood'} ${j}?`,
      why: ([p, j]) => `The ${p} ${j}.`,
    }),
  },

  // ── Numbers in biology ─────────────────────────────────
  {
    key: 'biology/monohybrid-cross',
    topic: [HERED, 'Genetics and inheritance'],
    difficulty: 3,
    make: (r) => {
      const [trait, dom, rec, letter] = r.pick([
        ['height in pea plants', 'tall', 'short', 'T'],
        ['seed colour in maize', 'yellow', 'white', 'Y'],
        ['coat colour in guinea pigs', 'black', 'white', 'B'],
        ['seed shape in peas', 'round', 'wrinkled', 'R'],
      ] as const);
      const L = letter;
      const l = letter.toLowerCase();
      const cross = r.pick(['het-het', 'het-rec', 'hom-rec'] as const);
      const [p1, p2] = { 'het-het': [L + l, L + l], 'het-rec': [L + l, l + l], 'hom-rec': [L + L, l + l] }[cross];
      const kids = [p1[0] + p2[0], p1[0] + p2[1], p1[1] + p2[0], p1[1] + p2[1]];
      const domCount = kids.filter((k) => k.includes(L)).length;
      const ratio = domCount === 4 ? `all ${dom}` : `${domCount} ${dom} : ${4 - domCount} ${rec}`;
      const grid = `The gametes are ${p1[0]}, ${p1[1]} and ${p2[0]}, ${p2[1]}, giving ${kids.join(', ')}.`;
      if (r.chance(0.5)) {
        return {
          stem: `In ${trait}, ${dom} (${L}) is dominant to ${rec} (${l}). What is the expected ratio of offspring from a cross between ${p1} and ${p2}?`,
          answer: ratio,
          wrong: [`3 ${dom} : 1 ${rec}`, `1 ${dom} : 1 ${rec}`, `all ${dom}`, `1 ${dom} : 3 ${rec}`, `all ${rec}`].filter((x) => x !== ratio),
          explanation: `${grid}\n${domCount} of the 4 have at least one ${L}, so they are ${dom}: ${ratio}.`,
        };
      }
      const ask = r.pick(['recessive', 'heterozygous'] as const);
      const n = ask === 'recessive' ? 4 - domCount : kids.filter((k) => k[0] !== k[1]).length;
      const p = n / 4;
      return {
        stem: `In ${trait}, ${dom} (${L}) is dominant to ${rec} (${l}). Two plants or animals with genotypes ${p1} and ${p2} are crossed. What is the probability that an offspring is ${ask === 'recessive' ? rec : `heterozygous (${L}${l})`}?`,
        answer: m(p === 0 ? '0' : p === 1 ? '1' : frac(n, 4)),
        wrong: ['0', frac(1, 4), frac(1, 2), frac(3, 4), '1'].filter((x) => x !== (p === 0 ? '0' : p === 1 ? '1' : frac(n, 4))).map((x) => m(x)),
        explanation: `${grid}\n${n} of the 4 are ${ask === 'recessive' ? `${l}${l} (${rec})` : `${L}${l}`}, so the probability is ${m(p === 0 ? '0' : p === 1 ? '1' : frac(n, 4))}.`,
      };
    },
  },
  {
    key: 'biology/blood-groups-and-sickle-cell',
    topic: [HERED, 'Genetics and inheritance'],
    difficulty: 3,
    make: (r) => {
      if (r.chance(0.5)) {
        const pairs = r.pick([
          ['AS', 'AS'],
          ['AS', 'AA'],
          ['AS', 'SS'],
          ['AA', 'SS'],
        ] as const);
        const kids = [pairs[0][0] + pairs[1][0], pairs[0][0] + pairs[1][1], pairs[0][1] + pairs[1][0], pairs[0][1] + pairs[1][1]].map((k) => (k === 'SA' ? 'AS' : k));
        const ss = kids.filter((k) => k === 'SS').length;
        const pct = (ss / 4) * 100;
        return {
          stem: `A man with genotype ${pairs[0]} marries a woman with genotype ${pairs[1]}. What is the chance that a child of theirs has sickle cell anaemia (SS)?`,
          answer: `${pct}%`,
          wrong: ['0%', '25%', '50%', '75%', '100%'].filter((x) => x !== `${pct}%`),
          explanation: `The possible children are ${kids.join(', ')}. ${ss === 0 ? 'None' : `${ss} of 4`} ${ss === 1 ? 'is' : 'are'} SS, so the chance is ${pct}%.${pairs[0] === 'AS' && pairs[1] === 'AS' ? ' This is why couples are advised to check their genotypes before marriage.' : ''}`,
        };
      }
      const [g1, g2] = r.pick([
        ['IᴬIᴼ', 'IᴮIᴼ'],
        ['IᴬIᴬ', 'IᴮIᴮ'],
        ['IᴬIᴼ', 'IᴼIᴼ'],
        ['IᴬIᴮ', 'IᴼIᴼ'],
        ['IᴬIᴮ', 'IᴬIᴮ'],
      ] as const);
      const alleles = (g: string) => [g.slice(0, 2), g.slice(2)];
      const type = (a: string, b: string) => {
        const s = new Set([a, b]);
        if (s.has('Iᴬ') && s.has('Iᴮ')) return 'AB';
        if (s.has('Iᴬ')) return 'A';
        if (s.has('Iᴮ')) return 'B';
        return 'O';
      };
      const kids = alleles(g1).flatMap((a) => alleles(g2).map((b) => type(a, b)));
      const possible = [...new Set(kids)].sort().join(', ');
      const all = ['A', 'B', 'AB', 'O'];
          const blood = (g: string) => type(...(alleles(g) as [string, string]));
      return {
        stem: `A father of genotype ${g1} (blood group ${blood(g1)}) and a mother of genotype ${g2} (blood group ${blood(g2)}) have children. Which blood groups are possible for the children?`,
        answer: possible,
        wrong: [all.join(', '), `${blood(g1)}, ${blood(g2)}`, 'A, B', 'AB, O', 'O'].filter((x) => x !== possible),
        explanation: `Pair each allele of the father with each of the mother: ${kids.join(', ')}.\nIᴬ and Iᴮ are codominant and both are dominant to Iᴼ, so the possible groups are ${possible}.`,
      };
    },
  },
  {
    key: 'biology/sex-linkage',
    topic: [HERED, 'Sex determination and sex-linked traits'],
    difficulty: 4,
    make: (r) => {
      const [trait, Xa] = r.pick([
        ['haemophilia', 'Xʰ'],
        ['red–green colour blindness', 'Xᶜ'],
      ] as const);
      const kind = r.pick(['sons', 'daughters', 'boy'] as const);
      if (kind === 'boy') {
        const n = r.int(1, 3);
        return {
          stem: `A couple already has ${n} daughter${n > 1 ? 's' : ''}. What is the probability that their next child will be a boy?`,
          answer: m(frac(1, 2)),
          wrong: [m(frac(1, n + 2)), m(frac(n, n + 1)), m(frac(1, 4)), m('1')],
          explanation: `Each child gets an X from the mother and either an X or a Y from the father, with equal chance. Earlier children make no difference: the probability is ${m(frac(1, 2))}.`,
          difficulty: 2,
        };
      }
      return {
        stem: `${cap(trait)} is caused by a recessive allele on the X chromosome. A carrier woman (${Xa}X) marries a man who does not have ${trait} (XY). What proportion of their ${kind} are expected to have ${trait}?`,
        answer: kind === 'sons' ? m(frac(1, 2)) : m('0'),
        wrong: [m(frac(1, 4)), m(frac(1, 2)), m('0'), m('1'), m(frac(3, 4))],
        explanation: `The children are ${Xa}X, XX (daughters) and ${Xa}Y, XY (sons).\n${kind === 'sons' ? `Half the sons get ${Xa} and, with no second X to mask it, have ${trait}: ${m(frac(1, 2))}.` : `Every daughter gets a normal X from her father, so none has ${trait} (half are carriers): 0.`}`,
      };
    },
  },
  {
    key: 'biology/magnification',
    topic: [CELL, 'Cell structure and organelles'],
    difficulty: 3,
    make: (r) => {
      const mag = r.pick([40, 100, 200, 400, 500, 1000]);
      const actualUm = r.pick([10, 20, 25, 50, 80, 100]);
      const imageMm = (actualUm * mag) / 1000;
      if (r.chance(0.5)) {
        return {
          stem: `A cell ${m(`${actualUm}\\,\\mu\\text{m}`)} long is viewed under a microscope with a magnification of ×${mag}. How long does its image appear?`,
          answer: m(`${sci(imageMm)}\\,\\text{mm}`),
          wrong: [imageMm * 1000, imageMm / 10, actualUm / mag, imageMm * 10].map((x) => m(`${sci(x)}\\,\\text{mm}`)),
          explanation: `Image size = actual size × magnification = ${m(`${actualUm} \\times ${mag} = ${num(actualUm * mag)}\\,\\mu\\text{m}`)}.\n1 mm = 1000 μm, so that is ${m(`${sci(imageMm)}\\,\\text{mm}`)}.`,
        };
      }
      return {
        stem: `The image of a cell under a microscope is ${m(`${sci(imageMm)}\\,\\text{mm}`)} long. The real cell is ${m(`${actualUm}\\,\\mu\\text{m}`)} long. What is the magnification?`,
        answer: `×${num(mag)}`,
        wrong: [mag * 10, mag / 10, mag * 2, mag / 2].map((x) => `×${num(x)}`),
        explanation: `Put both in the same unit: ${m(`${sci(imageMm)}\\,\\text{mm} = ${num(imageMm * 1000)}\\,\\mu\\text{m}`)}.\nMagnification = ${m(`\\frac{\\text{image size}}{\\text{actual size}} = \\frac{${num(imageMm * 1000)}}{${actualUm}} = ${mag}`)}.`,
      };
    },
  },
  {
    key: 'biology/energy-flow',
    topic: [ECO, 'Feeding relationships and energy flow'],
    difficulty: 3,
    make: (r) => {
      const chain = r.pick([
        ['grass', 'grasshopper', 'lizard', 'hawk'],
        ['phytoplankton', 'zooplankton', 'small fish', 'kingfisher'],
        ['maize', 'rat', 'snake', 'eagle'],
        ['leaves', 'caterpillar', 'bird', 'cat'],
      ]);
      const E = r.pick([10_000, 20_000, 50_000, 100_000, 1_000_000]);
      if (r.chance(0.6)) {
        const level = r.int(1, 3);
        const got = E / 10 ** level;
        return {
          stem: `In the food chain ${chain.join(' → ')}, the ${chain[0]} ${['leaves', 'phytoplankton'].includes(chain[0]) ? 'trap' : 'traps'} ${num(E)} kJ of energy. If about 10% of the energy passes from one level to the next, how much reaches the ${chain[level]}?`,
          answer: `${num(got)} kJ`,
          wrong: [E / 10 ** (level + 1), E / 10 ** Math.max(0, level - 1), E * 0.9 ** level, E / (10 * level)].filter((x) => x !== got).map((x) => `${num(Math.round(x * 100) / 100)} kJ`),
          explanation: `Each step passes on about a tenth. The ${chain[level]} is ${level} step${level > 1 ? 's' : ''} up from the ${chain[0]}: ${num(E)} ÷ ${num(10 ** level)} = ${num(got)} kJ.\nThe rest is lost as heat in respiration, in movement and in waste.`,
        };
      }
      const pct = r.pick([5, 8, 10, 12, 15, 20]);
      const next = (E * pct) / 100;
      return {
        stem: `The ${chain[1]} in a food chain take in ${num(E)} kJ, and the ${chain[2]} that eat them gain ${num(next)} kJ. What is the efficiency of energy transfer?`,
        answer: `${pct}%`,
        wrong: [100 - pct, pct * 10, (E / next), pct / 10].map((x) => `${num(Math.round(x * 100) / 100)}%`),
        explanation: `Efficiency = ${m(`\\frac{${num(next).replace(/,/g, '{,}')}}{${num(E).replace(/,/g, '{,}')}} \\times 100\\% = ${pct}\\%`)}.`,
      };
    },
  },
  {
    key: 'biology/population',
    topic: [ECO, 'Population studies'],
    difficulty: 3,
    make: (r) => {
      if (r.chance(0.5)) {
        const N = r.pick([200, 240, 300, 400, 450, 500, 600, 800, 1000]);
        const marked = r.pick([20, 30, 40, 50, 60]);
        const caught = r.pick([30, 40, 50, 60, 80]);
        const recap = (marked * caught) / N;
        if (!Number.isInteger(recap) || recap < 1) return null;
        return {
          stem: `To estimate a population of snails, ${marked} are caught, marked and released. Later, ${caught} are caught and ${recap} of them are found to be marked. What is the estimated population?`,
          answer: num(N),
          wrong: [marked + caught, marked * caught, (caught * recap) / marked, N / 2].filter((x) => x !== N && Number.isInteger(x)).map((x) => num(x)),
          explanation: `Capture–recapture (Lincoln index): ${m(`N = \\frac{\\text{marked} \\times \\text{second catch}}{\\text{marked in second catch}} = \\frac{${marked} \\times ${caught}}{${recap}} = ${N}`)}.`,
        };
      }
      const counts = Array.from({ length: 5 }, () => r.int(2, 12));
      const avg = counts.reduce((s, x) => s + x, 0) / 5;
      const q = r.pick([0.25, 0.5, 1]);
      const field = r.pick([100, 200, 500, 1000]);
      const est = (avg / q) * field;
      return {
        stem: `Five ${m(`${num(q)}\\,\\text{m}^2`)} quadrats thrown in a ${m(`${field}\\,\\text{m}^2`)} field contain ${counts.join(', ')} plants of a species. Estimate the number of that plant in the field.`,
        answer: num(est),
        wrong: [avg * field, est / 5, counts.reduce((s, x) => s + x, 0) * field, (avg * field) / (q * 10)].filter((x) => x !== est).map((x) => num(Math.round(x))),
        explanation: `Average per quadrat = ${num(avg)}. Per square metre: ${m(`\\frac{${num(avg)}}{${num(q)}} = ${num(avg / q)}`)}.\nIn the field: ${m(`${num(avg / q)} \\times ${field} = ${num(est).replace(/,/g, '{,}')}`)}.`,
      };
    },
  },
  {
    key: 'biology/respiratory-quotient',
    topic: [RESP, 'Aerobic and anaerobic respiration'],
    difficulty: 3,
    make: (r) => {
      const [food, rq] = r.pick([
        ['carbohydrate', 1],
        ['fat', 0.7],
        ['protein', 0.9],
      ] as const);
      const O2 = r.pick([10, 20, 30, 40, 50, 100]);
      const CO2 = O2 * rq;
      return {
        stem: `An organism takes in ${m(`${O2}\\,\\text{cm}^3`)} of oxygen and gives out ${m(`${num(CO2)}\\,\\text{cm}^3`)} of carbon(IV) oxide in the same time. What is its respiratory quotient, and what is it most likely respiring?`,
        answer: `${num(rq)}; ${food}`,
        wrong: [`${num(sig(O2 / CO2, 2))}; ${food}`, ...(['carbohydrate', 'fat', 'protein'] as const).filter((x) => x !== food).map((x) => `${num(rq)}; ${x}`), `${num(rq === 1 ? 0.7 : 1)}; carbohydrate`],
        explanation: `${m(`\\text{RQ} = \\frac{\\text{CO}_2 \\text{ given out}}{\\text{O}_2 \\text{ taken in}} = \\frac{${num(CO2)}}{${O2}} = ${num(rq)}`)}.\nAbout 1 means carbohydrate, about 0.7 fat and about 0.9 protein.`,
      };
    },
  },
];
