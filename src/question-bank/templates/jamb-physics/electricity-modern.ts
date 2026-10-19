import { m, num, type Template, tnum } from '../engine.js';
import { an, choices, qty, sci, sig, U } from './kit.js';

const ES = 'Electrostatics and Electric Fields';
const CUR = 'Current Electricity';
const MAG = 'Magnetism and Electromagnetism';
const AT = 'Atomic and Nuclear Physics';

const K_E = 9e9;
const EPS0 = 8.85e-12;
const H = 6.6e-34;
const E_CH = 1.6e-19;
const C = 3e8;

const par = (...rs: number[]) => 1 / rs.reduce((s, x) => s + 1 / x, 0);

export const electricityModern: Template[] = [
  // ── Electrostatics ─────────────────────────────────────
  {
    key: 'jamb-physics/coulomb',
    topic: [ES, 'Electric charges and fields'],
    difficulty: 3,
    make: (r) => {
      const q1 = r.pick([1, 2, 3, 4, 5, 6]);
      const q2 = r.pick([1, 2, 3, 4, 5, 8]);
      const d = r.pick([3, 5, 10, 20, 30]);
      const F = (K_E * q1 * 1e-6 * q2 * 1e-6) / (d / 100) ** 2;
      if (r.chance(0.3)) {
        const k = r.pick([2, 3, 4]);
        return {
          stem: `Two point charges are a distance d apart and repel each other with a force F. What is the force between them when they are moved ${k}d apart?`,
          answer: m(`\\frac{F}{${k * k}}`),
          wrong: [m(`\\frac{F}{${k}}`), m(`${k}F`), m(`${k * k}F`), m(`\\frac{F}{${2 * k}}`)],
          explanation: `Coulomb's law is an inverse-square law: ${m('F \\propto \\frac{1}{r^2}')}.\nMaking the distance ${k} times bigger divides the force by ${m(`${k}^2 = ${k * k}`)}.`,
          difficulty: 2,
        };
      }
      return {
        stem: `Two point charges of ${m(`${q1}\\,\\mu\\text{C}`)} and ${m(`${q2}\\,\\mu\\text{C}`)} are ${qty(d, U.cm)} apart in air. What is the force between them? (Take ${m('\\frac{1}{4\\pi\\varepsilon_0} = 9 \\times 10^{9}\\,\\text{N m}^2\\,\\text{C}^{-2}')}.)`,
        ...choices(U.N, F, [F * (d / 100), (K_E * q1 * q2) / d ** 2, F / 10_000, F * 100]),
        explanation: `Put everything in S.I. units: ${m(`${q1} \\times 10^{-6}`)} C, ${m(`${q2} \\times 10^{-6}`)} C and ${num(d / 100)} m.\n${m(`F = \\frac{kq_1q_2}{r^2} = \\frac{9 \\times 10^{9} \\times ${q1} \\times 10^{-6} \\times ${q2} \\times 10^{-6}}{${num(d / 100)}^2} = ${sci(F)}`)} N.`,
      };
    },
  },
  {
    key: 'jamb-physics/field-force',
    topic: [ES, 'Electric charges and fields'],
    difficulty: 2,
    make: (r) => {
      if (r.chance(0.5)) {
        const q = r.pick([1.6, 2, 3.2, 4, 4.6, 5]) * 10 ** r.pick([-6, -5, -19]);
        const E = r.pick([2, 3.2, 5, 8]) * 10 ** r.pick([3, 4, 5]);
        const F = q * E;
        return {
          stem: `A charge of ${qty(q, U.coul)} is placed in a uniform electric field of strength ${qty(E, U.Vm)}. What force acts on it?`,
          ...choices(U.N, F, [E / q, q / E, F * 10, F / 2]),
          explanation: `${m(`F = qE = ${sci(q)} \\times ${sci(E)} = ${sci(F)}`)} N.`,
        };
      }
      const V = r.pick([100, 200, 240, 500, 1000, 2000]);
      const dmm = r.pick([2, 4, 5, 10, 20]);
      const E = V / (dmm / 1000);
      return {
        stem: `Two parallel metal plates ${qty(dmm, U.mm)} apart are connected to a ${qty(V, U.V)} supply. What is the electric field strength between them?`,
        ...choices(U.Vm, E, [V * (dmm / 1000), V / dmm, E / 100, V / (dmm / 100)]),
        explanation: `${m(`E = \\frac{V}{d} = \\frac{${V}}{${num(dmm / 1000)}} = ${sci(E)}`)} V/m (d in metres).`,
      };
    },
  },
  {
    key: 'jamb-physics/capacitors',
    topic: [ES, 'Capacitors and dielectric'],
    difficulty: 3,
    make: (r) => {
      const [c1, c2] = r.shuffle([1, 2, 3, 4, 5, 6, 8, 10, 12]).slice(0, 2);
      const V = r.pick([6, 10, 12, 20, 50, 100, 200, 400]);
      const series = (c1 * c2) / (c1 + c2);
      const parallel = c1 + c2;
      const kind = r.pick(['series', 'parallel', 'charge', 'energy'] as const);
      if (kind === 'series') {
        return {
          stem: `Capacitors of ${qty(c1, U.uF)} and ${qty(c2, U.uF)} are connected in series. What is their combined capacitance?`,
          ...choices(U.uF, series, [parallel, Math.abs(c1 - c2) || parallel * 2, (c1 * c2) / 2, 1 / parallel]),
          explanation: `In series, ${m('\\frac{1}{C} = \\frac{1}{C_1} + \\frac{1}{C_2}')}, so ${m(`C = \\frac{${c1} \\times ${c2}}{${c1} + ${c2}} = ${sci(series)}`)} μF.`,
          difficulty: 2,
        };
      }
      if (kind === 'parallel') {
        return {
          stem: `Capacitors of ${qty(c1, U.uF)} and ${qty(c2, U.uF)} are connected in parallel across a ${qty(V, U.V)} supply. What total charge do they store?`,
          answer: m(`${sci(parallel * V)}\\,\\mu\\text{C}`),
          wrong: [series * V, c1 * V, parallel / V, parallel * V * 2].map((x) => m(`${sci(x)}\\,\\mu\\text{C}`)),
          explanation: `In parallel, capacitances add: ${c1} + ${c2} = ${parallel} μF.\n${m(`Q = CV = ${parallel} \\times ${V} = ${sci(parallel * V)}`)} μC.`,
        };
      }
      if (kind === 'charge') {
        return {
          stem: `Capacitors of ${qty(c1, U.uF)} and ${qty(c2, U.uF)} are connected in series across a ${qty(V, U.V)} supply. What charge is stored on each?`,
          answer: m(`${sci(series * V)}\\,\\mu\\text{C}`),
          wrong: [parallel * V, c1 * V, c2 * V, (series * V) / 2].map((x) => m(`${sci(x)}\\,\\mu\\text{C}`)),
          explanation: `Capacitors in series carry the same charge. Combined capacitance: ${m(`\\frac{${c1} \\times ${c2}}{${c1} + ${c2}} = ${sci(series)}`)} μF.\n${m(`Q = CV = ${sci(series)} \\times ${V} = ${sci(series * V)}`)} μC.`,
          difficulty: 4,
        };
      }
      const W = 0.5 * c1 * 1e-6 * V * V;
      return {
        stem: `${an(c1) === 'an' ? 'An' : 'A'} ${qty(c1, U.uF)} capacitor is charged to ${qty(V, U.V)}. How much energy does it store?`,
        ...choices(U.J, W, [c1 * 1e-6 * V * V, 0.5 * c1 * 1e-6 * V, 0.5 * c1 * V * V, W / 2]),
        explanation: `${m(`W = \\tfrac{1}{2}CV^2 = \\tfrac{1}{2} \\times ${c1} \\times 10^{-6} \\times ${V}^2 = ${sci(W)}`)} J.`,
        difficulty: 2,
      };
    },
  },
  {
    key: 'jamb-physics/parallel-plate',
    topic: [ES, 'Capacitors and dielectric'],
    difficulty: 4,
    make: (r) => {
      const A = r.pick([0.1, 0.2, 0.5, 0.8, 1, 2]);
      const dmm = r.pick([1, 2, 5, 10, 20]);
      const Cap = (EPS0 * A) / (dmm / 1000);
      if (r.chance(0.5)) {
        return {
          stem: `A parallel-plate capacitor has plates of area ${m(`${num(A)}\\,\\text{m}^2`)} separated by ${qty(dmm, U.mm)} of air. What is its capacitance? (Take ${m('\\varepsilon_0 = 8.85 \\times 10^{-12}\\,\\text{F m}^{-1}')}.)`,
          ...choices(U.F, Cap, [EPS0 * A * (dmm / 1000), (EPS0 * A) / dmm, EPS0 / (A * (dmm / 1000)), Cap * 2]),
          explanation: `${m(`C = \\frac{\\varepsilon_0 A}{d} = \\frac{8.85 \\times 10^{-12} \\times ${num(A)}}{${num(dmm / 1000)}} = ${sci(Cap)}`)} F.`,
          difficulty: 3,
        };
      }
      const V = r.pick([12, 50, 100, 120, 200]);
      const Q = Cap * V;
      return {
        stem: `A parallel-plate capacitor with plates of area ${m(`${num(A)}\\,\\text{m}^2`)}, ${qty(dmm, U.mm)} apart in air, is connected to a ${qty(V, U.V)} battery. What charge is on each plate? (Take ${m('\\varepsilon_0 = 8.85 \\times 10^{-12}\\,\\text{F m}^{-1}')}.)`,
        ...choices(U.coul, Q, [Cap / V, (EPS0 * A * V) / dmm, Q * 2, EPS0 * A * V]),
        explanation: `${m(`C = \\frac{\\varepsilon_0 A}{d} = ${sci(Cap)}`)} F.\n${m(`Q = CV = ${sci(Cap)} \\times ${V} = ${sci(Q)}`)} C.`,
      };
    },
  },

  // ── Current electricity ────────────────────────────────
  {
    key: 'jamb-physics/resistor-network',
    topic: [CUR, "Electric circuits and Ohm's law"],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['parallel', 'mixed', 'current'] as const);
      const [a, b, c] = r.shuffle([2, 3, 4, 6, 8, 10, 12, 15, 20]).slice(0, 3);
      if (kind === 'parallel') {
        const R = par(a, b);
        return {
          stem: `Resistors of ${qty(a, U.ohm)} and ${qty(b, U.ohm)} are connected in parallel. What is their effective resistance?`,
          ...choices(U.ohm, R, [a + b, (a + b) / 2, 1 / (a + b), Math.abs(a - b) || a * 2]),
          explanation: `${m(`R = \\frac{R_1R_2}{R_1 + R_2} = \\frac{${a} \\times ${b}}{${a} + ${b}} = ${sci(R)}`)} Ω.`,
        };
      }
      const R = a + par(b, c);
      if (kind === 'mixed') {
        return {
          stem: `${an(a) === 'an' ? 'An' : 'A'} ${qty(a, U.ohm)} resistor is connected in series with a parallel pair of ${qty(b, U.ohm)} and ${qty(c, U.ohm)} resistors. What is the total resistance?`,
          ...choices(U.ohm, R, [a + b + c, par(a, b, c), par(a + b, c), a + (b + c) / 2]),
          explanation: `The parallel pair: ${m(`\\frac{${b} \\times ${c}}{${b} + ${c}} = ${sci(par(b, c))}`)} Ω.\nAdd the series resistor: ${a} + ${sci(par(b, c))} = ${sci(R)} Ω.`,
          difficulty: 3,
        };
      }
      const V = r.pick([6, 9, 12, 24]);
      return {
        stem: `A ${qty(V, U.V)} battery of negligible internal resistance is connected to ${an(a)} ${qty(a, U.ohm)} resistor in series with a parallel pair of ${qty(b, U.ohm)} and ${qty(c, U.ohm)}. What current flows from the battery?`,
        ...choices(U.A, V / R, [V / (a + b + c), V / a, V / par(b, c), (V * R) / 100]),
        explanation: `Total resistance = ${a} + ${m(`\\frac{${b} \\times ${c}}{${b} + ${c}}`)} = ${sci(R)} Ω.\n${m(`I = \\frac{V}{R} = \\frac{${V}}{${sci(R)}} = ${sci(V / R)}`)} A.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-physics/internal-resistance',
    topic: [CUR, "Electric circuits and Ohm's law"],
    difficulty: 3,
    make: (r) => {
      const E = r.pick([1.5, 2, 3, 6, 9, 12, 24]);
      const ri = r.pick([0.5, 1, 1.5, 2]);
      const R = r.pick([1, 2, 2.5, 3, 4, 5, 10]);
      const I = E / (R + ri);
      const kind = r.pick(['current', 'terminal', 'lost'] as const);
      const lead = `A cell of e.m.f. ${qty(E, U.V)} and internal resistance ${qty(ri, U.ohm)} is connected to a ${qty(R, U.ohm)} resistor.`;
      const working = `${m(`I = \\frac{E}{R + r} = \\frac{${num(E)}}{${num(R)} + ${num(ri)}} = ${sci(I)}`)} A.`;
      if (kind === 'current') {
        return {
          stem: `${lead} What current flows?`,
          ...choices(U.A, I, [E / R, E / ri, E / (R - ri) || E, E * (R + ri)]),
          explanation: working,
        };
      }
      if (kind === 'terminal') {
        return {
          stem: `${lead} What is the terminal potential difference?`,
          ...choices(U.V, I * R, [E, I * ri, E + I * ri, (I * (R + ri)) / 2]),
          explanation: `${working}\nTerminal p.d. = ${m(`IR = ${sci(I)} \\times ${num(R)} = ${sci(I * R)}`)} V.`,
        };
      }
      return {
        stem: `${lead} What is the "lost volts" across the internal resistance?`,
        ...choices(U.V, I * ri, [I * R, E, E - I * ri, (E * ri) / R]),
        explanation: `${working}\nLost volts = ${m(`Ir = ${sci(I)} \\times ${num(ri)} = ${sci(I * ri)}`)} V.`,
      };
    },
  },
  {
    key: 'jamb-physics/electricity-cost',
    topic: [CUR, 'Electrical energy, power and heating'],
    difficulty: 2,
    make: (r) => {
      const n1 = r.int(2, 6);
      const p1 = r.pick([40, 60, 100]);
      const n2 = r.int(1, 3);
      const p2 = r.pick([500, 1000, 1500, 2000]);
      const hours = r.pick([2, 4, 5, 6, 8, 10]);
      const rate = r.pick([50, 68, 75, 100, 120, 209]);
      const kWh = ((n1 * p1 + n2 * p2) * hours) / 1000;
      const cost = kWh * rate;
      const naira = (x: number) => `₦${num(Math.round(x * 100) / 100, Number.isInteger(Math.round(x * 100) / 100) ? undefined : 2, 4)}`;
      return {
        stem: `A house runs ${n1} lamps of ${qty(p1, U.W)} each and ${n2} ${n2 > 1 ? 'appliances' : 'appliance'} of ${qty(p2, U.W)} for ${hours} hours. If electricity costs ₦${rate} per kWh, what is the cost?`,
        answer: naira(cost),
        wrong: [(n1 * p1 + n2 * p2) * hours * rate, ((p1 + p2) * hours * rate) / 1000, cost / hours, cost * 10].map(naira),
        explanation: `Total power = ${n1} × ${p1} + ${n2} × ${p2} = ${n1 * p1 + n2 * p2} W = ${num((n1 * p1 + n2 * p2) / 1000)} kW.\nEnergy = ${num((n1 * p1 + n2 * p2) / 1000)} × ${hours} = ${num(kWh)} kWh.\nCost = ${num(kWh)} × ₦${rate} = ${naira(cost)}.`,
      };
    },
  },
  {
    key: 'jamb-physics/electrical-power',
    topic: [CUR, 'Electrical energy, power and heating'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['energy', 'current', 'resistance'] as const);
      if (kind === 'energy') {
        const I = r.pick([0.5, 1, 2, 2.5, 3, 5]);
        const V = r.pick([12, 20, 40, 110, 220, 240]);
        const min = r.pick([1, 2, 5, 10, 30]);
        const W = I * V * min * 60;
        return {
          stem: `A current of ${qty(I, U.A)} flows through a resistor connected to a ${qty(V, U.V)} supply. How much energy is used in ${min} minute${min > 1 ? 's' : ''}?`,
          ...choices(U.J, W, [I * V * min, I * V, (V / I) * min * 60, I * I * V * min * 60]),
          explanation: `Change the time to seconds: ${min} × 60 = ${min * 60} s.\n${m(`W = IVt = ${num(I)} \\times ${V} \\times ${min * 60} = ${sci(W)}`)} J.`,
        };
      }
      const P = r.pick([60, 100, 500, 1000, 1500, 2000, 3000]);
      const V = r.pick([110, 220, 240, 250]);
      if (kind === 'current') {
        return {
          stem: `What current does a ${qty(P, U.W)}, ${qty(V, U.V)} electric iron draw when working normally?`,
          ...choices(U.A, P / V, [V / P, P * V, (V * V) / P, P / (V * V)]),
          explanation: `${m(`I = \\frac{P}{V} = \\frac{${P}}{${V}} = ${sci(P / V)}`)} A.`,
        };
      }
      return {
        stem: `What is the resistance of the filament of a ${qty(P, U.W)}, ${qty(V, U.V)} lamp when it is working normally?`,
        ...choices(U.ohm, (V * V) / P, [P / V, V / P, P / (V * V), P * V]),
        explanation: `${m(`P = \\frac{V^2}{R}`)}, so ${m(`R = \\frac{V^2}{P} = \\frac{${V}^2}{${P}} = ${sci((V * V) / P)}`)} Ω.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-physics/metre-bridge',
    topic: [CUR, "Electric circuits and Ohm's law"],
    difficulty: 3,
    make: (r) => {
      const l = r.pick([20, 25, 30, 40, 60, 70, 75, 80]);
      const S = r.pick([2, 3, 4, 5, 6, 10, 12]);
      const X = (S * l) / (100 - l);
      return {
        stem: `In a metre bridge, the balance point is ${qty(l, U.cm)} from the end where the unknown resistor X is connected. The standard resistor is ${qty(S, U.ohm)}. What is X?`,
        ...choices(U.ohm, X, [(S * (100 - l)) / l, (S * l) / 100, S, (S * (100 - l)) / 100]),
        explanation: `${m(`\\frac{X}{S} = \\frac{l}{100 - l}`)}, so ${m(`X = ${S} \\times \\frac{${l}}{${100 - l}} = ${sci(X)}`)} Ω.`,
      };
    },
  },
  {
    key: 'jamb-physics/resistivity',
    topic: [CUR, "Electric circuits and Ohm's law"],
    difficulty: 3,
    make: (r) => {
      const rho = r.pick([1.7, 2.8, 4.9, 10, 49, 110]) * 1e-8;
      const L = r.pick([1, 2, 5, 10, 50, 100]);
      const Amm = r.pick([0.1, 0.2, 0.5, 1, 2]);
      const R = (rho * L) / (Amm * 1e-6);
      return {
        stem: `A wire ${qty(L, U.m)} long has a cross-sectional area of ${m(`${num(Amm)}\\,\\text{mm}^2`)}. The resistivity of its metal is ${m(`${sci(rho)}\\,\\Omega\\,\\text{m}`)}. What is its resistance?`,
        ...choices(U.ohm, R, [(rho * L) / Amm, (rho * Amm * 1e-6) / L, R * 1000, R / 1000]),
        explanation: `Area in m²: ${m(`${num(Amm)} \\times 10^{-6}`)}.\n${m(`R = \\frac{\\rho L}{A} = \\frac{${sci(rho)} \\times ${L}}{${num(Amm)} \\times 10^{-6}} = ${sci(R)}`)} Ω.`,
      };
    },
  },
  {
    key: 'jamb-physics/meter-conversion',
    topic: [CUR, "Electric circuits and Ohm's law"],
    difficulty: 4,
    make: (r) => {
      const G = r.pick([5, 10, 20, 25, 50, 100]);
      const IgmA = r.pick([1, 2, 5, 10]);
      const Ig = IgmA / 1000;
      if (r.chance(0.5)) {
        const I = r.pick([1, 2, 5, 10]);
        const S = (Ig * G) / (I - Ig);
        return {
          stem: `A galvanometer of resistance ${qty(G, U.ohm)} gives full-scale deflection at ${m(`${IgmA}\\,\\text{mA}`)}. What resistance must be connected in parallel with it to make an ammeter reading up to ${qty(I, U.A)}?`,
          ...choices(U.ohm, S, [(I * G) / Ig, (Ig * G) / I, I / Ig - G, (I - Ig) / (Ig * G)], 3),
          explanation: `This is a shunt. The galvanometer takes ${num(Ig)} A and the shunt takes the rest, ${m(`${I} - ${num(Ig)} = ${num(I - Ig)}`)} A. They share the same p.d.:\n${m(`S = \\frac{I_gG}{I - I_g} = \\frac{${num(Ig)} \\times ${G}}{${num(I - Ig)}} = ${sci(S)}`)} Ω.`,
        };
      }
      const V = r.pick([5, 10, 15, 20, 50, 100]);
      const R = V / Ig - G;
      return {
        stem: `A galvanometer of resistance ${qty(G, U.ohm)} gives full-scale deflection at ${m(`${IgmA}\\,\\text{mA}`)}. What resistance must be connected in series with it to make a voltmeter reading up to ${qty(V, U.V)}?`,
        ...choices(U.ohm, R, [V / Ig, V / Ig + G, (Ig * G) / V, V * G]),
        explanation: `This is a multiplier. At full scale the total resistance must be ${m(`\\frac{V}{I_g} = \\frac{${V}}{${num(Ig)}} = ${sci(V / Ig)}`)} Ω.\nSubtract the galvanometer's own resistance: ${m(`${sci(V / Ig)} - ${G} = ${sci(R)}`)} Ω.`,
      };
    },
  },

  // ── Magnetism, induction, a.c. ─────────────────────────
  {
    key: 'jamb-physics/magnetic-force',
    topic: [MAG, 'Magnets and magnetic fields'],
    difficulty: 2,
    make: (r) => {
      if (r.chance(0.6)) {
        const L = r.pick([0.1, 0.15, 0.2, 0.5, 1]);
        const I = r.pick([2, 3, 4, 5, 6, 10]);
        const B = r.pick([0.1, 0.2, 0.4, 0.5, 0.8]);
        const th = r.pick([90, 90, 30]);
        const F = B * I * L * (th === 90 ? 1 : 0.5);
        return {
          stem: `A straight wire ${qty(L * 100, U.cm)} long carries a current of ${qty(I, U.A)} in a uniform magnetic field of ${qty(B, U.T)}. What is the force on it when it is ${th === 90 ? 'at right angles to the field' : `at ${m('30^\\circ')} to the field`}?`,
          ...choices(U.N, F, [B * I * L * 100 * (th === 90 ? 1 : 0.5), (B * I) / L, th === 90 ? B * I * L * 0.5 : B * I * L, B * L]),
          explanation: `${m('F = BIL\\sin\\theta')} with L in metres (${num(L)} m)${th === 90 ? ' and sin 90° = 1' : ' and sin 30° = 0.5'}.\n${m(`F = ${num(B)} \\times ${I} \\times ${num(L)}${th === 90 ? '' : ' \\times 0.5'} = ${sci(F)}`)} N.`,
        };
      }
      const v = r.pick([1, 2, 3, 5]) * 10 ** r.pick([5, 6, 7]);
      const B = r.pick([0.1, 0.2, 0.5, 1, 2]);
      const F = E_CH * v * B;
      return {
        stem: `An electron moves at ${qty(v, U.ms)} at right angles to a magnetic field of ${qty(B, U.T)}. What force acts on it? (Charge of an electron = ${qty(E_CH, U.coul)}.)`,
        ...choices(U.N, F, [v * B, (E_CH * v) / B, (E_CH * B) / v, F * 10]),
        explanation: `${m(`F = qvB = ${sci(E_CH)} \\times ${sci(v)} \\times ${num(B)} = ${sci(F)}`)} N.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-physics/transformer',
    topic: [MAG, 'Alternating current circuits'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['voltage', 'turns', 'current'] as const);
      if (kind === 'turns') {
        const Vp = r.pick([2200, 11_000, 240, 220, 3300]);
        const Vs = r.pick([110, 12, 6, 22, 33].filter((x) => x < Vp));
        const Ns = r.pick([10, 20, 25, 50, 60]);
        const Np = (Ns * Vp) / Vs;
        if (!Number.isInteger(Np)) return null;
        return {
          stem: `A step-down transformer works on ${an(Vp)} ${qty(Vp, U.V)} line and delivers ${qty(Vs, U.V)}. If the secondary coil has ${Ns} turns, how many turns are on the primary?`,
          answer: num(Np),
          wrong: [(Ns * Vs) / Vp, Ns * Vp, Np / 10, Np * 2].map((x) => num(sig(x, 3))),
          explanation: `${m('\\frac{N_p}{N_s} = \\frac{V_p}{V_s}')}, so ${m(`N_p = ${Ns} \\times \\frac{${Vp}}{${Vs}} = ${tnum(Np)}`)}.`,
        };
      }
      const Np = r.pick([100, 200, 300, 400, 500, 1000]);
      const Ns = r.pick([20, 30, 50, 100, 1000, 2000]);
      if (Np === Ns) return null;
      const Vp = r.pick([100, 120, 200, 240]);
      const Vs = (Vp * Ns) / Np;
      if (kind === 'voltage') {
        return {
          stem: `A transformer has ${Np} turns on its primary coil and ${Ns} on its secondary. If the input voltage is ${qty(Vp, U.V)}, what is the output voltage?`,
          ...choices(U.V, Vs, [(Vp * Np) / Ns, Vp, Vp * Ns, Vs * 2]),
          explanation: `${m('\\frac{V_s}{V_p} = \\frac{N_s}{N_p}')}, so ${m(`V_s = ${Vp} \\times \\frac{${Ns}}{${Np}} = ${sci(Vs)}`)} V.`,
        };
      }
      const eff = r.pick([80, 90, 100]);
      const Is = r.pick([1, 2, 4, 5]);
      const Ip = (Vs * Is) / (Vp * (eff / 100));
      return {
        stem: `A transformer steps ${qty(Vp, U.V)} ${Vs > Vp ? 'up' : 'down'} to ${qty(Vs, U.V)}, and the secondary supplies ${qty(Is, U.A)}. If the transformer is ${eff === 100 ? 'ideal' : `${eff}% efficient`}, what current flows in the primary?`,
        ...choices(U.A, Ip, [(Vp * Is) / Vs, Is, ((Vs * Is) / Vp) * (eff / 100), Ip * 2]),
        explanation: `Output power = ${m(`${sci(Vs)} \\times ${Is} = ${sci(Vs * Is)}`)} W.${eff === 100 ? '' : `\nInput power = output ÷ efficiency = ${m(`\\frac{${sci(Vs * Is)}}{${num(eff / 100)}} = ${sci((Vs * Is) / (eff / 100))}`)} W.`}\n${m(`I_p = \\frac{P}{V_p} = \\frac{${sci((Vs * Is) / (eff / 100))}}{${Vp}} = ${sci(Ip)}`)} A.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-physics/ac-reactance',
    topic: [MAG, 'Alternating current circuits'],
    difficulty: 3,
    make: (r) => {
      const kind = r.pick(['XL', 'XC', 'rms'] as const);
      if (kind === 'rms') {
        const V0 = r.pick([10, 20, 100, 141, 200, 311, 340]);
        if (r.chance(0.5)) {
          return {
            stem: `An a.c. supply has a peak voltage of ${qty(V0, U.V)}. What is its r.m.s. voltage?`,
            ...choices(U.V, V0 / Math.SQRT2, [V0 * Math.SQRT2, V0 / 2, V0, (2 * V0) / Math.PI]),
            explanation: `${m(`V_{rms} = \\frac{V_0}{\\sqrt{2}} = \\frac{${V0}}{1.414} = ${sci(V0 / Math.SQRT2)}`)} V.`,
            difficulty: 2,
          };
        }
        const Vr = r.pick([110, 120, 220, 230, 240]);
        return {
          stem: `The mains supply is ${qty(Vr, U.V)} r.m.s. What is its peak voltage?`,
          ...choices(U.V, Vr * Math.SQRT2, [Vr / Math.SQRT2, Vr * 2, Vr, (Vr * Math.PI) / 2]),
          explanation: `${m(`V_0 = \\sqrt{2}\\,V_{rms} = 1.414 \\times ${Vr} = ${sci(Vr * Math.SQRT2)}`)} V.`,
          difficulty: 2,
        };
      }
      // Frequencies written as k/π make the π cancel, as in real JAMB questions.
      const k = r.pick([25, 50, 100, 200, 500]);
      if (kind === 'XL') {
        const L = r.pick([0.1, 0.2, 0.5, 1, 2]);
        const X = 2 * k * L;
        return {
          stem: `An inductor of ${qty(L, '\\text{H}')} with negligible resistance is connected to a ${m(`\\frac{${k}}{\\pi}\\,\\text{Hz}`)} a.c. supply. What is its reactance?`,
          ...choices(U.ohm, X, [k * L, 2 * Math.PI * k * L, 1 / (2 * k * L), X / Math.PI]),
          explanation: `${m(`X_L = 2\\pi fL = 2\\pi \\times \\frac{${k}}{\\pi} \\times ${num(L)} = ${sci(X)}`)} Ω.`,
        };
      }
      const CuF = r.pick([1, 2, 5, 10, 20, 50]);
      const X = 1 / (2 * k * CuF * 1e-6);
      return {
        stem: `A ${qty(CuF, U.uF)} capacitor is connected to a ${m(`\\frac{${k}}{\\pi}\\,\\text{Hz}`)} a.c. supply. What is its reactance?`,
        ...choices(U.ohm, X, [2 * k * CuF * 1e-6, 1 / (k * CuF * 1e-6), 1 / (2 * k * CuF), X * Math.PI]),
        explanation: `${m(`X_C = \\frac{1}{2\\pi fC} = \\frac{1}{2\\pi \\times \\frac{${k}}{\\pi} \\times ${CuF} \\times 10^{-6}} = ${sci(X)}`)} Ω.`,
      };
    },
  },
  {
    key: 'jamb-physics/rlc',
    topic: [MAG, 'Alternating current circuits'],
    difficulty: 3,
    make: (r) => {
      const [a, b] = r.pick([
        [3, 4],
        [6, 8],
        [5, 12],
        [8, 15],
        [9, 12],
      ]);
      const k = r.pick([1, 2, 5, 10]);
      const R = a * k;
      const net = b * k;
      const XC = r.pick([10, 20, 30, 40, 50]) * (k > 2 ? 2 : 1);
      const XL = XC + net;
      const Z = Math.hypot(R, net);
      if (r.chance(0.5)) {
        return {
          stem: `In a series a.c. circuit, the voltages across the resistor, inductor and capacitor are ${qty(R, U.V)}, ${qty(XL, U.V)} and ${qty(XC, U.V)}. What is the supply voltage?`,
          ...choices(U.V, Z, [R + XL + XC, R + XL - XC, Math.hypot(R, XL + XC), Math.hypot(R, XL)]),
          explanation: `The inductor and capacitor voltages are opposite, so they partly cancel: ${XL} − ${XC} = ${net} V.\nThis is at right angles to the resistor's voltage: ${m(`V = \\sqrt{${R}^2 + ${net}^2} = ${sci(Z)}`)} V.`,
        };
      }
      return {
        stem: `A series circuit has a resistance of ${qty(R, U.ohm)}, an inductive reactance of ${qty(XL, U.ohm)} and a capacitive reactance of ${qty(XC, U.ohm)}. What is its impedance?`,
        ...choices(U.ohm, Z, [R + XL + XC, R + XL - XC, Math.hypot(R, XL + XC), Math.hypot(XL, XC)]),
        explanation: `${m(`Z = \\sqrt{R^2 + (X_L - X_C)^2} = \\sqrt{${R}^2 + ${net}^2} = ${sci(Z)}`)} Ω.\n(At resonance, ${m('X_L = X_C')} and Z would equal R.)`,
      };
    },
  },
  {
    key: 'jamb-physics/resonance',
    topic: [MAG, 'Alternating current circuits'],
    difficulty: 4,
    make: (r) => {
      const L = r.pick([0.1, 0.2, 0.5, 1, 2]);
      const CuF = r.pick([1, 2, 5, 10, 20, 50]);
      const f = 1 / (2 * Math.PI * Math.sqrt(L * CuF * 1e-6));
      return {
        stem: `An inductor of ${qty(L, '\\text{H}')} and a capacitor of ${qty(CuF, U.uF)} are connected in series. At what frequency does the circuit resonate?`,
        ...choices(U.Hz, f, [1 / Math.sqrt(L * CuF * 1e-6), 1 / (2 * Math.PI * L * CuF * 1e-6), 2 * Math.PI * Math.sqrt(L * CuF * 1e-6), f * 2]),
        explanation: `At resonance ${m('X_L = X_C')}, which gives ${m('f = \\frac{1}{2\\pi\\sqrt{LC}}')}.\n${m(`f = \\frac{1}{2\\pi\\sqrt{${num(L)} \\times ${CuF} \\times 10^{-6}}} = ${sci(f)}`)} Hz.`,
      };
    },
  },
  {
    key: 'jamb-physics/induced-emf',
    topic: [MAG, 'Alternating current circuits'],
    difficulty: 3,
    make: (r) => {
      const N = r.pick([50, 100, 200, 500]);
      const d = r.pick([0.01, 0.02, 0.05, 0.1, 0.2]);
      const t = r.pick([0.1, 0.2, 0.5, 1, 2]);
      const emf = (N * d) / t;
      return {
        stem: `The magnetic flux through a coil of ${N} turns changes by ${m(`${num(d)}\\,\\text{Wb}`)} in ${qty(t, U.s)}. What average e.m.f. is induced?`,
        ...choices(U.V, emf, [d / t, N * d * t, (N * t) / d, emf / 2]),
        explanation: `Faraday's law: ${m(`E = N\\frac{\\Delta\\Phi}{\\Delta t} = ${N} \\times \\frac{${num(d)}}{${num(t)}} = ${sci(emf)}`)} V.`,
      };
    },
  },

  // ── Atomic and nuclear ─────────────────────────────────
  {
    key: 'jamb-physics/half-life',
    topic: [AT, 'Radioactivity and nuclear energy'],
    difficulty: 3,
    make: (r) => {
      const T = r.pick([2, 3, 4, 5, 6, 8, 10, 12, 20, 30]);
      const n = r.int(2, 6);
      const unit = r.pick(['days', 'minutes', 'years', 'hours']);
      const kind = r.pick(['fraction', 'find-T', 'activity', 'original'] as const);
      if (kind === 'fraction') {
        return {
          stem: `A radioactive substance has a half-life of ${T} ${unit}. What fraction of it is left after ${T * n} ${unit}?`,
          answer: m(`\\frac{1}{${2 ** n}}`),
          wrong: [m(`\\frac{1}{${2 * n}}`), m(`\\frac{1}{${n}}`), m(`\\frac{1}{${2 ** (n + 1)}}`), m(`\\frac{1}{${2 ** (n - 1)}}`)],
          explanation: `${T * n} ${unit} is ${m(`\\frac{${T * n}}{${T}} = ${n}`)} half-lives.\nEach halves what's left: ${m(`\\left(\\frac{1}{2}\\right)^{${n}} = \\frac{1}{${2 ** n}}`)}.`,
          difficulty: 2,
        };
      }
      if (kind === 'find-T') {
        return {
          stem: `After ${T * n} ${unit}, ${m(`\\frac{1}{${2 ** n}}`)} of a radioactive sample is left. What is its half-life?`,
          answer: `${T} ${unit}`,
          wrong: [T * 2, T * n, T * n * 2, T / 2].map((x) => `${num(x)} ${unit}`),
          explanation: `${m(`\\frac{1}{${2 ** n}} = \\left(\\frac{1}{2}\\right)^{${n}}`)}, so ${n} half-lives have passed.\nHalf-life = ${m(`\\frac{${T * n}}{${n}} = ${T}`)} ${unit}.`,
        };
      }
      const A0 = r.pick([64, 80, 96, 120, 160, 200, 320, 400, 640, 800, 1600]);
      if (A0 % 2 ** n !== 0) return null;
      const A = A0 / 2 ** n;
      if (kind === 'activity') {
        return {
          stem: `A radioactive source has an activity of ${qty(A0, U.Bq)}. ${T * n} ${unit} later its activity is ${qty(A, U.Bq)}. What is its half-life?`,
          answer: `${T} ${unit}`,
          wrong: [T * 2, T * n, T / 2, T * (n + 1)].map((x) => `${num(x)} ${unit}`),
          explanation: `${A0} → ${A} means it halved ${n} times (${m(`\\frac{${A0}}{${A}} = ${2 ** n} = 2^{${n}}`)}).\nHalf-life = ${m(`\\frac{${T * n}}{${n}} = ${T}`)} ${unit}.`,
        };
      }
      return {
        stem: `A radioactive substance has a half-life of ${T} ${unit}. After ${T * n} ${unit}, its count rate is ${A} counts per minute. What was its count rate at the start?`,
        answer: `${num(A0)} counts per minute`,
        wrong: [A * n, A * 2 * n, A * 2 ** (n - 1), A * 2 ** (n + 1)].map((x) => `${num(x)} counts per minute`),
        explanation: `${T * n} ${unit} is ${n} half-lives, so the count rate halved ${n} times.\nStart = ${m(`${A} \\times 2^{${n}} = ${A0}`)} counts per minute.`,
      };
    },
  },
  {
    key: 'jamb-physics/decay-constant',
    topic: [AT, 'Radioactivity and nuclear energy'],
    difficulty: 2,
    make: (r) => {
      const T = r.pick([2, 5, 8, 10, 12, 20, 30, 50, 100]);
      const unit = r.pick(['days', 'seconds', 'years', 'hours']);
      const per = {
        days: '\\text{day}^{-1}',
        seconds: '\\text{s}^{-1}',
        years: '\\text{year}^{-1}',
        hours: '\\text{h}^{-1}',
      }[unit]!;
      const lam = 0.693 / T;
      if (r.chance(0.6)) {
        return {
          stem: `The half-life of a radioactive material is ${T} ${unit}. What is its decay constant?`,
          ...choices(per, lam, [T / 0.693, 0.693 * T, 1 / T, lam * 2]),
          explanation: `${m('\\lambda = \\frac{\\ln 2}{T_{1/2}} = \\frac{0.693}{T_{1/2}}')}.\n${m(`\\lambda = \\frac{0.693}{${T}} = ${sci(lam)}`)} per ${unit.replace(/s$/, '')}.`,
        };
      }
      return {
        stem: `A radioactive material has a decay constant of ${qty(lam, per, 3)}. What is its half-life?`,
        answer: `${num(sig(0.693 / sig(lam, 3), 3))} ${unit}`,
        wrong: [sig(lam, 3) / 0.693, 1 / sig(lam, 3), 0.693 * sig(lam, 3)].map((x) => `${num(sig(x, 3))} ${unit}`),
        explanation: `${m(`T_{1/2} = \\frac{0.693}{\\lambda} = \\frac{0.693}{${sci(lam)}} = ${sci(0.693 / sig(lam, 3))}`)} ${unit}.`,
      };
    },
  },
  {
    key: 'jamb-physics/nuclear-equation',
    topic: [AT, 'Radioactivity and nuclear energy'],
    difficulty: 2,
    make: (r) => {
      const [X, A, Z] = r.pick([
        ['U', 238, 92],
        ['Th', 232, 90],
        ['Ra', 226, 88],
        ['Po', 210, 84],
        ['Pb', 214, 82],
        ['Bi', 212, 83],
        ['Rn', 222, 86],
      ] as const);
      const a = r.int(0, 3);
      const b = r.int(0, 3);
      if (a + b === 0) return null;
      const A2 = A - 4 * a;
      const Z2 = Z - 2 * a + b;
      const nuc = (mass: number, at: number) => m(`{}^{${mass}}_{${at}}\\text{Y}`);
      const what = [a ? `${a} alpha particle${a > 1 ? 's' : ''}` : '', b ? `${b} beta particle${b > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ');
      return {
        stem: `The nucleus ${m(`{}^{${A}}_{${Z}}\\text{${X}}`)} emits ${what} to become a nucleus Y. Which of these is Y?`,
        answer: nuc(A2, Z2),
        wrong: [nuc(A2, Z - 2 * a - b), nuc(A - 4 * a - b, Z2), nuc(A - 2 * a, Z - a + b), nuc(A2, Z2 + 1), nuc(A - 4 * a, Z - 4 * a + b)],
        explanation: `An alpha particle is ${m('{}^{4}_{2}\\text{He}')}: mass number −4, atomic number −2.\nA beta particle is an electron, ${m('{}^{0}_{-1}e')}: mass number unchanged, atomic number +1.\nMass number: ${A} − ${4 * a} = ${A2}. Atomic number: ${Z} − ${2 * a} + ${b} = ${Z2}.`,
      };
    },
  },
  {
    key: 'jamb-physics/photon-energy',
    topic: [AT, 'Structure of the atom'],
    difficulty: 3,
    make: (r) => {
      const kind = r.pick(['f', 'lambda', 'xray', 'levels'] as const);
      const consts = `(Take ${m('h = 6.6 \\times 10^{-34}\\,\\text{J s}')}${kind !== 'lambda' ? '' : `, ${m('c = 3 \\times 10^{8}\\,\\text{m s}^{-1}')}`}${kind === 'xray' || kind === 'levels' ? `, ${m('e = 1.6 \\times 10^{-19}\\,\\text{C}')}` : ''}.)`;
      if (kind === 'f') {
        const f = r.pick([2, 4, 5, 6, 7.5, 8]) * 1e14;
        const E = H * f;
        return {
          stem: `What is the energy of a photon of frequency ${qty(f, U.Hz)}? ${consts}`,
          ...choices(U.J, E, [f / H, H / f, E * 10, E / 2]),
          explanation: `${m(`E = hf = 6.6 \\times 10^{-34} \\times ${sci(f)} = ${sci(E)}`)} J.`,
        };
      }
      if (kind === 'lambda') {
        const nm = r.pick([300, 400, 450, 500, 600, 660]);
        const E = (H * C) / (nm * 1e-9);
        return {
          stem: `What is the energy of a photon of light of wavelength ${m(`${nm}\\,\\text{nm}`)}? ${consts}`,
          ...choices(U.J, E, [H * C * nm * 1e-9, (H * C) / nm, (H * nm * 1e-9) / C, E * 2]),
          explanation: `${m(`E = \\frac{hc}{\\lambda} = \\frac{6.6 \\times 10^{-34} \\times 3 \\times 10^{8}}{${nm} \\times 10^{-9}} = ${sci(E)}`)} J.`,
        };
      }
      if (kind === 'levels') {
        const E1 = r.pick([-13.6, -10.4, -5.5, -3.4]);
        const E2 = r.pick([-1.5, -0.85, -1.6, -2.4, -3.4, -5.5].filter((x) => x > E1));
        const dE = (E2 - E1) * E_CH;
        const f = dE / H;
        return {
          stem: `An electron in an atom falls from the ${qty(E2, U.eV)} level to the ${qty(E1, U.eV)} level. What is the frequency of the photon given out? ${consts}`,
          ...choices(U.Hz, f, [((E2 + E1) * -E_CH) / H, (E2 - E1) / H, dE * H, f / 2]),
          explanation: `Energy given out = ${m(`${num(E2)} - (${num(E1)}) = ${num(sig(E2 - E1, 4))}`)} eV = ${m(`${num(sig(E2 - E1, 4))} \\times 1.6 \\times 10^{-19} = ${sci(dE)}`)} J.\n${m(`f = \\frac{E}{h} = \\frac{${sci(dE)}}{6.6 \\times 10^{-34}} = ${sci(f)}`)} Hz.`,
          difficulty: 4,
        };
      }
      const f = r.pick([1, 1.6, 2, 2.4, 3]) * 1e18;
      const V = (H * f) / E_CH;
      return {
        stem: `An X-ray tube emits X-rays of maximum frequency ${qty(f, U.Hz)}. What accelerating voltage is applied? ${consts}`,
        ...choices(U.V, V, [H * f, (E_CH * f) / H, (H * f) / E_CH / 1000, V * 2]),
        explanation: `The electron's energy eV all becomes one photon: ${m('eV = hf')}.\n${m(`V = \\frac{hf}{e} = \\frac{6.6 \\times 10^{-34} \\times ${sci(f)}}{1.6 \\times 10^{-19}} = ${sci(V)}`)} V.`,
      };
    },
  },
  {
    key: 'jamb-physics/photoelectric',
    topic: [AT, 'Structure of the atom'],
    difficulty: 3,
    make: (r) => {
      const W = r.pick([1.8, 2, 2.2, 2.3, 2.5, 3, 4.2]);
      const photon = W + r.pick([0.5, 0.8, 1, 1.2, 1.5, 2, 2.5]);
      const kind = r.pick(['ke', 'stopping', 'threshold'] as const);
      if (kind === 'threshold') {
        const f0 = (W * E_CH) / H;
        return {
          stem: `The work function of a metal is ${qty(W, U.eV)}. What is its threshold frequency? (Take ${m('h = 6.6 \\times 10^{-34}\\,\\text{J s}')}, ${m('1\\,\\text{eV} = 1.6 \\times 10^{-19}\\,\\text{J}')}.)`,
          ...choices(U.Hz, f0, [W / H, (W * H) / E_CH, f0 * 2, f0 / 2]),
          explanation: `At the threshold, the photon has just enough energy to free an electron: ${m('hf_0 = W')}.\n${m(`f_0 = \\frac{${num(W)} \\times 1.6 \\times 10^{-19}}{6.6 \\times 10^{-34}} = ${sci(f0)}`)} Hz.`,
        };
      }
      const ke = sig(photon - W, 4);
      if (kind === 'stopping') {
        return {
          stem: `Light with photons of energy ${qty(photon, U.eV)} falls on a metal of work function ${qty(W, U.eV)}. What is the stopping potential?`,
          ...choices(U.V, ke, [photon, W, photon + W, ke / 2]),
          explanation: `Maximum kinetic energy = ${num(photon)} − ${num(W)} = ${num(ke)} eV.\nThe stopping potential must take away exactly this energy, so it is ${num(ke)} V.`,
          difficulty: 4,
        };
      }
      return {
        stem: `Photons of energy ${qty(photon, U.eV)} fall on a metal of work function ${qty(W, U.eV)}. What is the maximum kinetic energy of the emitted electrons?`,
        ...choices(U.eV, ke, [photon + W, photon, W, (photon * W) / 10]),
        explanation: `Einstein's equation: ${m(`KE_{max} = hf - W = ${num(photon)} - ${num(W)} = ${num(ke)}`)} eV.`,
      };
    },
  },
  {
    key: 'jamb-physics/mass-energy',
    topic: [AT, 'Radioactivity and nuclear energy'],
    difficulty: 3,
    make: (r) => {
      if (r.chance(0.5)) {
        const g = r.pick([1, 2, 5, 10]) * 10 ** r.pick([-3, -1, 0]);
        const E = (g / 1000) * C * C;
        return {
          stem: `How much energy is released if ${qty(g, U.g)} of matter is completely changed into energy? (Take ${m('c = 3 \\times 10^{8}\\,\\text{m s}^{-1}')}.)`,
          ...choices(U.J, E, [g * C * C, (g / 1000) * C, E / 2, (g / 1000) * C * C * C]),
          explanation: `Change grams to kilograms: ${m(`${sci(g)}\\,\\text{g} = ${sci(g / 1000)}\\,\\text{kg}`)}.\n${m(`E = mc^2 = ${sci(g / 1000)} \\times (3 \\times 10^{8})^2 = ${sci(E)}`)} J.`,
        };
      }
      const du = r.pick([0.001, 0.002, 0.005, 0.01, 0.02, 0.03]);
      const MeV = du * 931;
      return {
        stem: `In a nuclear reaction, the products have ${m(`${num(du)}\\,\\text{u}`)} less mass than the reactants. How much energy is released? (Take ${m('1\\,\\text{u} = 931\\,\\text{MeV}')}.)`,
        answer: m(`${sci(MeV)}\\,\\text{MeV}`),
        wrong: [MeV * 1000, MeV / 1000, du / 931, MeV * 2].map((x) => m(`${sci(x)}\\,\\text{MeV}`)),
        explanation: `The lost mass becomes energy: ${m(`${num(du)} \\times 931 = ${sci(MeV)}`)} MeV.`,
      };
    },
  },
];
