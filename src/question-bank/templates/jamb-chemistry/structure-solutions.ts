import { m, num, type Template } from '../engine.js';
import { choices, qty, sci } from '../jamb-physics/kit.js';
import { AR, atoms, CU, f, F_CONST, fx, mr } from './kit.js';

const ATOM = 'Atomic Structure and Bonding';
const ACID = 'Acids, Bases and Salts';
const REDOX = 'Oxidation and Reduction';
const ELEC = 'Electrolysis';
const SOL = 'Solubility';
const WATER = 'Water';

/** Elements 1–20: symbol, name, mass number of the common isotope. */
const ELEMENTS: [string, string, number][] = [
  ['H', 'hydrogen', 1],
  ['He', 'helium', 4],
  ['Li', 'lithium', 7],
  ['Be', 'beryllium', 9],
  ['B', 'boron', 11],
  ['C', 'carbon', 12],
  ['N', 'nitrogen', 14],
  ['O', 'oxygen', 16],
  ['F', 'fluorine', 19],
  ['Ne', 'neon', 20],
  ['Na', 'sodium', 23],
  ['Mg', 'magnesium', 24],
  ['Al', 'aluminium', 27],
  ['Si', 'silicon', 28],
  ['P', 'phosphorus', 31],
  ['S', 'sulphur', 32],
  ['Cl', 'chlorine', 35],
  ['Ar', 'argon', 40],
  ['K', 'potassium', 39],
  ['Ca', 'calcium', 40],
];

/** Electrons per shell (2, 8, 8, 2 model) and in s/p notation. */
const shells = (z: number) => {
  const out: number[] = [];
  for (const cap of [2, 8, 8, 2]) {
    if (z <= 0) break;
    out.push(Math.min(cap, z));
    z -= cap;
  }
  return out;
};
const spdf = (z: number) => {
  const orbitals: [string, number][] = [
    ['1s', 2],
    ['2s', 2],
    ['2p', 6],
    ['3s', 2],
    ['3p', 6],
    ['4s', 2],
  ];
  const out: string[] = [];
  for (const [o, cap] of orbitals) {
    if (z <= 0) break;
    out.push(`${o}^{${Math.min(cap, z)}}`);
    z -= cap;
  }
  return out.join('\\,');
};

/** Species, the element asked about, and its oxidation number. Other elements use the usual fixed values. */
const OX: [species: string, el: string, name: string][] = [
  ['KMnO4', 'Mn', 'potassium tetraoxomanganate(VII)'],
  ['MnO2', 'Mn', 'manganese(IV) oxide'],
  ['K2Cr2O7', 'Cr', 'potassium heptaoxodichromate(VI)'],
  ['Cr2O7^2-', 'Cr', 'the heptaoxodichromate(VI) ion'],
  ['H2SO4', 'S', 'tetraoxosulphate(VI) acid'],
  ['SO2', 'S', 'sulphur(IV) oxide'],
  ['H2S', 'S', 'hydrogen sulphide'],
  ['Na2S2O3', 'S', 'sodium thiosulphate'],
  ['NO3^-', 'N', 'the trioxonitrate(V) ion'],
  ['NH3', 'N', 'ammonia'],
  ['NH4^+', 'N', 'the ammonium ion'],
  ['NO2', 'N', 'nitrogen(IV) oxide'],
  ['HNO2', 'N', 'dioxonitrate(III) acid'],
  ['Fe2O3', 'Fe', 'iron(III) oxide'],
  ['ClO3^-', 'Cl', 'the trioxochlorate(V) ion'],
  ['HClO', 'Cl', 'oxochlorate(I) acid'],
  ['ClO4^-', 'Cl', 'the tetraoxochlorate(VII) ion'],
  ['P2O5', 'P', 'phosphorus(V) oxide'],
  ['H2O2', 'O', 'hydrogen peroxide'],
  ['CO3^2-', 'C', 'the trioxocarbonate(IV) ion'],
  ['CH4', 'C', 'methane'],
  ['PO4^3-', 'P', 'the tetraoxophosphate(V) ion'],
];
/** The usual ion each element forms, by atomic number. */
const ION: Record<number, number> = { 3: 1, 4: 2, 7: -3, 8: -2, 9: -1, 11: 1, 12: 2, 13: 3, 15: -3, 16: -2, 17: -1, 19: 1, 20: 2 };
const FIXED: Record<string, number> = { H: 1, O: -2, K: 1, Na: 1, Ca: 2, Mg: 2 };
const signedOx = (x: number) => (x > 0 ? `+${x}` : `${x}`);
const chargeOf = (species: string) => {
  const c = species.split('^')[1];
  if (!c) return 0;
  const n = Number(c.replace(/[+-]/, '') || 1);
  return c.endsWith('-') ? -n : n;
};

/** Metals for electrolysis: symbol, name, charge on the ion. */
const METALS: [string, string, number][] = [
  ['Cu', 'copper', 2],
  ['Ag', 'silver', 1],
  ['Al', 'aluminium', 3],
  ['Zn', 'zinc', 2],
  ['Mg', 'magnesium', 2],
  ['Na', 'sodium', 1],
];

const HYDRATES: [name: string, formula: string, x: number, anhydrous: string][] = [
  ['copper(II) tetraoxosulphate(VI) pentahydrate', 'CuSO4.5H2O', 5, 'CuSO4'],
  ['sodium trioxocarbonate(IV) decahydrate', 'Na2CO3.10H2O', 10, 'Na2CO3'],
  ['magnesium tetraoxosulphate(VI) heptahydrate', 'MgSO4.7H2O', 7, 'MgSO4'],
  ['iron(II) tetraoxosulphate(VI) heptahydrate', 'FeSO4.7H2O', 7, 'FeSO4'],
  ['calcium chloride hexahydrate', 'CaCl2.6H2O', 6, 'CaCl2'],
];

export const structureSolutions: Template[] = [
  // ── Atomic structure ───────────────────────────────────
  {
    key: 'jamb-chem/subatomic-particles',
    topic: [ATOM, 'Atomic structure and isotopes'],
    difficulty: 1,
    make: (r) => {
      const z = r.int(3, 20);
      const [sym, name, A0] = ELEMENTS[z - 1];
      const A = A0 + r.pick([0, 0, 1, 2]);
      const ion = ION[z] && r.chance(0.35) ? ION[z] : 0;
      const nucl = m(`{}^{${A}}_{${z}}\\text{${sym}}${ion ? `^{${Math.abs(ion) > 1 ? Math.abs(ion) : ''}${ion > 0 ? '+' : '-'}}` : ''}`);
      const ask = r.pick(['neutrons', 'electrons', 'protons'] as const);
      const val = ask === 'neutrons' ? A - z : ask === 'electrons' ? z - ion : z;
      return {
        stem: `How many ${ask} are in ${ion ? 'the ion' : 'an atom of'} ${nucl}${ion ? '' : ` (${name})`}?`,
        answer: String(val),
        wrong: [A - z, z, A, z - ion, A + z, z + ion].filter((x) => x !== val && x >= 0).map(String),
        explanation: `The bottom number is the atomic number (protons): ${z}. The top is the mass number (protons + neutrons): ${A}.\n${ask === 'neutrons' ? `Neutrons = ${A} − ${z} = ${A - z}.` : ask === 'protons' ? `Protons = ${z}.` : ion ? `A charge of ${ion > 0 ? '+' : '−'}${Math.abs(ion)} means ${Math.abs(ion)} electron${Math.abs(ion) > 1 ? 's' : ''} ${ion > 0 ? 'lost' : 'gained'}: ${z} ${ion > 0 ? '−' : '+'} ${Math.abs(ion)} = ${val}.` : `A neutral atom has as many electrons as protons: ${z}.`}`,
        difficulty: ion ? 2 : 1,
      };
    },
  },
  {
    key: 'jamb-chem/relative-atomic-mass',
    topic: [ATOM, 'Atomic structure and isotopes'],
    difficulty: 2,
    make: (r) => {
      const [sym, a1, a2] = r.pick([
        ['Cl', 35, 37],
        ['Cu', 63, 65],
        ['B', 10, 11],
        ['Li', 6, 7],
        ['Z', 16, 18],
        ['X', 20, 22],
        ['Br', 79, 81],
      ] as const);
      const p1 = r.pick([60, 70, 75, 80, 90, 25, 50]);
      const ram = (a1 * p1 + a2 * (100 - p1)) / 100;
      return {
        stem: `An element ${sym} has two isotopes: ${m(`{}^{${a1}}\\text{${sym}}`)} (${p1}%) and ${m(`{}^{${a2}}\\text{${sym}}`)} (${100 - p1}%). What is its relative atomic mass?`,
        ...choices(CU.none, ram, [(a1 + a2) / 2, (a1 * (100 - p1) + a2 * p1) / 100, ram + 0.5, a1]),
        explanation: `Take the average weighted by abundance: ${m(`\\frac{${a1} \\times ${p1} + ${a2} \\times ${100 - p1}}{100} = ${sci(ram)}`)}.`,
      };
    },
  },
  {
    key: 'jamb-chem/electron-configuration',
    topic: [ATOM, 'Electronic configuration'],
    difficulty: 2,
    make: (r) => {
      const z = r.int(3, 20);
      const [sym, name] = ELEMENTS[z - 1];
      const sh = shells(z);
      const valence = sh[sh.length - 1];
      const kind = r.pick(['shells', 'spdf', 'group', 'valency'] as const);
      const shellStr = (s: number[]) => s.join(', ');
      if (kind === 'shells') {
        const wrongs = [[...sh.slice(0, -1), valence + 1], z > 2 ? [2, z - 2] : [z], [...sh].reverse(), sh.length > 1 ? [...sh.slice(0, -2), sh[sh.length - 2] + valence] : [z + 1]].filter((w) => w.every((x) => x > 0) && w.length);
        return {
          stem: `What is the electronic configuration of ${name} (atomic number ${z})?`,
          answer: shellStr(sh),
          wrong: wrongs.map(shellStr),
          explanation: `Fill the shells in order: 2 in the first, then 8, then 8.\n${name[0].toUpperCase() + name.slice(1)} has ${z} electrons: ${shellStr(sh)}.`,
        };
      }
      if (kind === 'spdf') {
        if (z < 5) return null;
        return {
          stem: `Which is the electronic configuration of an atom with atomic number ${z}?`,
          answer: m(spdf(z)),
          wrong: [m(spdf(z + 1)), m(spdf(z - 1)), m(spdf(z).replace(/\^\{(\d+)\}$/, (_, d) => `^{${Number(d) + 2}}`)), m(spdf(z + 2))],
          explanation: `Fill orbitals in order 1s, 2s, 2p, 3s, 3p, 4s (s holds 2, p holds 6) until ${z} electrons are placed: ${m(spdf(z))}.`,
          difficulty: 3,
        };
      }
      if (kind === 'group') {
        if (z <= 2) return null;
        const group = valence === 8 ? 0 : valence;
        const period = sh.length;
        return {
          stem: `An element has the electronic configuration ${shellStr(sh)}. In which group and period of the periodic table is it?`,
          answer: `Group ${group === 0 ? '0 (VIII)' : ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][group - 1]}, period ${period}`,
          wrong: [
            `Group ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'I'][period - 1]}, period ${valence}`,
            `Group ${group === 0 ? '0 (VIII)' : ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][group - 1]}, period ${period + 1}`,
            `Group ${['II', 'III', 'IV', 'V', 'VI', 'VII', '0 (VIII)', 'I'][group === 0 ? 7 : group - 1]}, period ${period}`,
            `Group ${group === 0 ? '0 (VIII)' : ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][group - 1]}, period ${period - 1}`,
          ],
          explanation: `The number of shells gives the period: ${period}. The electrons in the outer shell give the group: ${valence}${valence === 8 ? ', a full outer shell, which is group 0' : ''}.`,
        };
      }
      if ([2, 10, 18].includes(z) || z <= 2) return null;
      const valency = valence <= 4 ? valence : 8 - valence;
      return {
        stem: `What is the valency of an element with the electronic configuration ${shellStr(sh)}?`,
        answer: String(valency),
        wrong: [valence, 8 - valence, valency + 1, sh.length].filter((x) => x !== valency && x >= 0).map(String),
        explanation: `It has ${valence} outer electron${valence > 1 ? 's' : ''}. ${valence <= 4 ? `It loses or shares them, so its valency is ${valency}.` : `It gains ${8 - valence} to fill the shell, so its valency is ${valency}.`}`,
      };
    },
  },

  // ── Acids, bases and salts ─────────────────────────────
  {
    key: 'jamb-chem/concentration',
    topic: [ACID, 'Concentration and titration'],
    difficulty: 2,
    make: (r) => {
      const [name, formula] = r.pick([
        ['sodium hydroxide', 'NaOH'],
        ['sodium chloride', 'NaCl'],
        ['sodium trioxocarbonate(IV)', 'Na2CO3'],
        ['potassium hydroxide', 'KOH'],
        ['sodium trioxonitrate(V)', 'NaNO3'],
        ['tetraoxosulphate(VI) acid', 'H2SO4'],
      ] as const);
      const M = mr(formula);
      const c = r.pick([0.05, 0.1, 0.2, 0.25, 0.5, 1, 2]);
      const V = r.pick([100, 200, 250, 500, 1000]);
      const mass = (c * M * V) / 1000;
      const kind = r.pick(['molar', 'mass', 'gdm3', 'mm'] as const);
      const ar = `[${Object.keys(atoms(formula)).map((e) => `${e} = ${AR[e]}`).join(', ')}]`;
      if (kind === 'molar') {
        return {
          stem: `What is the concentration in ${m('\\text{mol dm}^{-3}')} of a solution containing ${qty(mass, CU.g)} of ${name} in ${m(`${V}\\,\\text{cm}^3`)} of solution? ${ar}`,
          ...choices(CU.M, c, [mass / M, (mass / M) * V, c * 10, mass / V]),
          explanation: `Moles = ${m(`\\frac{${sci(mass)}}{${M}} = ${sci((mass / M))}`)}. Volume = ${m(`\\frac{${V}}{1000} = ${num(V / 1000)}`)} dm³.\n${m(`C = \\frac{${sci(mass / M)}}{${num(V / 1000)}} = ${num(c)}`)} mol dm⁻³.`,
        };
      }
      if (kind === 'mass') {
        return {
          stem: `What mass of ${name} is needed to make ${m(`${V}\\,\\text{cm}^3`)} of a ${qty(c, CU.M)} solution? ${ar}`,
          ...choices(CU.g, mass, [c * M, c * M * V, (c * V) / 1000, mass * 10]),
          explanation: `Moles needed = ${m(`${num(c)} \\times \\frac{${V}}{1000} = ${sci((c * V) / 1000)}`)}.\nMass = ${m(`${sci((c * V) / 1000)} \\times ${M} = ${sci(mass)}`)} g.`,
        };
      }
      if (kind === 'gdm3') {
        return {
          stem: `A solution of ${name} contains ${m(`${sci(c * M)}\\,\\text{g dm}^{-3}`)}. What is its concentration in ${m('\\text{mol dm}^{-3}')}? ${ar}`,
          ...choices(CU.M, c, [c * M * M, M / (c * M), c * 2, c * M]),
          explanation: `Divide by the molar mass (${M}): ${m(`\\frac{${sci(c * M)}}{${M}} = ${num(c)}`)} mol dm⁻³.`,
          difficulty: 1,
        };
      }
      const solute = r.pick([5, 10, 20, 25, 40]);
      const solvent = r.pick([45, 80, 90, 180, 200].filter((x) => x > solute));
      const p = (100 * solute) / (solute + solvent);
      return {
        stem: `A solution contains ${qty(solute, CU.g)} of solute in ${qty(solvent, CU.g)} of water. What is its concentration as a percentage by mass?`,
        ...choices(CU.pct, p, [(100 * solute) / solvent, (100 * solvent) / (solute + solvent), solute, 100 - p / 2]),
        explanation: `The solution's mass is solute + solvent = ${solute + solvent} g.\n${m(`\\frac{${solute}}{${solute + solvent}} \\times 100\\% = ${sci(p)}\\%`)}.`,
        difficulty: 1,
      };
    },
  },
  {
    key: 'jamb-chem/dilution',
    topic: [ACID, 'Concentration and titration'],
    difficulty: 2,
    make: (r) => {
      const C1 = r.pick([0.5, 0.6, 1, 1.5, 2, 2.2, 5]);
      const V1 = r.pick([10, 50, 100, 250, 300, 500]);
      const C2 = C1 / r.pick([2, 4, 5, 1.5, 10]);
      const V2 = (C1 * V1) / C2;
      const unit = V1 >= 10 && V1 <= 20 ? 'dm' : 'cm';
      const U3 = unit === 'dm' ? CU.dm3 : CU.cm3;
      if (r.chance(0.5)) {
        return {
          stem: `What volume of water must be added to ${qty(V1, U3)} of ${qty(C1, CU.M)} acid to make its concentration ${qty(C2, CU.M)}?`,
          ...choices(U3, V2 - V1, [V2, (C2 * V1) / C1, V1, V2 + V1]),
          explanation: `${m('C_1V_1 = C_2V_2')}: final volume ${m(`V_2 = \\frac{${num(C1)} \\times ${V1}}{${sci(C2)}} = ${sci(V2)}`)}.\nWater to add = ${m(`${sci(V2)} - ${V1} = ${sci(V2 - V1)}`)}. (The question asks for the water added, not the final volume.)`,
          difficulty: 3,
        };
      }
      return {
        stem: `To what volume must ${qty(V1, U3)} of a ${qty(C1, CU.M)} solution be diluted to give a ${qty(C2, CU.M)} solution?`,
        ...choices(U3, V2, [V2 - V1, (C2 * V1) / C1, V1 * C1 * C2, V2 / 2]),
        explanation: `The moles of solute don't change: ${m('C_1V_1 = C_2V_2')}.\n${m(`V_2 = \\frac{${num(C1)} \\times ${V1}}{${sci(C2)}} = ${sci(V2)}`)}.`,
      };
    },
  },
  {
    key: 'jamb-chem/titration',
    topic: [ACID, 'Concentration and titration'],
    difficulty: 3,
    make: (r) => {
      const [acid, an, base, bn, a, b, eq] = r.pick([
        ['HCl', 'hydrochloric acid', 'NaOH', 'sodium hydroxide', 1, 1, 'HCl + NaOH → NaCl + H2O'],
        ['H2SO4', 'tetraoxosulphate(VI) acid', 'NaOH', 'sodium hydroxide', 1, 2, 'H2SO4 + 2NaOH → Na2SO4 + 2H2O'],
        ['HCl', 'hydrochloric acid', 'Na2CO3', 'sodium trioxocarbonate(IV)', 2, 1, '2HCl + Na2CO3 → 2NaCl + H2O + CO2'],
        ['HNO3', 'trioxonitrate(V) acid', 'KOH', 'potassium hydroxide', 1, 1, 'HNO3 + KOH → KNO3 + H2O'],
        ['H2SO4', 'tetraoxosulphate(VI) acid', 'KOH', 'potassium hydroxide', 1, 2, 'H2SO4 + 2KOH → K2SO4 + 2H2O'],
      ] as const);
      const eqTex = m(
        eq
          .split(' ')
          .map((t) => (t === '+' ? '+' : t === '→' ? '\\rightarrow' : t.replace(/^(\d*)(.+)$/, (_, c, x) => `${c}${fx(x)}`)))
          .join(' '),
      );
      const Ca = r.pick([0.05, 0.1, 0.2, 0.25, 0.5, 1, 1.2]);
      const Va = r.pick([10, 20, 25]);
      const Cb = r.pick([0.1, 0.2, 0.25, 0.5, 1]);
      const Vb = (Ca * Va * b) / (a * Cb);
      if (Vb > 100 || Vb < 2) return null;
      if (r.chance(0.5)) {
        return {
          stem: `${eqTex}\nWhat volume of ${qty(Cb, CU.M)} ${bn} exactly neutralises ${m(`${Va}\\,\\text{cm}^3`)} of ${qty(Ca, CU.M)} ${an}?`,
          ...choices(CU.cm3, Vb, [(Ca * Va) / Cb, (Ca * Va * a) / (b * Cb), (Cb * Va) / Ca, Vb * 2]),
          explanation: `${m(`\\frac{C_AV_A}{C_BV_B} = \\frac{${a}}{${b}}`)} (mole ratio of acid to base in the equation).\n${m(`V_B = \\frac{${num(Ca)} \\times ${Va} \\times ${b}}{${a} \\times ${num(Cb)}} = ${sci(Vb)}`)} cm³.`,
        };
      }
      const VbShown = Number(Vb.toFixed(1));
      if (VbShown !== Vb) return null;
      return {
        stem: `${eqTex}\n${m(`${Va}\\,\\text{cm}^3`)} of ${an} is exactly neutralised by ${m(`${num(Vb)}\\,\\text{cm}^3`)} of ${qty(Cb, CU.M)} ${bn}. What is the concentration of the acid?`,
        ...choices(CU.M, Ca, [(Cb * Vb) / Va, (Cb * Vb * b) / (a * Va), (Va * Cb) / Vb, Ca * 2]),
        explanation: `Moles of ${f(base)} = ${m(`${num(Cb)} \\times \\frac{${num(Vb)}}{1000} = ${sci((Cb * Vb) / 1000)}`)}.\nFrom the equation, moles of ${f(acid)} = ${m(`${sci((Cb * Vb) / 1000)} \\times \\frac{${a}}{${b}} = ${sci((Cb * Vb * a) / (1000 * b))}`)}.\n${m(`C_A = \\frac{${sci((Cb * Vb * a) / (1000 * b))}}{${Va} / 1000} = ${sci(Ca)}`)} mol dm⁻³.`,
        difficulty: 4,
      };
    },
  },
  {
    key: 'jamb-chem/ph',
    topic: [ACID, 'pH and indicators'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['h', 'oh', 'diprotic', 'dilute'] as const);
      const n = r.int(1, 13);
      if (kind === 'h') {
        return {
          stem: `The hydrogen ion concentration of a solution is ${m(`1 \\times 10^{-${n}}\\,\\text{mol dm}^{-3}`)}. What is its pH?`,
          answer: String(n),
          wrong: [14 - n, n + 1, -n, n - 1].filter((x) => x !== n).map(String),
          explanation: `${m(`\\text{pH} = -\\log[\\text{H}^+] = -\\log(10^{-${n}}) = ${n}`)}.`,
        };
      }
      if (kind === 'oh') {
        return {
          stem: `The hydroxide ion concentration of a solution is ${m(`1 \\times 10^{-${n}}\\,\\text{mol dm}^{-3}`)}. What is its pH?`,
          answer: String(14 - n),
          wrong: [n, 14 + n, 13 - n, 15 - n].filter((x) => x !== 14 - n && x >= 0).map(String),
          explanation: `${m(`\\text{pOH} = -\\log[\\text{OH}^-] = ${n}`)}.\n${m(`\\text{pH} = 14 - \\text{pOH} = 14 - ${n} = ${14 - n}`)}.`,
          difficulty: 3,
        };
      }
      if (kind === 'diprotic') {
        const k = r.pick([1, 2, 3]);
        const c = 0.5 * 10 ** -k;
        return {
          stem: `What is the pH of ${qty(c, CU.M)} ${f('H2SO4')}, assuming it ionises completely?`,
          answer: String(k),
          wrong: [k + 1, k - 1, 14 - k, k + 0.3].filter((x) => x !== k && x >= 0).map((x) => num(x)),
          explanation: `Each ${f('H2SO4')} gives 2 ${m('\\text{H}^+')}: ${m(`[\\text{H}^+] = 2 \\times ${sci(c)} = ${sci(2 * c)} = 10^{-${k}}`)}.\n${m(`\\text{pH} = ${k}`)}.`,
          difficulty: 3,
        };
      }
      const p = r.int(1, 5);
      const k = r.pick([10, 100, 1000]);
      const steps = Math.log10(k);
      return {
        stem: `A solution of a strong acid has a pH of ${p}. It is diluted ${k} times with water. What is the new pH?`,
        answer: String(p + steps),
        wrong: [p, p - 1, p + steps + 1, p * 10].filter((x) => x !== p + steps && x > 0).map(String),
        explanation: `Diluting ${k} times makes ${m('[\\text{H}^+]')} ${k} times smaller, and each factor of 10 raises the pH by 1.\nNew pH = ${p} + ${steps} = ${p + steps}.`,
        difficulty: 3,
      };
    },
  },

  // ── Redox ──────────────────────────────────────────────
  {
    key: 'jamb-chem/oxidation-number',
    topic: [REDOX, 'Oxidation numbers'],
    difficulty: 2,
    variety: 22,
    make: (r) => {
      const [species, el, name] = r.pick(OX);
      const at = atoms(species);
      const charge = chargeOf(species);
      const others = Object.entries(at).filter(([e]) => e !== el);
      const sumOthers = others.reduce((s, [e, c]) => s + FIXED[e] * c, 0);
      const x = (charge - sumOthers) / at[el];
      const terms = others.map(([e, c]) => `${c > 1 ? c : ''}(${signedOx(FIXED[e])})`).join(' + ');
      return {
        stem: `What is the oxidation number of ${el} in ${name}, ${f(species)}?`,
        answer: signedOx(x),
        wrong: [x + 1, x - 1, -x, x + 2, x - 2].filter((w) => w !== x && w !== 0).map(signedOx),
        explanation: `${others.map(([e]) => `${e} is ${signedOx(FIXED[e])}`).join(', ')}, and the oxidation numbers add up to the charge (${charge}).\n${m(`${at[el] > 1 ? at[el] : ''}x + ${terms} = ${charge}`)}, so ${m(`x = ${signedOx(x)}`)}.`,
      };
    },
  },

  // ── Electrolysis ───────────────────────────────────────
  {
    key: 'jamb-chem/faraday-mass',
    topic: [ELEC, "Faraday's laws"],
    difficulty: 3,
    make: (r) => {
      const [sym, name, z] = r.pick(METALS);
      const I = r.pick([0.5, 1, 1.5, 1.6, 2, 2.5, 3, 5, 10]);
      const [t, tText] = r.pick([
        [600, '10 minutes'],
        [1800, '30 minutes'],
        [3600, '1 hour'],
        [5400, '1 hour 30 minutes'],
        [7200, '2 hours'],
        [9000, '2 hours 30 minutes'],
        [965, '965 seconds'],
        [1930, '1930 seconds'],
      ] as const);
      const Q = I * t;
      const mass = (AR[sym] * Q) / (z * F_CONST);
      if (r.chance(0.4)) {
        return {
          stem: `What quantity of electricity is needed to deposit ${qty(mass, CU.g)} of ${name} from a solution of its ions, ${m(`\\text{${sym}}^{${z > 1 ? z : ''}+}`)}? [${sym} = ${AR[sym]}; F = 96,500 C]`,
          ...choices(CU.C, Q, [(mass / AR[sym]) * F_CONST, Q * z, (mass * F_CONST) / z, Q / 2]),
          explanation: `Moles of ${name} = ${m(`\\frac{${sci(mass)}}{${AR[sym]}} = ${sci(mass / AR[sym])}`)}. Each ion needs ${z} electron${z > 1 ? 's' : ''}, so ${m(`${sci(mass / AR[sym])} \\times ${z} = ${sci((mass / AR[sym]) * z)}`)} faradays.\nQ = ${m(`${sci((mass / AR[sym]) * z)} \\times 96{,}500 = ${sci(Q)}`)} C.`,
        };
      }
      return {
        stem: `What mass of ${name} is deposited when a current of ${qty(I, CU.A)} is passed through a solution of its ions, ${m(`\\text{${sym}}^{${z > 1 ? z : ''}+}`)}, for ${tText}? [${sym} = ${AR[sym]}; F = 96,500 C]`,
        ...choices(CU.g, mass, [mass * z, (AR[sym] * I * (t / 60)) / (z * F_CONST), (AR[sym] * Q) / F_CONST / (z + 1), mass / z]),
        explanation: `Charge: ${m(`Q = It = ${num(I)} \\times ${t} = ${sci(Q)}`)} C (time in seconds).\nMoles of electrons = ${m(`\\frac{${sci(Q)}}{96{,}500} = ${sci(Q / F_CONST)}`)}; ${m(`\\text{${sym}}^{${z > 1 ? z : ''}+}`)} needs ${z} per atom, so moles of ${name} = ${sci(Q / F_CONST / z)}.\nMass = ${m(`${sci(Q / F_CONST / z)} \\times ${AR[sym]} = ${sci(mass)}`)} g.`,
      };
    },
  },
  {
    key: 'jamb-chem/same-charge',
    topic: [ELEC, "Faraday's laws"],
    difficulty: 4,
    make: (r) => {
      const [[s1, n1, z1], [s2, n2, z2]] = r.shuffle(METALS.filter(([s]) => s !== 'Na')).slice(0, 2);
      const m1 = r.pick([1.08, 2.16, 3.6, 5.4, 6.4, 3.2, 1.2, 2.7]);
      const faradays = (m1 / AR[s1]) * z1;
      const m2 = (faradays / z2) * AR[s2];
      if (r.chance(0.35)) {
        const cost = r.pick([10, 12, 20, 50]);
        const mb = r.pick([1.2, 2.4, 2.7, 3.2, 5.4, 6.5, 9]);
        const fb = (mb / AR[s2]) * z2;
        const c2 = (cost * fb) / faradays;
        return {
          stem: `It costs ₦${cost} in electricity to deposit ${qty(m1, CU.g)} of ${n1} (${m(`\\text{${s1}}^{${z1 > 1 ? z1 : ''}+}`)}). At the same rate, what would it cost to deposit ${qty(mb, CU.g)} of ${n2} (${m(`\\text{${s2}}^{${z2 > 1 ? z2 : ''}+}`)})? [${s1} = ${AR[s1]}, ${s2} = ${AR[s2]}]`,
          answer: `₦${num(Number(c2.toFixed(2)))}`,
          wrong: [cost, (cost * mb) / m1, c2 * (z1 / z2) === c2 ? c2 / 2 : c2 * (z1 / z2), c2 * 2].filter((x) => Math.abs(x - c2) > 0.01).map((x) => `₦${num(Number(x.toFixed(2)))}`),
          explanation: `Cost goes with the charge, which goes with moles × ion charge.\nFirst metal: ${m(`\\frac{${m1}}{${AR[s1]}} \\times ${z1} = ${sci(faradays)}`)} F. Second: ${m(`\\frac{${sci(mb)}}{${AR[s2]}} \\times ${z2} = ${sci(fb)}`)} F.\nCost = ${m(`${cost} \\times \\frac{${sci(fb)}}{${sci(faradays)}}`)} = ₦${num(Number(c2.toFixed(2)))}.`,
        };
      }
      return {
        stem: `A quantity of electricity deposits ${qty(m1, CU.g)} of ${n1} from a solution of ${m(`\\text{${s1}}^{${z1 > 1 ? z1 : ''}+}`)} ions. What mass of ${n2} would the same quantity of electricity deposit from ${m(`\\text{${s2}}^{${z2 > 1 ? z2 : ''}+}`)} ions? [${s1} = ${AR[s1]}, ${s2} = ${AR[s2]}]`,
        ...choices(CU.g, m2, [(m1 / AR[s1]) * AR[s2], (m1 * AR[s2]) / AR[s1] * (z2 / z1), m1, m2 * 2]),
        explanation: `Faradays passed = moles × charge = ${m(`\\frac{${m1}}{${AR[s1]}} \\times ${z1} = ${sci(faradays)}`)}.\nMoles of ${n2} = ${m(`\\frac{${sci(faradays)}}{${z2}} = ${sci(faradays / z2)}`)}; mass = ${m(`${sci(faradays / z2)} \\times ${AR[s2]} = ${sci(m2)}`)} g.`,
      };
    },
  },
  {
    key: 'jamb-chem/gas-at-electrode',
    topic: [ELEC, "Faraday's laws"],
    difficulty: 3,
    make: (r) => {
      const [gas, name, e] = r.pick([
        ['O2', 'oxygen', 4],
        ['H2', 'hydrogen', 2],
        ['Cl2', 'chlorine', 2],
      ] as const);
      const n = r.pick([0.05, 0.1, 0.125, 0.25, 0.5]);
      const Q = n * e * F_CONST;
      if (r.chance(0.5)) {
        return {
          stem: `What quantity of electricity will liberate ${qty(n, CU.mol)} of ${name} molecules during electrolysis? [F = 96,500 C]`,
          ...choices(CU.C, Q, [n * F_CONST, n * (e / 2) * F_CONST, n * e * 2 * F_CONST, F_CONST / n]),
          explanation: `${name === 'oxygen' ? m('4\\text{OH}^- \\rightarrow 2\\text{H}_2\\text{O} + \\text{O}_2 + 4e^-') : name === 'hydrogen' ? m('2\\text{H}^+ + 2e^- \\rightarrow \\text{H}_2') : m('2\\text{Cl}^- \\rightarrow \\text{Cl}_2 + 2e^-')}: each ${f(gas)} needs ${e} electrons.\nQ = ${m(`${num(n)} \\times ${e} \\times 96{,}500 = ${sci(Q)}`)} C.`,
        };
      }
      const V = n * 22.4;
      return {
        stem: `During electrolysis, ${qty(Q, CU.C)} of electricity is passed. What volume of ${name} is given off at s.t.p.? [F = 96,500 C; molar volume = ${m('22.4\\,\\text{dm}^3')}]`,
        ...choices(CU.dm3, V, [(Q / F_CONST) * 22.4, V * 2, V / 2, (Q / F_CONST / (e * 2)) * 22.4]),
        explanation: `Faradays = ${m(`\\frac{${sci(Q)}}{96{,}500} = ${sci(Q / F_CONST)}`)}. Each ${f(gas)} needs ${e} electrons, so moles of ${name} = ${sci(n)}.\nVolume = ${m(`${sci(n)} \\times 22.4 = ${sci(V)}`)} dm³.`,
        difficulty: 4,
      };
    },
  },

  // ── Solubility and water ───────────────────────────────
  {
    key: 'jamb-chem/solubility',
    topic: [SOL, 'Solubility and saturated solutions'],
    difficulty: 3,
    make: (r) => {
      if (r.chance(0.5)) {
        const [name, formula] = r.pick([
          ['sodium chloride', 'NaCl'],
          ['potassium trioxonitrate(V)', 'KNO3'],
          ['copper(II) tetraoxosulphate(VI)', 'CuSO4'],
          ['sodium trioxonitrate(V)', 'NaNO3'],
        ] as const);
        const M = mr(formula);
        const s = r.pick([0.5, 1, 2, 2.5, 4]);
        const V = r.pick([100, 200, 250, 500]);
        const mass = (s * M * V) / 1000;
        return {
          stem: `At ${m('25^\\circ\\text{C}')}, ${qty(mass, CU.g)} of ${name} dissolves in ${m(`${V}\\,\\text{cm}^3`)} to give a saturated solution. What is its solubility in ${m('\\text{mol dm}^{-3}')}? [${Object.keys(atoms(formula)).map((e) => `${e} = ${AR[e]}`).join(', ')}]`,
          ...choices(CU.M, s, [mass / M, (mass * 1000) / V, (s * V) / 1000, s * 2]),
          explanation: `Moles = ${m(`\\frac{${sci(mass)}}{${M}} = ${sci(mass / M)}`)}, in ${num(V / 1000)} dm³.\nSolubility = ${m(`\\frac{${sci(mass / M)}}{${num(V / 1000)}} = ${num(s)}`)} mol dm⁻³.`,
        };
      }
      const s1 = r.pick([60, 80, 100, 110, 120]);
      const s2 = r.pick([20, 30, 35, 40, 50]);
      const w = r.pick([50, 100, 200, 250]);
      const out = ((s1 - s2) * w) / 100;
      const [T1, T2] = [r.pick([60, 70, 80]), r.pick([20, 25, 30])];
      return {
        stem: `The solubility of a salt is ${s1} g per 100 g of water at ${m(`${T1}^\\circ\\text{C}`)} and ${s2} g per 100 g of water at ${m(`${T2}^\\circ\\text{C}`)}. What mass of crystals forms when a saturated solution in ${qty(w, CU.g)} of water is cooled from ${m(`${T1}^\\circ\\text{C}`)} to ${m(`${T2}^\\circ\\text{C}`)}?`,
        ...choices(CU.g, out, [s1 - s2, (s1 * w) / 100, (s2 * w) / 100, out * 2], 4),
        explanation: `In ${w} g of water: ${m(`\\frac{${s1} \\times ${w}}{100} = ${sci((s1 * w) / 100)}`)} g dissolves at ${T1} °C, but only ${m(`\\frac{${s2} \\times ${w}}{100} = ${sci((s2 * w) / 100)}`)} g at ${T2} °C.\nThe difference crystallises: ${m(`${sci((s1 * w) / 100, 4)} - ${sci((s2 * w) / 100, 4)} = ${sci(out, 4)}`)} g.`,
      };
    },
  },
  {
    key: 'jamb-chem/water-of-crystallization',
    topic: [WATER, 'Water of crystallization'],
    difficulty: 3,
    make: (r) => {
      const [name, formula, x, anh] = r.pick(HYDRATES);
      if (r.chance(0.5)) {
        const p = (100 * x * 18) / mr(formula);
        return {
          stem: `What is the percentage by mass of water of crystallization in ${name}, ${f(formula)}? [${Object.keys(atoms(formula)).map((e) => `${e} = ${AR[e]}`).join(', ')}]`,
          ...choices(CU.pct, p, [(100 * 18) / mr(formula), (100 * x * 18) / mr(anh), 100 - p, x * 10]),
          explanation: `${m(`M = ${mr(anh)} + ${x} \\times 18 = ${mr(formula)}`)}.\nWater: ${m(`\\frac{${x} \\times 18}{${mr(formula)}} \\times 100 = ${sci(p)}\\%`)}.`,
        };
      }
      const n = r.pick([0.01, 0.02, 0.05, 0.1]);
      const before = n * mr(formula);
      const after = n * mr(anh);
      return {
        stem: `${qty(before, CU.g)} of hydrated ${m(`${fx(anh)} \\cdot x\\text{H}_{2}\\text{O}`)} is heated until all its water is driven off, leaving ${qty(after, CU.g)} of the anhydrous salt. What is x? [${Object.keys(atoms(formula)).map((e) => `${e} = ${AR[e]}`).join(', ')}]`,
        answer: String(x),
        wrong: [x + 1, x - 1, x * 2, Math.round((before - after) / 18)].filter((w) => w !== x && w > 0).map(String),
        explanation: `Water lost = ${sci(before - after)} g = ${m(`\\frac{${sci(before - after)}}{18} = ${sci((before - after) / 18)}`)} mol.\nAnhydrous salt = ${m(`\\frac{${sci(after)}}{${mr(anh)}} = ${sci(n)}`)} mol.\n${m(`x = \\frac{${sci((before - after) / 18)}}{${sci(n)}} = ${x}`)}.`,
        difficulty: 4,
      };
    },
  },
];
