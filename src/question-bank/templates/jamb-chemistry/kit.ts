import { m } from '../engine.js';

/** Relative atomic masses as JAMB gives them (Cl = 35.5, everything else whole). */
export const AR: Record<string, number> = {
  H: 1,
  He: 4,
  Li: 7,
  C: 12,
  N: 14,
  O: 16,
  F: 19,
  Ne: 20,
  Na: 23,
  Mg: 24,
  Al: 27,
  Si: 28,
  P: 31,
  S: 32,
  Cl: 35.5,
  K: 39,
  Ar: 40,
  Ca: 40,
  Cr: 52,
  Mn: 55,
  Fe: 56,
  Cu: 64,
  Zn: 65,
  Br: 80,
  Ag: 108,
  I: 127,
  Ba: 137,
  Pb: 207,
};

/** Atoms in a formula: "Ca(OH)2" → { Ca: 1, O: 2, H: 2 }; "CuSO4.5H2O" counts the water too. */
export function atoms(formula: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of formula.split('^')[0].split('.')) {
    const [, coef, rest] = part.match(/^(\d*)(.*)$/)!;
    const k = Number(coef || 1);
    let i = 0;
    const group = (): Record<string, number> => {
      const g: Record<string, number> = {};
      while (i < rest.length && rest[i] !== ')') {
        let inner: Record<string, number>;
        if (rest[i] === '(') {
          i++;
          inner = group();
          i++; // ')'
        } else {
          const el = rest.slice(i).match(/^[A-Z][a-z]?/)![0];
          if (!(el in AR)) throw new Error(`Unknown element ${el} in ${formula}`);
          i += el.length;
          inner = { [el]: 1 };
        }
        const n = rest.slice(i).match(/^\d+/)?.[0] ?? '';
        i += n.length;
        for (const [e, c] of Object.entries(inner)) g[e] = (g[e] ?? 0) + c * Number(n || 1);
      }
      return g;
    };
    for (const [e, c] of Object.entries(group())) out[e] = (out[e] ?? 0) + c * k;
  }
  return out;
}

/** Relative molecular (formula) mass. */
export const mr = (formula: string) => Object.entries(atoms(formula)).reduce((s, [e, c]) => s + AR[e] * c, 0);

/** The working for a molar mass: "2(1) + 32 + 4(16) = 98", as LaTeX. */
export function mrWorking(formula: string) {
  const parts = Object.entries(atoms(formula)).map(([e, c]) => (c === 1 ? `${AR[e]}` : `${c}(${AR[e]})`));
  return `${parts.join(' + ')} = ${mr(formula)}`;
}

/**
 * A formula as LaTeX: "H2SO4" → \text{H}_{2}\text{SO}_{4}; "CuSO4.5H2O" gets a raised dot;
 * a charge goes after "^": "SO4^2-".
 */
export function fx(formula: string): string {
  const [body, charge] = formula.split('^');
  const pieces = body.split('.').map((part) => {
    const [, coef, rest] = part.match(/^(\d*)(.*)$/)!;
    const tex = rest.replace(/([A-Za-z()\]\[]+)|(\d+)/g, (_, letters, digits) => (letters ? `\\text{${letters}}` : `_{${digits}}`));
    return `${coef}${tex}`;
  });
  return pieces.join(' \\cdot ') + (charge ? `^{${charge}}` : '');
}

/** A formula wrapped as maths for prose: "$\text{H}_{2}\text{O}$". */
export const f = (formula: string) => m(fx(formula));

/** Chemistry units, as LaTeX. */
export const CU = {
  g: '\\text{g}',
  mol: '\\text{mol}',
  dm3: '\\text{dm}^{3}',
  cm3: '\\text{cm}^{3}',
  M: '\\text{mol dm}^{-3}',
  gdm3: '\\text{g dm}^{-3}',
  kJmol: '\\text{kJ mol}^{-1}',
  kJ: '\\text{kJ}',
  atm: '\\text{atm}',
  C: '\\text{C}',
  s: '\\text{s}',
  A: '\\text{A}',
  K: '\\text{K}',
  degC: '^\\circ\\text{C}',
  pct: '\\%',
  none: '',
};

export const NA = 6.02e23;
export const F_CONST = 96_500;
export const MOLAR_VOL = 22.4;

/** Common compounds with the names JAMB uses. */
export const COMPOUNDS: [name: string, formula: string][] = [
  ['water', 'H2O'],
  ['carbon(IV) oxide', 'CO2'],
  ['ammonia', 'NH3'],
  ['methane', 'CH4'],
  ['sodium chloride', 'NaCl'],
  ['sodium hydroxide', 'NaOH'],
  ['calcium trioxocarbonate(IV)', 'CaCO3'],
  ['tetraoxosulphate(VI) acid', 'H2SO4'],
  ['trioxonitrate(V) acid', 'HNO3'],
  ['sodium trioxonitrate(V)', 'NaNO3'],
  ['copper(II) tetraoxosulphate(VI)', 'CuSO4'],
  ['potassium tetraoxomanganate(VII)', 'KMnO4'],
  ['calcium hydroxide', 'Ca(OH)2'],
  ['sodium trioxocarbonate(IV)', 'Na2CO3'],
  ['glucose', 'C6H12O6'],
  ['ethanol', 'C2H5OH'],
  ['aluminium oxide', 'Al2O3'],
  ['magnesium oxide', 'MgO'],
  ['iron(III) oxide', 'Fe2O3'],
  ['potassium trioxochlorate(V)', 'KClO3'],
  ['ammonium chloride', 'NH4Cl'],
  ['calcium chloride', 'CaCl2'],
  ['sulphur(IV) oxide', 'SO2'],
  ['zinc tetraoxosulphate(VI)', 'ZnSO4'],
  ['lead(II) trioxonitrate(V)', 'Pb(NO3)2'],
  ['ethanoic acid', 'CH3COOH'],
];

/** Names of the first ten members of each homologous series' stem. */
export const STEMS = ['meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec'];
