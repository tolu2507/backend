import { m, num, type Template } from '../engine.js';
import { choices, qty, sci } from '../jamb-physics/kit.js';
import { AR, atoms, CU, f, fx, mr, STEMS } from './kit.js';

const ENERGY = 'Energy Changes';
const RATES = 'Rates of Chemical Reaction';
const EQM = 'Chemical Equilibria';
const ORG = 'Organic Compounds';
const NUC = 'Nuclear Chemistry';

type Side = [coef: number, formula: string][];
const side = (s: Side) => s.map(([c, x]) => `${c > 1 ? c : ''}${fx(x)}`).join(' + ');

/** Standard heats of formation (kJ/mol), rounded the way textbooks give them. Elements are zero. */
const HF: Record<string, number> = { CH4: -75, CO2: -394, H2O: -286, C2H4: 52, C2H6: -85, CaCO3: -1207, CaO: -635, CO: -111, C2H5OH: -278, NH3: -46, SO2: -297, SO3: -396 };
const HESS: { lhs: Side; rhs: Side }[] = [
  { lhs: [[1, 'C2H4'], [1, 'H2']], rhs: [[1, 'C2H6']] },
  { lhs: [[1, 'CH4'], [2, 'O2']], rhs: [[1, 'CO2'], [2, 'H2O']] },
  { lhs: [[1, 'CaCO3']], rhs: [[1, 'CaO'], [1, 'CO2']] },
  { lhs: [[2, 'CO'], [1, 'O2']], rhs: [[2, 'CO2']] },
  { lhs: [[1, 'C2H5OH'], [3, 'O2']], rhs: [[2, 'CO2'], [3, 'H2O']] },
  { lhs: [[2, 'SO2'], [1, 'O2']], rhs: [[2, 'SO3']] },
];
const hf = (x: string, shift: number) => (x in HF ? HF[x] + (HF[x] === 0 ? 0 : shift) : 0);

/** Heats of combustion (kJ/mol). */
const COMBUSTION: [name: string, formula: string, dH: number][] = [
  ['methane', 'CH4', -890],
  ['ethanol', 'C2H5OH', -1370],
  ['carbon', 'C', -394],
  ['hydrogen', 'H2', -286],
  ['ethane', 'C2H6', -1560],
  ['propane', 'C3H8', -2220],
];

type Eqm = { tex: string; dH: '+' | '-'; gasL: number; gasR: number };
const EQUILIBRIA: Eqm[] = [
  { tex: `${fx('N2')}(g) + 3${fx('H2')}(g) \\rightleftharpoons 2${fx('NH3')}(g)`, dH: '-', gasL: 4, gasR: 2 },
  { tex: `2${fx('SO2')}(g) + ${fx('O2')}(g) \\rightleftharpoons 2${fx('SO3')}(g)`, dH: '-', gasL: 3, gasR: 2 },
  { tex: `${fx('N2O4')}(g) \\rightleftharpoons 2${fx('NO2')}(g)`, dH: '+', gasL: 1, gasR: 2 },
  { tex: `${fx('H2')}(g) + ${fx('I2')}(g) \\rightleftharpoons 2\\text{HI}(g)`, dH: '-', gasL: 2, gasR: 2 },
  { tex: `${fx('CaCO3')}(s) \\rightleftharpoons \\text{CaO}(s) + ${fx('CO2')}(g)`, dH: '+', gasL: 0, gasR: 1 },
  { tex: `${fx('N2')}(g) + ${fx('O2')}(g) \\rightleftharpoons 2\\text{NO}(g)`, dH: '+', gasL: 2, gasR: 2 },
];
const SHIFT = { right: 'The equilibrium shifts to the right', left: 'The equilibrium shifts to the left', none: 'The position of equilibrium does not change', stops: 'The forward reaction stops' };

const SERIES = {
  alkane: { formula: (n: number) => `C${n}H${2 * n + 2}`, general: 'C_nH_{2n+2}', suffix: 'ane', min: 1 },
  alkene: { formula: (n: number) => `C${n}H${2 * n}`, general: 'C_nH_{2n}', suffix: 'ene', min: 2 },
  alkyne: { formula: (n: number) => `C${n}H${2 * n - 2}`, general: 'C_nH_{2n-2}', suffix: 'yne', min: 2 },
  alkanol: { formula: (n: number) => `C${n}H${2 * n + 1}OH`, general: 'C_nH_{2n+1}OH', suffix: 'anol', min: 1 },
};
const clean = (formula: string) => formula.replace(/([A-Z][a-z]?)1(?![0-9])/g, '$1');

export const energyOrganic: Template[] = [
  // ── Energy changes ─────────────────────────────────────
  {
    key: 'jamb-chem/heat-of-combustion',
    topic: [ENERGY, 'Heat of reaction'],
    difficulty: 3,
    make: (r) => {
      const [name, formula, dH] = r.pick(COMBUSTION);
      const M = mr(formula);
      const n = r.pick([0.1, 0.25, 0.5, 2, 0.2]);
      const mass = n * M;
      const heat = -dH * n;
      return {
        stem: `The heat of combustion of ${name} is ${m(`${dH}\\,\\text{kJ mol}^{-1}`)}. How much heat is given out when ${qty(mass, CU.g)} of ${name} burns completely? [${Object.keys(atoms(formula)).map((e) => `${e} = ${AR[e]}`).join(', ')}]`,
        ...choices(CU.kJ, heat, [-dH * mass, -dH / n, -dH, heat * 2]),
        explanation: `Moles of ${name} = ${m(`\\frac{${sci(mass)}}{${M}} = ${num(n)}`)}.\nHeat given out = ${m(`${num(n)} \\times ${-dH} = ${sci(heat)}`)} kJ.`,
      };
    },
  },
  {
    key: 'jamb-chem/hess',
    topic: [ENERGY, 'Heat of reaction'],
    difficulty: 3,
    make: (r) => {
      const rx = r.pick(HESS);
      const shift = r.pick([-10, -5, 0, 0, 5, 10]);
      const compounds = [...rx.lhs, ...rx.rhs].filter(([, x]) => x in HF);
      const sum = (s: Side) => s.reduce((t, [c, x]) => t + c * hf(x, shift), 0);
      const dH = sum(rx.rhs) - sum(rx.lhs);
      const given = compounds.map(([, x]) => `${f(x)}: ${m(`${hf(x, shift)}\\,\\text{kJ mol}^{-1}`)}`);
      return {
        stem: `${m(`${side(rx.lhs)} \\rightarrow ${side(rx.rhs)}`)}\nUse the heats of formation below to find ${m('\\Delta H')} for this reaction.\n${[...new Set(given)].join('; ')}`,
        ...choices(CU.kJmol, dH, [sum(rx.lhs) - sum(rx.rhs), rx.rhs.reduce((t, [, x]) => t + hf(x, shift), 0) - rx.lhs.reduce((t, [, x]) => t + hf(x, shift), 0), sum(rx.rhs) + sum(rx.lhs), dH * 2], 5),
        explanation: `${m('\\Delta H = \\sum \\Delta H_f(\\text{products}) - \\sum \\Delta H_f(\\text{reactants})')}; elements such as ${f('O2')} and ${f('H2')} count as zero. Multiply each by its coefficient.\nProducts: ${m(`${sum(rx.rhs)}`)}; reactants: ${m(`${sum(rx.lhs)}`)}.\n${m(`\\Delta H = ${sum(rx.rhs)} - (${sum(rx.lhs)}) = ${dH}`)} kJ mol⁻¹.`,
      };
    },
  },
  {
    key: 'jamb-chem/heat-of-solution',
    topic: [ENERGY, 'Heat of reaction'],
    difficulty: 4,
    make: (r) => {
      const [name, formula] = r.pick([
        ['ammonium chloride', 'NH4Cl'],
        ['sodium hydroxide', 'NaOH'],
        ['potassium trioxonitrate(V)', 'KNO3'],
        ['anhydrous copper(II) tetraoxosulphate(VI)', 'CuSO4'],
      ] as const);
      const M = mr(formula);
      const endo = formula === 'NH4Cl' || formula === 'KNO3';
      const n = r.pick([0.05, 0.1, 0.2, 0.25]);
      const mass = n * M;
      const V = r.pick([50, 100, 200, 250]);
      const dT = r.pick([2, 2.5, 4, 5, 6, 8, 10]);
      const q = (V * 4.2 * dT) / 1000;
      const dH = ((endo ? 1 : -1) * q) / n;
      return {
        stem: `When ${qty(mass, CU.g)} of ${name} dissolves in ${m(`${V}\\,\\text{cm}^3`)} of water, the temperature ${endo ? 'falls' : 'rises'} by ${m(`${num(dT)}^\\circ\\text{C}`)}. What is the heat of solution? [Specific heat capacity of water = ${m('4.2\\,\\text{J g}^{-1}\\,\\text{K}^{-1}')}; ${m('1\\,\\text{cm}^3')} of water = 1 g; ${Object.keys(atoms(formula)).map((e) => `${e} = ${AR[e]}`).join(', ')}]`,
        ...choices(CU.kJmol, dH, [-dH, (endo ? 1 : -1) * q, dH / 10, dH * 1000]),
        explanation: `Heat ${endo ? 'taken in' : 'given out'}: ${m(`q = mc\\Delta T = ${V} \\times 4.2 \\times ${num(dT)} = ${sci(q * 1000)}`)} J = ${sci(q)} kJ.\nMoles of solute = ${m(`\\frac{${sci(mass)}}{${M}} = ${num(n)}`)}.\n${m(`\\Delta H = ${endo ? '+' : '-'}\\frac{${sci(q)}}{${num(n)}} = ${dH > 0 ? '+' : ''}${sci(dH)}`)} kJ mol⁻¹ (${endo ? 'endothermic: the water cooled' : 'exothermic: the water warmed'}).`,
      };
    },
  },

  // ── Rates and equilibrium ──────────────────────────────
  {
    key: 'jamb-chem/rates',
    topic: [RATES, 'Factors affecting rates'],
    difficulty: 2,
    make: (r) => {
      if (r.chance(0.5)) {
        const rise = r.pick([10, 20, 30, 40]);
        const factor = 2 ** (rise / 10);
        const t = r.pick([20, 30, 40, 60, 80, 120]);
        return {
          stem: `The rate of a reaction doubles for every ${m('10^\\circ\\text{C}')} rise in temperature. At ${m('25^\\circ\\text{C}')} it takes ${qty(t, CU.s)} to finish. How long will it take at ${m(`${25 + rise}^\\circ\\text{C}`)}?`,
          ...choices(CU.s, t / factor, [t * factor, t - rise, t / 2, t / (rise / 10 + 1)]),
          explanation: `A ${rise} °C rise is ${rise / 10} lots of 10 °C, so the rate goes up ${m(`2^{${rise / 10}} = ${factor}`)} times.\nTime = ${m(`\\frac{${t}}{${factor}} = ${sci(t / factor)}`)} s.`,
        };
      }
      const V = r.pick([20, 30, 40, 45, 60, 90, 120]);
      const t = r.pick([10, 15, 20, 30, 60]);
      return {
        stem: `In a reaction, ${m(`${V}\\,\\text{cm}^3`)} of gas is collected in the first ${qty(t, CU.s)}. What is the average rate of reaction over this time?`,
        answer: m(`${sci(V / t)}\\,\\text{cm}^3\\,\\text{s}^{-1}`),
        wrong: [t / V, V * t, V / (t * 60), (V / t) * 2].map((x) => m(`${sci(x)}\\,\\text{cm}^3\\,\\text{s}^{-1}`)),
        explanation: `Average rate = ${m(`\\frac{\\text{volume}}{\\text{time}} = \\frac{${V}}{${t}} = ${sci(V / t)}`)} cm³ per second.`,
        difficulty: 1,
      };
    },
  },
  {
    key: 'jamb-chem/le-chatelier',
    topic: [EQM, "Le Chatelier's principle"],
    difficulty: 3,
    variety: 30,
    make: (r) => {
      const e = r.pick(EQUILIBRIA);
      const change = r.pick(['raise-T', 'lower-T', 'raise-P', 'lower-P', 'catalyst', 'remove-product'] as const);
      let ans: keyof typeof SHIFT;
      let why: string;
      if (change === 'catalyst') {
        ans = 'none';
        why = 'A catalyst speeds up the forward and backward reactions equally, so equilibrium is reached sooner but its position does not move.';
      } else if (change === 'remove-product') {
        ans = 'right';
        why = 'Removing product lowers its concentration, so the system makes more of it: the equilibrium shifts to the right.';
      } else if (change === 'raise-T' || change === 'lower-T') {
        const forwardEndo = e.dH === '+';
        const favourEndo = change === 'raise-T';
        ans = forwardEndo === favourEndo ? 'right' : 'left';
        why = `The forward reaction is ${forwardEndo ? 'endothermic (ΔH positive)' : 'exothermic (ΔH negative)'}. ${favourEndo ? 'Raising' : 'Lowering'} the temperature favours the ${favourEndo ? 'endothermic' : 'exothermic'} direction, so the equilibrium shifts to the ${ans}.`;
      } else {
        if (e.gasL === e.gasR) {
          ans = 'none';
          why = `There are ${e.gasL} moles of gas on each side, so pressure has no effect on the position of equilibrium.`;
        } else {
          const fewer = e.gasL < e.gasR ? 'left' : 'right';
          ans = change === 'raise-P' ? fewer : fewer === 'left' ? 'right' : 'left';
          why = `There ${e.gasL === 1 ? 'is 1 mole' : `are ${e.gasL} moles`} of gas on the left and ${e.gasR} on the right. ${change === 'raise-P' ? 'Higher pressure favours the side with fewer gas moles' : 'Lower pressure favours the side with more gas moles'}, so the equilibrium shifts to the ${ans}.`;
        }
      }
      const what = { 'raise-T': 'the temperature is raised', 'lower-T': 'the temperature is lowered', 'raise-P': 'the pressure is increased', 'lower-P': 'the pressure is reduced', catalyst: 'a catalyst is added', 'remove-product': 'product is removed as it forms' }[change];
      return {
        stem: `${m(`${e.tex} \\quad \\Delta H = ${e.dH}\\text{ve}`)}\nWhat happens to the system at equilibrium if ${what}?`,
        answer: SHIFT[ans],
        wrong: (Object.keys(SHIFT) as (keyof typeof SHIFT)[]).filter((k) => k !== ans).map((k) => SHIFT[k]),
        explanation: why,
      };
    },
  },
  {
    key: 'jamb-chem/equilibrium-constant',
    topic: [EQM, 'Equilibrium constant'],
    difficulty: 3,
    make: (r) => {
      const kind = r.pick(['HI', 'NO2', 'SO3'] as const);
      const a = r.pick([0.1, 0.2, 0.25, 0.4, 0.5]);
      const b = r.pick([0.1, 0.2, 0.4, 0.5, 0.8]);
      const c = r.pick([0.2, 0.4, 0.5, 0.8, 1, 1.2]);
      const conc = (x: string, v: number) => `${m(`[${x}] = ${num(v)}\\,\\text{mol dm}^{-3}`)}`;
      if (kind === 'HI') {
        const K = (c * c) / (a * b);
        return {
          stem: `${m(`${fx('H2')}(g) + ${fx('I2')}(g) \\rightleftharpoons 2\\text{HI}(g)`)}\nAt equilibrium, ${conc(fx('H2'), a)}, ${conc(fx('I2'), b)} and ${conc('\\text{HI}', c)}. What is the equilibrium constant, ${m('K_c')}?`,
          ...choices(CU.none, K, [c / (a * b), (a * b) / (c * c), (2 * c) / (a * b), (c * c) / (a + b)]),
          explanation: `${m('K_c = \\frac{[\\text{HI}]^2}{[\\text{H}_2][\\text{I}_2]}')} (the coefficient 2 becomes a power).\n${m(`K_c = \\frac{${num(c)}^2}{${num(a)} \\times ${num(b)}} = ${sci(K)}`)}.`,
        };
      }
      if (kind === 'NO2') {
        const K = (c * c) / a;
        return {
          stem: `${m(`${fx('N2O4')}(g) \\rightleftharpoons 2${fx('NO2')}(g)`)}\nAt equilibrium, ${conc(fx('N2O4'), a)} and ${conc(fx('NO2'), c)}. What is ${m('K_c')}?`,
          ...choices(CU.none, K, [c / a, a / (c * c), (2 * c) / a, c * c * a]),
          explanation: `${m(`K_c = \\frac{[\\text{NO}_2]^2}{[\\text{N}_2\\text{O}_4]} = \\frac{${num(c)}^2}{${num(a)}} = ${sci(K)}`)}.`,
        };
      }
      const K = (c * c) / (a * a * b);
      return {
        stem: `${m(`2${fx('SO2')}(g) + ${fx('O2')}(g) \\rightleftharpoons 2${fx('SO3')}(g)`)}\nAt equilibrium, ${conc(fx('SO2'), a)}, ${conc(fx('O2'), b)} and ${conc(fx('SO3'), c)}. What is ${m('K_c')}?`,
        ...choices(CU.none, K, [c / (a * b), (c * c) / (a * b), (a * a * b) / (c * c), (2 * c) / (2 * a * b)]),
        explanation: `${m('K_c = \\frac{[\\text{SO}_3]^2}{[\\text{SO}_2]^2[\\text{O}_2]}')}.\n${m(`K_c = \\frac{${num(c)}^2}{${num(a)}^2 \\times ${num(b)}} = ${sci(K)}`)}.`,
        difficulty: 4,
      };
    },
  },

  // ── Organic ────────────────────────────────────────────
  {
    key: 'jamb-chem/homologous-series',
    topic: [ORG, 'Hydrocarbons'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(Object.keys(SERIES) as (keyof typeof SERIES)[]);
      const s = SERIES[kind];
      const n = r.int(s.min, Math.min(8, STEMS.length));
      const formula = clean(s.formula(n));
      const name = `${STEMS[n - 1]}${s.suffix}`;
      const ask = r.pick(['formula', 'name', 'mass', 'general'] as const);
      const others = (Object.keys(SERIES) as (keyof typeof SERIES)[]).filter((k) => k !== kind);
      if (ask === 'general') {
        return {
          stem: `What is the general formula of the ${kind}s?`,
          answer: m(s.general),
          wrong: [...others.map((k) => m(SERIES[k].general)), m('C_nH_{2n}O')],
          explanation: `The ${kind}s ${kind === 'alkane' ? 'are saturated' : kind === 'alkene' ? 'have one C=C double bond' : kind === 'alkyne' ? 'have one C≡C triple bond' : 'have an –OH group'}, giving ${m(s.general)}. For example, ${name} is ${f(formula)}.`,
          difficulty: 1,
        };
      }
      if (ask === 'formula') {
        return {
          stem: `What is the molecular formula of ${name}?`,
          answer: f(formula),
          wrong: [...others.map((k) => (n >= SERIES[k].min ? clean(SERIES[k].formula(n)) : null)).filter((x): x is string => !!x), clean(s.formula(n + 1)), n > s.min ? clean(s.formula(n - 1)) : clean(s.formula(n + 2))].map(f),
          explanation: `"${STEMS[n - 1]}-" means ${n} carbon atom${n > 1 ? 's' : ''}, and ${kind}s follow ${m(s.general)}: ${f(formula)}.`,
        };
      }
      if (ask === 'name') {
        return {
          stem: `What is the IUPAC name of ${f(formula)}${kind === 'alkanol' ? '' : `, a member of the ${kind} series`}?`,
          answer: name,
          wrong: [`${STEMS[n]}${s.suffix}`, n > 1 ? `${STEMS[n - 2]}${s.suffix}` : `${STEMS[n + 1]}${s.suffix}`, ...others.map((k) => `${STEMS[n - 1]}${SERIES[k].suffix}`)],
          explanation: `${n} carbon atom${n > 1 ? 's' : ''} gives the stem "${STEMS[n - 1]}-", and the ${kind} ending is "-${s.suffix}": ${name}.`,
        };
      }
      const M = mr(formula);
      return {
        stem: `What is the relative molecular mass of the ${kind} with ${n} carbon atom${n > 1 ? 's' : ''}? [C = 12, H = 1${kind === 'alkanol' ? ', O = 16' : ''}]`,
        ...choices(CU.none, M, [M + 14, M - 14 > 0 ? M - 14 : M + 28, M + 2, 12 * n]),
        explanation: `The formula is ${f(formula)} (${m(s.general)} with n = ${n}).\n${m(`M = ${M}`)}.`,
      };
    },
  },
  {
    key: 'jamb-chem/sigma-pi-bonds',
    topic: [ORG, 'Hydrocarbons'],
    difficulty: 3,
    make: (r) => {
      const kind = r.pick(['alkane', 'alkene', 'alkyne'] as const);
      const n = r.int(kind === 'alkane' ? 1 : 2, 7);
      const pi = { alkane: 0, alkene: 1, alkyne: 2 }[kind];
      const H = { alkane: 2 * n + 2, alkene: 2 * n, alkyne: 2 * n - 2 }[kind];
      const sigma = n - 1 + H;
      const name = `${STEMS[n - 1]}${{ alkane: 'ane', alkene: 'ene', alkyne: 'yne' }[kind]}`;
      const askPi = r.chance(0.4) && pi > 0;
      return {
        stem: `How many ${askPi ? 'pi (π)' : 'sigma (σ)'} bonds are in a molecule of ${name}${kind === 'alkane' ? '' : n > 3 ? ` (with the ${kind === 'alkene' ? 'double' : 'triple'} bond at the end)` : ''}, ${f(clean(`C${n}H${H}`))}?`,
        answer: String(askPi ? pi : sigma),
        wrong: (askPi ? [pi + 1, pi === 1 ? 2 : 1, 0, 3] : [sigma + pi, sigma - 1, n + H, sigma + 1]).filter((x) => x !== (askPi ? pi : sigma) && x >= 0).map(String),
        explanation: `Every single bond is one σ bond. A double bond is one σ + one π; a triple bond is one σ + two π.\n${f(clean(`C${n}H${H}`))} has ${H} C–H bonds and ${n - 1} carbon–carbon link${n - 1 === 1 ? '' : 's'}, so σ = ${H} + ${n - 1} = ${sigma}; π = ${pi}.`,
      };
    },
  },
  {
    key: 'jamb-chem/combustion-volumes',
    topic: [ORG, 'Hydrocarbons'],
    difficulty: 3,
    make: (r) => {
      const HYDROCARBONS = [

        [1, 4],
        [2, 6],
        [3, 8],
        [4, 10],
        [2, 4],
        [3, 6],
        [2, 2],
        [4, 6],
        [4, 8],
      ];
      const [x, y] = r.pick(HYDROCARBONS);
      const formula = clean(`C${x}H${y}`);
      if (r.chance(0.5)) {
        const V = r.pick([10, 20, 25, 50]);
        const O2 = V * (x + y / 4);
        return {
          stem: `What volume of oxygen is needed to burn ${m(`${V}\\,\\text{cm}^3`)} of ${f(formula)} completely, with all volumes measured at the same temperature and pressure?`,
          ...choices(CU.cm3, O2, [V * (x + y / 2), V * x, V * (2 * x + y / 2), O2 / 2]),
          explanation: `${m(`\\text{C}_x\\text{H}_y + (x + \\tfrac{y}{4})\\text{O}_2 \\rightarrow x\\text{CO}_2 + \\tfrac{y}{2}\\text{H}_2\\text{O}`)}.\nFor ${f(formula)}: ${m(`${x} + \\frac{${y}}{4} = ${num(x + y / 4)}`)} volumes of oxygen per volume, so ${m(`${V} \\times ${num(x + y / 4)} = ${num(O2)}`)} cm³.`,
        };
      }
      const k = r.pick([1, 2]);
      const Vco2 = 22.4 * x * k;
      const water = 9 * y * k;
      return {
        stem: `${k === 1 ? '1 mole' : '2 moles'} of a hydrocarbon burns completely to give ${qty(Vco2, CU.dm3)} of ${f('CO2')} at s.t.p. and ${qty(water, CU.g)} of water. What is the hydrocarbon? [H = 1, O = 16; molar volume = ${m('22.4\\,\\text{dm}^3')}]`,
        answer: f(formula),
        wrong: r.shuffle(HYDROCARBONS.filter(([a, b]) => a !== x || b !== y)).map(([a, b]) => f(clean(`C${a}H${b}`))),
        explanation: `${f('CO2')}: ${m(`\\frac{${sci(Vco2)}}{22.4} = ${x * k}`)} mol, so ${x * k} mol of C.\nWater: ${m(`\\frac{${water}}{18} = ${(y * k) / 2}`)} mol, which holds ${y * k} mol of H.\nPer mole of hydrocarbon: ${x} C and ${y} H, so it is ${f(formula)}.`,
        difficulty: 4,
      };
    },
  },

  // ── Nuclear ────────────────────────────────────────────
  {
    key: 'jamb-chem/nuclear',
    topic: [NUC, 'Nuclear reactions and half-life'],
    difficulty: 2,
    make: (r) => {
      if (r.chance(0.5)) {
        const T = r.pick([5, 8, 10, 15, 20, 30]);
        const n = r.int(2, 5);
        const N0 = r.pick([800, 1000, 1600, 3200, 6400, 100_000]);
        const left = N0 / 2 ** n;
        return {
          stem: `A radioactive nuclide has a half-life of ${T} years. Starting with ${num(N0)} atoms, how many are left after ${T * n} years?`,
          answer: num(left),
          wrong: [N0 / (2 * n), N0 / 2 ** (n + 1), N0 / 2 ** (n - 1), N0 - (N0 / 2) * n].filter((x) => x > 0 && x !== left).map((x) => num(Math.round(x * 100) / 100)),
          explanation: `${T * n} years is ${n} half-lives. The amount halves each time: ${m(`${num(N0)} \\times \\left(\\tfrac{1}{2}\\right)^{${n}} = ${num(left).replace(/,/g, '{,}')}`)}.`,
        };
      }
      const [X, A, Z, Y] = r.pick([
        ['U', 238, 92, 'Th'],
        ['Ra', 226, 88, 'Rn'],
        ['Po', 210, 84, 'Pb'],
        ['C', 14, 6, 'N'],
        ['Th', 234, 90, 'Pa'],
        ['Na', 24, 11, 'Mg'],
        ['Bi', 214, 83, 'Po'],
      ] as const);
      const alpha = ['U', 'Ra', 'Po'].includes(X);
      const [A2, Z2] = alpha ? [A - 4, Z - 2] : [A, Z + 1];
      const particle = alpha ? 'an alpha particle' : 'a beta particle';
      return {
        stem: `${m(`{}^{${A}}_{${Z}}\\text{${X}} \\rightarrow {}^{${A2}}_{${Z2}}\\text{${Y}} + \\text{Q}`)}\nWhat is Q?`,
        answer: `${particle}, ${alpha ? m('{}^{4}_{2}\\text{He}') : m('{}^{0}_{-1}e')}`,
        wrong: [alpha ? `a beta particle, ${m('{}^{0}_{-1}e')}` : `an alpha particle, ${m('{}^{4}_{2}\\text{He}')}`, `a neutron, ${m('{}^{1}_{0}n')}`, `a proton, ${m('{}^{1}_{1}p')}`, `a gamma ray, ${m('\\gamma')}`],
        explanation: `Mass numbers and atomic numbers must balance.\nMass: ${A} = ${A2} + ${A - A2}. Atomic number: ${Z} = ${Z2} + (${Z - Z2}).\nA particle with mass ${A - A2} and charge ${Z - Z2} is ${alpha ? 'an alpha particle' : 'a beta particle (an electron)'}.`,
      };
    },
  },
];
