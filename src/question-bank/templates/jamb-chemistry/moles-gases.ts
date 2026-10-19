import { m, num, type Template } from '../engine.js';
import { choices, qty, sci, sig } from '../jamb-physics/kit.js';
import { AR, atoms, COMPOUNDS, CU, f, fx, MOLAR_VOL, mr, mrWorking, NA } from './kit.js';

const COMB = 'Chemical Combination';
const GAS = 'Kinetic Theory of Matter and Gas Laws';

type Side = [coef: number, formula: string][];
type Reaction = { lhs: Side; rhs: Side };

const REACTIONS: Reaction[] = [
  { lhs: [[1, 'CaCO3']], rhs: [[1, 'CaO'], [1, 'CO2']] },
  { lhs: [[2, 'Mg'], [1, 'O2']], rhs: [[2, 'MgO']] },
  { lhs: [[1, 'Zn'], [2, 'HCl']], rhs: [[1, 'ZnCl2'], [1, 'H2']] },
  { lhs: [[1, 'Mg'], [2, 'HCl']], rhs: [[1, 'MgCl2'], [1, 'H2']] },
  { lhs: [[2, 'KClO3']], rhs: [[2, 'KCl'], [3, 'O2']] },
  { lhs: [[1, 'CH4'], [2, 'O2']], rhs: [[1, 'CO2'], [2, 'H2O']] },
  { lhs: [[1, 'Fe2O3'], [3, 'CO']], rhs: [[2, 'Fe'], [3, 'CO2']] },
  { lhs: [[2, 'NaHCO3']], rhs: [[1, 'Na2CO3'], [1, 'H2O'], [1, 'CO2']] },
  { lhs: [[1, 'N2'], [3, 'H2']], rhs: [[2, 'NH3']] },
  { lhs: [[1, 'CuO'], [1, 'H2']], rhs: [[1, 'Cu'], [1, 'H2O']] },
  { lhs: [[2, 'Na'], [2, 'H2O']], rhs: [[2, 'NaOH'], [1, 'H2']] },
];
const GASES = new Set(['H2', 'O2', 'CO2', 'NH3', 'N2', 'CO', 'SO2', 'CH4']);

const side = (s: Side) => s.map(([c, x]) => `${c > 1 ? c : ''}${fx(x)}`).join(' + ');
const eqTex = (r: Reaction) => m(`${side(r.lhs)} \\rightarrow ${side(r.rhs)}`);
const masses = (formulas: string[]) => `[${[...new Set(formulas.flatMap((x) => Object.keys(atoms(x))))].map((e) => `${e} = ${AR[e]}`).join(', ')}]`;

/** Empirical formulas whose percentages give clean whole-number ratios, with the molecules they come from. */
const EMPIRICAL: [empirical: string, molecular: string, name: string][] = [
  ['CH2O', 'C6H12O6', 'glucose'],
  ['CH2O', 'C2H4O2', 'ethanoic acid'],
  ['C2H6O', 'C2H6O', 'ethanol'],
  ['CH4O', 'CH4O', 'methanol'],
  ['C3H8O', 'C3H8O', 'propanol'],
  ['CH2', 'C4H8', 'butene'],
  ['CH3', 'C2H6', 'ethane'],
  ['C2H5', 'C4H10', 'butane'],
  ['CH', 'C6H6', 'benzene'],
  ['C3H4', 'C6H8', 'a hydrocarbon'],
  ['C2H4O', 'C4H8O2', 'ethyl ethanoate'],
];

/** "C2H6O" with its atoms in C, H, O order. */
const pct = (formula: string, el: string) => (100 * AR[el] * (atoms(formula)[el] ?? 0)) / mr(formula);

export const molesGases: Template[] = [
  {
    key: 'jamb-chem/molar-mass',
    topic: [COMB, 'The mole concept'],
    difficulty: 1,
    variety: 20,
    make: (r) => {
      const [name, formula] = r.pick([...COMPOUNDS, ['copper(II) tetraoxosulphate(VI) pentahydrate', 'CuSO4.5H2O'] as [string, string]]);
      const M = mr(formula);
      const naive = Object.keys(atoms(formula)).reduce((s, e) => s + AR[e], 0);
      return {
        stem: `What is the relative molecular mass of ${name}, ${f(formula)}? ${masses([formula])}`,
        ...choices(CU.none, M, [naive, M + 16, M * 2, M + AR[Object.keys(atoms(formula))[0]]]),
        explanation: `Add the masses of all the atoms: ${m(mrWorking(formula))}.`,
      };
    },
  },
  {
    key: 'jamb-chem/moles-and-mass',
    topic: [COMB, 'The mole concept'],
    difficulty: 1,
    make: (r) => {
      const [name, formula] = r.pick(COMPOUNDS);
      const M = mr(formula);
      const n = r.pick([0.1, 0.2, 0.25, 0.5, 1.5, 2, 2.5, 4, 5]);
      const mass = n * M;
      if (r.chance(0.5)) {
        return {
          stem: `How many moles are in ${qty(mass, CU.g)} of ${name}, ${f(formula)}? ${masses([formula])}`,
          ...choices(CU.mol, n, [M / mass, mass * M, n * 2, n / 2]),
          explanation: `Molar mass of ${f(formula)} = ${m(mrWorking(formula))} g/mol.\n${m(`n = \\frac{\\text{mass}}{M} = \\frac{${sci(mass)}}{${num(M)}} = ${num(n)}`)} mol.`,
        };
      }
      return {
        stem: `What is the mass of ${qty(n, CU.mol)} of ${name}, ${f(formula)}? ${masses([formula])}`,
        ...choices(CU.g, mass, [M / n, M, mass * 2, mass + n]),
        explanation: `Molar mass of ${f(formula)} = ${m(mrWorking(formula))} g/mol.\n${m(`\\text{mass} = nM = ${num(n)} \\times ${num(M)} = ${sci(mass)}`)} g.`,
      };
    },
  },
  {
    key: 'jamb-chem/avogadro',
    topic: [COMB, 'The mole concept'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['element', 'molecules', 'atoms-in-molecules'] as const);
      if (kind === 'element') {
        const el = r.pick(['Mg', 'Na', 'Ca', 'C', 'Fe', 'Al', 'Cu', 'Zn']);
        const n = r.pick([0.1, 0.25, 0.5, 2, 0.2]);
        const mass = n * AR[el];
        return {
          stem: `How many atoms are in ${qty(mass, CU.g)} of ${el === 'C' ? 'carbon' : el === 'Mg' ? 'magnesium' : el === 'Na' ? 'sodium' : el === 'Ca' ? 'calcium' : el === 'Fe' ? 'iron' : el === 'Al' ? 'aluminium' : el === 'Cu' ? 'copper' : 'zinc'}? [${el} = ${AR[el]}; Avogadro's number = ${m('6.02 \\times 10^{23}')}]`,
          ...choices(CU.none, n * NA, [mass * NA, NA / n, NA, n * NA * 2]),
          explanation: `Moles = ${m(`\\frac{${sci(mass)}}{${AR[el]}} = ${num(n)}`)}.\nAtoms = ${m(`${num(n)} \\times 6.02 \\times 10^{23} = ${sci(n * NA)}`)}.`,
        };
      }
      const [name, formula] = r.pick(COMPOUNDS.filter(([, x]) => !x.includes('(')));
      const n = r.pick([0.1, 0.2, 0.5, 2]);
      const perMolecule = Object.values(atoms(formula)).reduce((s, c) => s + c, 0);
      if (kind === 'molecules') {
        const mass = n * mr(formula);
        return {
          stem: `How many molecules are in ${qty(mass, CU.g)} of ${name}, ${f(formula)}? ${masses([formula])} [Avogadro's number = ${m('6.02 \\times 10^{23}')}]`,
          ...choices(CU.none, n * NA, [mass * NA, n * NA * perMolecule, NA / n, NA]),
          explanation: `Moles = ${m(`\\frac{${sci(mass)}}{${mr(formula)}} = ${num(n)}`)}.\nMolecules = ${m(`${num(n)} \\times 6.02 \\times 10^{23} = ${sci(n * NA)}`)}.`,
        };
      }
      if (perMolecule < 2) return null;
      return {
        stem: `How many atoms altogether are in ${qty(n, CU.mol)} of ${name}, ${f(formula)}? [Avogadro's number = ${m('6.02 \\times 10^{23}')}]`,
        ...choices(CU.none, n * NA * perMolecule, [n * NA, NA * perMolecule, n * perMolecule, n * NA * (perMolecule - 1)]),
        explanation: `Each ${f(formula)} contains ${perMolecule} atoms.\nAtoms = ${m(`${num(n)} \\times ${perMolecule} \\times 6.02 \\times 10^{23} = ${sci(n * NA * perMolecule)}`)}.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-chem/percent-composition',
    topic: [COMB, 'Formulae and equations'],
    difficulty: 2,
    make: (r) => {
      const [name, formula] = r.pick([...COMPOUNDS, ['copper(II) tetraoxosulphate(VI) pentahydrate', 'CuSO4.5H2O'] as [string, string]]);
      const els = Object.keys(atoms(formula));
      const el = r.pick(els);
      const count = atoms(formula)[el];
      const M = mr(formula);
      const p = (100 * AR[el] * count) / M;
      if (p > 99) return null;
      return {
        stem: `What is the percentage by mass of ${el} in ${name}, ${f(formula)}? ${masses([formula])}`,
        ...choices(CU.pct, p, [(100 * AR[el]) / M, (100 * count) / Object.values(atoms(formula)).reduce((s, c) => s + c, 0), 100 - p, (100 * AR[el] * count) / (M + 18)]),
        explanation: `${m(`M = ${mrWorking(formula)}`)}.\n${m(`\\%\\,\\text{${el}} = \\frac{${count > 1 ? `${count} \\times ` : ''}${AR[el]}}{${M}} \\times 100 = ${sci(p)}\\%`)}.`,
      };
    },
  },
  {
    key: 'jamb-chem/empirical-formula',
    topic: [COMB, 'Formulae and equations'],
    difficulty: 3,
    make: (r) => {
      const [emp, mol, name] = r.pick(EMPIRICAL);
      const els = ['C', 'H', 'O'].filter((e) => atoms(emp)[e]);
      const ps = els.map((e) => Number(pct(emp, e).toFixed(1)));
      const given = els.map((e, i) => `${ps[i]}% ${e === 'C' ? 'carbon' : e === 'H' ? 'hydrogen' : 'oxygen'}`).join(', ');
      const others = r.shuffle(EMPIRICAL.map(([e]) => e).filter((e) => e !== emp));
      const working = `Divide each percentage by the atomic mass: ${els.map((e, i) => m(`\\text{${e}}: \\frac{${ps[i]}}{${AR[e]}} = ${sig(ps[i] / AR[e], 3)}`)).join(', ')}.\nDivide by the smallest to get the whole-number ratio ${els.map((e) => `${e} ${atoms(emp)[e]}`).join(' : ')}.`;
      if (mol !== emp && r.chance(0.5)) {
        const M = mr(mol);
        const k = M / mr(emp);
        const wrongMol = [emp, `C${(atoms(emp).C ?? 0) * (k + 1)}H${(atoms(emp).H ?? 0) * (k + 1)}${atoms(emp).O ? `O${atoms(emp).O * (k + 1)}` : ''}`, `C${(atoms(emp).C ?? 0) * Math.max(1, k - 1)}H${(atoms(emp).H ?? 0) * Math.max(1, k - 1)}${atoms(emp).O ? `O${atoms(emp).O * Math.max(1, k - 1)}` : ''}`, ...others.slice(0, 2)];
        return {
          stem: `A compound contains ${given} by mass. Its relative molecular mass is ${M}. What is its molecular formula? [C = 12, H = 1, O = 16]`,
          answer: f(mol),
          wrong: wrongMol.map((x) => f(x.replace(/([A-Z])1(?!\d)/g, '$1'))),
          explanation: `${working}\nEmpirical formula ${f(emp)} has mass ${mr(emp)}, and ${m(`\\frac{${M}}{${mr(emp)}} = ${k}`)}.\nMolecular formula = ${m(`(${fx(emp)})_{${k}}`)} = ${f(mol)}.`,
          difficulty: 4,
        };
      }
      return {
        stem: `A compound contains ${given} by mass. What is its empirical formula? [C = 12, H = 1, O = 16]`,
        answer: f(emp),
        wrong: [...others.slice(0, 3), mol !== emp ? mol : others[3]].map(f),
        explanation: `${working}\nEmpirical formula: ${f(emp)}.`,
      };
    },
  },
  {
    key: 'jamb-chem/reacting-masses',
    topic: [COMB, 'Stoichiometry'],
    difficulty: 3,
    make: (r) => {
      const rx = r.pick(REACTIONS);
      const [cr, R] = r.pick(rx.lhs);
      const [cp, P] = r.pick(rx.rhs);
      const nR = r.pick([0.1, 0.2, 0.25, 0.5, 1, 2]) * cr;
      const mR = nR * mr(R);
      const nP = (nR * cp) / cr;
      const gas = GASES.has(P) && r.chance(0.5);
      const lead = `${eqTex(rx)}\nFrom the equation above,`;
      const moleWork = `Moles of ${f(R)} = ${m(`\\frac{${sci(mR)}}{${mr(R)}} = ${num(nR)}`)}.\nThe equation says ${cr} mol of ${f(R)} gives ${cp} mol of ${f(P)}, so moles of ${f(P)} = ${m(`${num(nR)} \\times \\frac{${cp}}{${cr}} = ${sci(nP)}`)}.`;
      if (gas) {
        const V = nP * MOLAR_VOL;
        return {
          stem: `${lead} what volume of ${f(P)} at s.t.p. is produced from ${qty(mR, CU.g)} of ${f(R)}? ${masses([R])} [Molar volume at s.t.p. = ${qty(22.4, CU.dm3)}]`,
          ...choices(CU.dm3, V, [nR * MOLAR_VOL, (nR * cr * MOLAR_VOL) / cp, MOLAR_VOL, V / 2, V * 2]),
          explanation: `${moleWork}\nVolume = ${m(`${sci(nP)} \\times 22.4 = ${sci(V)}`)} dm³.`,
        };
      }
      const mP = nP * mr(P);
      return {
        stem: `${lead} what mass of ${f(P)} is formed from ${qty(mR, CU.g)} of ${f(R)}? ${masses([R, P])}`,
        ...choices(CU.g, mP, [nR * mr(P), (nR * cr * mr(P)) / cp, mR, mP * 2]),
        explanation: `${moleWork}\nMass = ${m(`${sci(nP)} \\times ${mr(P)} = ${sci(mP)}`)} g.`,
      };
    },
  },
  {
    key: 'jamb-chem/gas-volumes',
    topic: [COMB, 'Laws of chemical combination'],
    difficulty: 3,
    make: (r) => {
      const kind = r.pick(['water', 'co', 'ammonia'] as const);
      if (kind === 'water') {
        // 2H2 + O2 → 2H2O (liquid at room temperature)
        const H = r.pick([20, 30, 40, 50, 60, 80, 100]);
        const O = r.pick([20, 30, 40, 50, 60, 75]);
        const leftO = O - H / 2;
        const leftH = H - 2 * O;
        const left = leftO > 0 ? `${num(leftO)} ${m('\\text{cm}^3')} of oxygen` : leftH > 0 ? `${num(leftH)} ${m('\\text{cm}^3')} of hydrogen` : null;
        if (!left || !Number.isInteger(leftO * 2)) return null;
        const wrong = [`${num(Math.abs(O - H))} ${m('\\text{cm}^3')} of oxygen`, `${num(Math.abs(H - O))} ${m('\\text{cm}^3')} of hydrogen`, `${num(H / 2)} ${m('\\text{cm}^3')} of oxygen`, `${num(Math.abs(leftO) + Math.abs(leftH))} ${m('\\text{cm}^3')} of steam`];
        return {
          stem: `${m(`2${fx('H2')} + ${fx('O2')} \\rightarrow 2${fx('H2O')}`)}\n${m(`${H}\\,\\text{cm}^3`)} of hydrogen is exploded with ${m(`${O}\\,\\text{cm}^3`)} of oxygen and cooled to room temperature. What gas is left, and how much?`,
          answer: left,
          wrong,
          explanation: `By Gay-Lussac's law, volumes react in the ratio of the coefficients: 2 volumes of hydrogen use 1 volume of oxygen.\n${leftO > 0 ? `${H} cm³ of hydrogen uses ${num(H / 2)} cm³ of oxygen, leaving ${num(leftO)} cm³ of oxygen.` : `${O} cm³ of oxygen uses ${2 * O} cm³ of hydrogen, leaving ${num(leftH)} cm³ of hydrogen.`} The water is liquid, so it takes up no gas volume.`,
        };
      }
      if (kind === 'co') {
        const CO = r.pick([20, 40, 50, 60, 100]);
        const O = r.pick([20, 30, 40, 50, 60]);
        if (O < CO / 2) return null;
        const total = CO + (O - CO / 2);
        return {
          stem: `${m(`2${fx('CO')} + ${fx('O2')} \\rightarrow 2${fx('CO2')}`)}\n${m(`${CO}\\,\\text{cm}^3`)} of carbon(II) oxide is burnt in ${m(`${O}\\,\\text{cm}^3`)} of oxygen. What is the total volume of gas at the end, at the same temperature and pressure?`,
          ...choices(CU.cm3, total, [CO + O, CO, O - CO / 2, CO / 2 + O / 2]),
          explanation: `${CO} cm³ of CO uses ${num(CO / 2)} cm³ of oxygen and makes ${CO} cm³ of ${f('CO2')}.\nOxygen left = ${O} − ${num(CO / 2)} = ${num(O - CO / 2)} cm³.\nTotal = ${CO} + ${num(O - CO / 2)} = ${num(total)} cm³.`,
        };
      }
      const N = r.pick([10, 20, 25, 30, 50]);
      return {
        stem: `${m(`${fx('N2')} + 3${fx('H2')} \\rightleftharpoons 2${fx('NH3')}`)}\nWhat volume of hydrogen is needed to react completely with ${m(`${N}\\,\\text{cm}^3`)} of nitrogen, and what volume of ammonia forms?`,
        answer: `${3 * N} ${m('\\text{cm}^3')} of hydrogen; ${2 * N} ${m('\\text{cm}^3')} of ammonia`,
        wrong: [
          `${N} ${m('\\text{cm}^3')} of hydrogen; ${2 * N} ${m('\\text{cm}^3')} of ammonia`,
          `${3 * N} ${m('\\text{cm}^3')} of hydrogen; ${4 * N} ${m('\\text{cm}^3')} of ammonia`,
          `${3 * N} ${m('\\text{cm}^3')} of hydrogen; ${N} ${m('\\text{cm}^3')} of ammonia`,
        ],
        explanation: `Volumes of gases react in the ratio of the coefficients, 1 : 3 : 2.\nSo ${N} cm³ of nitrogen needs ${3 * N} cm³ of hydrogen and makes ${2 * N} cm³ of ammonia.`,
        difficulty: 2,
      };
    },
  },

  // ── Gases ──────────────────────────────────────────────
  {
    key: 'jamb-chem/molar-volume',
    topic: [GAS, 'Molar volume and vapour density'],
    difficulty: 2,
    make: (r) => {
      const gas = r.pick(['O2', 'CO2', 'NH3', 'SO2', 'CH4', 'N2', 'H2', 'Cl2']);
      const names: Record<string, string> = { O2: 'oxygen', CO2: 'carbon(IV) oxide', NH3: 'ammonia', SO2: 'sulphur(IV) oxide', CH4: 'methane', N2: 'nitrogen', H2: 'hydrogen', Cl2: 'chlorine' };
      const M = mr(gas);
      const n = r.pick([0.05, 0.1, 0.2, 0.25, 0.5, 2]);
      const V = n * MOLAR_VOL;
      const kind = r.pick(['volume', 'mass', 'mr', 'vd'] as const);
      const gmv = `[Molar volume at s.t.p. = ${qty(22.4, CU.dm3)}]`;
      if (kind === 'volume') {
        return {
          stem: `What volume does ${qty(n * M, CU.g)} of ${names[gas]} occupy at s.t.p.? ${masses([gas])} ${gmv}`,
          ...choices(CU.dm3, V, [(n * M) * MOLAR_VOL, MOLAR_VOL / n, M / MOLAR_VOL, V * 2]),
          explanation: `Moles = ${m(`\\frac{${sci(n * M)}}{${M}} = ${num(n)}`)}; volume = ${m(`${num(n)} \\times 22.4 = ${sci(V)}`)} dm³.`,
        };
      }
      if (kind === 'mass') {
        return {
          stem: `What is the mass of ${qty(V, CU.dm3)} of ${names[gas]} at s.t.p.? ${masses([gas])} ${gmv}`,
          ...choices(CU.g, n * M, [V * M, M / n, M, (V / M) * MOLAR_VOL]),
          explanation: `Moles = ${m(`\\frac{${sci(V)}}{22.4} = ${num(n)}`)}; mass = ${m(`${num(n)} \\times ${M} = ${sci(n * M)}`)} g.`,
        };
      }
      const cm3 = V * 1000;
      if (kind === 'mr') {
        return {
          stem: `${m(`${num(cm3)}\\,\\text{cm}^3`)} of a gas at s.t.p. has a mass of ${qty(n * M, CU.g)}. What is the relative molecular mass of the gas? ${gmv}`,
          ...choices(CU.none, M, [(n * M) / V, (n * M * 22.4) / cm3, M / 2, M * 2]),
          explanation: `Change the volume to dm³: ${m(`${num(cm3)}\\,\\text{cm}^3 = ${sci(V)}\\,\\text{dm}^3`)}, which is ${m(`\\frac{${sci(V)}}{22.4} = ${num(n)}`)} mol.\n${m(`M = \\frac{${sci(n * M)}}{${num(n)}} = ${M}`)}.`,
          difficulty: 3,
        };
      }
      return {
        stem: `${m(`${num(cm3)}\\,\\text{cm}^3`)} of a gas at s.t.p. weighs ${qty(n * M, CU.g)}. What is its vapour density? ${gmv}`,
        ...choices(CU.none, M / 2, [M, M * 2, M / 4, M + 2]),
        explanation: `Moles = ${m(`\\frac{${sci(V)}}{22.4} = ${num(n)}`)}, so ${m(`M = \\frac{${sci(n * M)}}{${num(n)}} = ${M}`)}.\nVapour density = ${m(`\\frac{M}{2} = ${sci(M / 2)}`)}.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-chem/gas-laws',
    topic: [GAS, 'Gas laws'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['boyle', 'charles', 'combined'] as const);
      if (kind === 'boyle') {
        const P1 = r.pick([1, 1.5, 2, 3, 4, 0.5]);
        const V1 = r.pick([1.5, 2, 3, 4, 6, 10, 12]);
        const P2 = P1 * r.pick([2, 4, 0.5, 3, 1.5]);
        const V2 = (P1 * V1) / P2;
        return {
          stem: `A gas occupies ${qty(V1, CU.dm3)} at ${qty(P1, CU.atm)}. What volume will it occupy at ${qty(P2, CU.atm)} if the temperature stays the same?`,
          ...choices(CU.dm3, V2, [(P2 * V1) / P1, V1, V1 + P2 - P1, V2 * 2]),
          explanation: `Boyle's law: ${m('P_1V_1 = P_2V_2')}, so ${m(`V_2 = \\frac{${num(P1)} \\times ${num(V1)}}{${num(P2)}} = ${sci(V2)}`)} dm³.`,
        };
      }
      const c1 = r.pick([0, 27, 47, 77, 127, -73]);
      const c2 = r.pick([15, 27, 87, 127, 177, 227, 327].filter((x) => x !== c1));
      const T1 = c1 + 273;
      const T2 = c2 + 273;
      if (kind === 'charles') {
        const V1 = r.pick([29.5, 50, 100, 150, 200, 273, 300]);
        const V2 = (V1 * T2) / T1;
        return {
          stem: `A gas has a volume of ${m(`${num(V1)}\\,\\text{cm}^3`)} at ${m(`${c1}^\\circ\\text{C}`)}. What will its volume be at ${m(`${c2}^\\circ\\text{C}`)} if the pressure stays the same?`,
          ...choices(CU.cm3, V2, c1 ? [(V1 * c2) / c1, (V1 * T1) / T2, V1 + c2 - c1] : [V1 * c2, (V1 * T1) / T2, V1 + c2]),
          explanation: `Change to kelvin: ${T1} K and ${T2} K.\nCharles's law: ${m(`V_2 = ${num(V1)} \\times \\frac{${T2}}{${T1}} = ${sci(V2)}`)} cm³.`,
        };
      }
      const P1 = r.pick([1, 2, 3]);
      const V1 = r.pick([100, 150, 200, 300]);
      const V2 = r.pick([50, 75, 100, 150, 250].filter((x) => x !== V1));
      const P2 = (P1 * V1 * T2) / (T1 * V2);
      return {
        stem: `A gas occupies ${m(`${V1}\\,\\text{cm}^3`)} at ${qty(P1, CU.atm)} and ${m(`${c1}^\\circ\\text{C}`)}. What is its pressure when its volume is ${m(`${V2}\\,\\text{cm}^3`)} at ${m(`${c2}^\\circ\\text{C}`)}?`,
        ...choices(CU.atm, P2, [(P1 * V1) / V2, (P1 * V2 * T2) / (T1 * V1), (P1 * V1 * T1) / (T2 * V2), P2 * 2]),
        explanation: `${m('\\frac{P_1V_1}{T_1} = \\frac{P_2V_2}{T_2}')} with temperatures in kelvin (${T1} K, ${T2} K).\n${m(`P_2 = \\frac{${P1} \\times ${V1} \\times ${T2}}{${T1} \\times ${V2}} = ${sci(P2)}`)} atm.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-chem/graham',
    topic: [GAS, "Graham's law of diffusion"],
    difficulty: 3,
    make: (r) => {
      const [[a, na], [b, nb]] = r.pick([
        [
          ['H2', 'hydrogen'],
          ['O2', 'oxygen'],
        ],
        [
          ['He', 'helium'],
          ['CH4', 'methane'],
        ],
        [
          ['CH4', 'methane'],
          ['SO2', 'sulphur(IV) oxide'],
        ],
        [
          ['He', 'helium'],
          ['SO2', 'sulphur(IV) oxide'],
        ],
        [
          ['O2', 'oxygen'],
          ['SO2', 'sulphur(IV) oxide'],
        ],
        [
          ['O2', 'oxygen'],
          ['Cl2', 'chlorine'],
        ],
      ] as [string, string][][]);
      const Ma = mr(a);
      const Mb = mr(b);
      const ratio = Math.sqrt(Mb / Ma);
      if (r.chance(0.5)) {
        return {
          stem: `How many times faster does ${na} diffuse than ${nb} under the same conditions? ${masses([a, b])}`,
          ...choices(CU.none, ratio, [Mb / Ma, Math.sqrt(Ma / Mb), Mb / Ma / 2, ratio * 2]),
          explanation: `Graham's law: ${m('\\frac{r_1}{r_2} = \\sqrt{\\frac{M_2}{M_1}}')}.\n${m(`\\frac{r_{${fx(a)}}}{r_{${fx(b)}}} = \\sqrt{\\frac{${Mb}}{${Ma}}} = ${sci(ratio)}`)}.`,
        };
      }
      const Va = r.pick([20, 30, 40, 50]);
      const ta = r.pick([5, 7, 10, 12, 20]);
      const k = r.pick([1, 2]);
      const tb = k * ta * ratio;
      return {
        stem: `${m(`${Va}\\,\\text{cm}^3`)} of ${na} diffuses through a porous pot in ${qty(ta, CU.s)}. How long will ${m(`${k * Va}\\,\\text{cm}^3`)} of ${nb} take to diffuse through the same pot? ${masses([a, b])}`,
        ...choices(CU.s, tb, [(k * ta) / ratio, k * ta * (Mb / Ma), ta * ratio, tb * 2]),
        explanation: `The heavier gas is slower: ${m(`\\frac{t_{${fx(b)}}}{t_{${fx(a)}}} = \\sqrt{\\frac{${Mb}}{${Ma}}} = ${sci(ratio)}`)} for equal volumes.\n${k > 1 ? `Twice the volume takes twice as long: ` : ''}${m(`t = ${k > 1 ? `${k} \\times ` : ''}${ta} \\times ${sci(ratio)} = ${sci(tb)}`)} s.`,
        difficulty: 4,
      };
    },
  },
];
