import { m, num, type Template } from '../engine.js';
import { choices, G, qty, sci, U } from './kit.js';

const MAT = 'Properties of Matter';
const HEAT = 'Temperature and Heat';

const C_WATER = 4200;
const C_ICE = 2100;
const L_ICE = 336_000;
const L_STEAM = 2_260_000;

/** °C values that are whole hundreds-friendly in kelvin, so gas-law answers come out clean. */
const KELVIN_FRIENDLY = [-73, -23, 0, 27, 47, 57, 77, 87, 127, 177, 227, 327];
const K = (c: number) => c + 273;

export const matterHeat: Template[] = [
  // ── Elasticity ─────────────────────────────────────────
  {
    key: 'jamb-physics/hooke',
    topic: [MAT, 'Elasticity'],
    difficulty: 2,
    make: (r) => {
      const F1 = r.pick([2, 4, 5, 10, 20, 40]);
      const e1 = r.pick([1, 2, 2.5, 4, 5, 8]);
      const k = F1 / (e1 / 100);
      const kind = r.pick(['extension', 'constant', 'energy'] as const);
      if (kind === 'extension') {
        const F2 = F1 * r.pick([1.5, 2, 3, 0.5, 2.5]);
        const e2 = (e1 * F2) / F1;
        return {
          stem: `A spring stretches by ${qty(e1, U.cm)} under a load of ${qty(F1, U.N)}. Within its elastic limit, how much will it stretch under ${qty(F2, U.N)}?`,
          ...choices(U.cm, e2, [(e1 * F1) / F2, e1 + F2 - F1, e1, e2 * 2]),
          explanation: `Hooke's law: extension is proportional to load. ${m(`e = ${num(e1)} \\times \\frac{${num(F2)}}{${F1}} = ${sci(e2)}`)} cm.`,
        };
      }
      if (kind === 'constant') {
        return {
          stem: `A load of ${qty(F1, U.N)} stretches a spring by ${qty(e1, U.cm)}. What is the force constant of the spring?`,
          ...choices(U.Nm, k, [F1 / e1, F1 * e1, k / 100, F1 * (e1 / 100)]),
          explanation: `Change the extension to metres first: ${num(e1)} cm = ${num(e1 / 100)} m.\n${m(`k = \\frac{F}{e} = \\frac{${F1}}{${num(e1 / 100)}} = ${sci(k)}`)} N/m.`,
        };
      }
      const E = 0.5 * F1 * (e1 / 100);
      return {
        stem: `A force of ${qty(F1, U.N)} stretches a spring by ${qty(e1, U.cm)}. How much energy is stored in the spring?`,
        ...choices(U.J, E, [F1 * (e1 / 100), 0.5 * F1 * e1, F1 * e1, E / 2]),
        explanation: `Energy stored = ${m('\\tfrac{1}{2}Fe')}, with e in metres (${num(e1 / 100)} m).\n${m(`E = \\tfrac{1}{2} \\times ${F1} \\times ${num(e1 / 100)} = ${sci(E)}`)} J.`,
      };
    },
  },
  {
    key: 'jamb-physics/youngs-modulus',
    topic: [MAT, 'Elasticity'],
    difficulty: 4,
    make: (r) => {
      if (r.chance(0.4)) {
        const stress = r.pick([1, 2, 4, 5, 8]) * 10 ** r.pick([6, 7]);
        const L = r.pick([10, 20, 50, 100, 200]);
        const e = L * r.pick([0.001, 0.002, 0.005, 0.0025]);
        const E = stress / (e / L);
        return {
          stem: `A wire ${qty(L, U.cm)} long is stretched by ${qty(e, U.cm, 4)} when the stress in it is ${qty(stress, U.Pa)}. What is the Young's modulus of the wire?`,
          ...choices(U.Pa, E, [stress * (e / L), stress / e, (stress * L) / (e * 100), stress / (e / L) / 100]),
          explanation: `Strain = ${m(`\\frac{e}{L} = \\frac{${sci(e, 4)}}{${L}} = ${sci(e / L)}`)} (no unit).\n${m(`E = \\frac{\\text{stress}}{\\text{strain}} = \\frac{${sci(stress)}}{${sci(e / L)}} = ${sci(E)}`)} N m⁻².`,
          difficulty: 3,
        };
      }
      const mass = r.pick([2, 4, 5, 10, 20]);
      const areaMm2 = r.pick([0.5, 1, 1.5, 2, 2.5]);
      const L = r.pick([1, 1.5, 2, 2.5, 3]);
      const eMm = r.pick([0.5, 1, 1.2, 1.5, 2]);
      const F = mass * G;
      const A = areaMm2 * 1e-6;
      const E = F / A / (eMm / 1000 / L);
      return {
        stem: `A wire ${qty(L, U.m)} long with a cross-sectional area of ${m(`${num(areaMm2)}\\,\\text{mm}^2`)} stretches by ${qty(eMm, U.mm)} when a ${qty(mass, U.kg)} mass hangs from it. What is the Young's modulus? (Take ${m(`g = ${G}\\,${U.ms2}`)}.)`,
        ...choices(U.Pa, E, [E / 1000, F / A, mass / A / (eMm / 1000 / L), E * 1000]),
        explanation: `Put everything in S.I. units: ${m(`A = ${num(areaMm2)} \\times 10^{-6}`)} m², ${m(`e = ${num(eMm / 1000)}`)} m, ${m(`F = ${mass} \\times ${G} = ${F}`)} N.\nStress = ${m(`\\frac{F}{A} = ${sci(F / A)}`)} N m⁻²; strain = ${m(`\\frac{e}{L} = ${sci(eMm / 1000 / L)}`)}.\n${m(`E = \\frac{${sci(F / A)}}{${sci(eMm / 1000 / L)}} = ${sci(E)}`)} N m⁻².`,
      };
    },
  },

  // ── Pressure, upthrust, floating ───────────────────────
  {
    key: 'jamb-physics/liquid-pressure',
    topic: [MAT, 'Pressure in fluids'],
    difficulty: 2,
    make: (r) => {
      const rho = r.pick([1000, 800, 1200, 13_600, 2000]);
      const liquid = rho === 1000 ? 'water' : rho === 13_600 ? 'mercury' : `a liquid of density ${qty(rho, U.kgm3)}`;
      const kind = r.pick(['pressure', 'depth', 'total', 'barometer'] as const);
      if (kind === 'barometer') {
        const hmm = r.pick([700, 720, 740, 750, 760]);
        const P = (hmm / 1000) * 13_600 * G;
        return {
          stem: `A mercury barometer reads ${qty(hmm, U.mm)}. What is the atmospheric pressure? (Density of mercury = ${qty(13_600, U.kgm3)}; ${m(`g = ${G}\\,${U.ms2}`)}.)`,
          ...choices(U.Pa, P, [hmm * 13_600 * G, P / G, (hmm / 100) * 13_600 * G, (hmm / 1000) * 1000 * G]),
          explanation: `${m('P = h\\rho g')} with h in metres (${num(hmm / 1000)} m).\n${m(`P = ${num(hmm / 1000)} \\times 13{,}600 \\times ${G} = ${sci(P)}`)} N m⁻².`,
        };
      }
      const h = r.pick([2, 5, 8, 10, 12, 15, 20, 30]);
      const P = h * rho * G;
      if (kind === 'depth') {
        return {
          stem: `At what depth in ${liquid} is the pressure due to the liquid ${qty(P, U.Pa)}? (Take ${m(`g = ${G}\\,${U.ms2}`)}.)`,
          ...choices(U.m, h, [P / rho, P / G, (P * G) / rho, h * 10]),
          explanation: `${m('P = h\\rho g')}, so ${m(`h = \\frac{P}{\\rho g} = \\frac{${sci(P)}}{${rho} \\times ${G}} = ${sci(h)}`)} m.`,
        };
      }
      if (kind === 'total' && rho === 1000) {
        const P0 = 1.0e5;
        return {
          stem: `What is the total pressure at a depth of ${qty(h, U.m)} in a lake, if atmospheric pressure is ${qty(P0, U.Pa)}? (Density of water = ${qty(1000, U.kgm3)}; ${m(`g = ${G}\\,${U.ms2}`)}.)`,
          ...choices(U.Pa, P0 + P, [P, P0, P0 - P, P0 + h * 1000]),
          explanation: `Water pressure = ${m(`h\\rho g = ${h} \\times 1000 \\times ${G} = ${sci(P)}`)} N m⁻².\nAdd the air pressure on the surface: ${m(`${sci(P0)} + ${sci(P)} = ${sci(P0 + P)}`)} N m⁻².`,
          difficulty: 3,
        };
      }
      return {
        stem: `What is the pressure due to ${liquid} at a depth of ${qty(h, U.m)}? (Take ${m(`g = ${G}\\,${U.ms2}`)}.)`,
        ...choices(U.Pa, P, [h * rho, (rho * G) / h, P * 10, h * G]),
        explanation: `${m(`P = h\\rho g = ${h} \\times ${rho} \\times ${G} = ${sci(P)}`)} N m⁻².`,
      };
    },
  },
  {
    key: 'jamb-physics/hydraulic-press',
    topic: [MAT, 'Pressure in fluids'],
    difficulty: 2,
    make: (r) => {
      const F = r.pick([20, 25, 40, 50, 100, 200]);
      if (r.chance(0.5)) {
        const a = r.pick([0.01, 0.02, 0.05, 0.1]);
        const A = a * r.pick([5, 10, 20, 25, 40, 50]);
        const load = (F * A) / a;
        return {
          stem: `In a hydraulic press, the small piston has an area of ${m(`${num(a)}\\,\\text{m}^2`)} and the large piston ${m(`${num(A)}\\,\\text{m}^2`)}. What load can an effort of ${qty(F, U.N)} on the small piston support?`,
          ...choices(U.N, load, [(F * a) / A, F * A, F + A / a, load / 2]),
          explanation: `Pressure is passed on equally: ${m('\\frac{F}{a} = \\frac{W}{A}')}.\n${m(`W = ${F} \\times \\frac{${num(A)}}{${num(a)}} = ${sci(load)}`)} N.`,
        };
      }
      const k = r.pick([2, 3, 4, 5, 10]);
      const load = F * k * k;
      return {
        stem: `The large piston of a hydraulic jack has ${k} times the radius of the small piston. What load can an effort of ${qty(F, U.N)} on the small piston lift?`,
        ...choices(U.N, load, [F * k, F * 2 * k, F * k * k * k, F / (k * k)]),
        explanation: `Area goes with the square of the radius, so the large piston has ${m(`${k}^2 = ${k * k}`)} times the area.\nLoad = ${F} × ${k * k} = ${num(load)} N.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-physics/relative-density',
    topic: [MAT, 'Upthrust and floatation'],
    difficulty: 3,
    make: (r) => {
      const kind = r.pick(['solid', 'liquid', 'bottle'] as const);
      if (kind === 'bottle') {
        const empty = r.pick([15, 18, 19, 20, 25, 30]);
        const water = r.pick([40, 47, 50, 60]);
        const rd = r.pick([0.8, 0.9, 1.2, 1.5, 0.75, 1.1]);
        const full = empty + water * rd;
        return {
          stem: `A relative density bottle has a mass of ${qty(empty, U.g)} when empty and ${qty(empty + water, U.g)} when full of water. What is its mass when full of a liquid of relative density ${num(rd)}?`,
          ...choices(U.g, full, [(empty + water) * rd, water * rd, empty + water / rd, full + empty]),
          explanation: `The water inside has mass ${empty + water} − ${empty} = ${water} g. The same volume of liquid has mass ${m(`${num(rd)} \\times ${water} = ${sci(water * rd)}`)} g.\nBottle + liquid = ${empty} + ${sci(water * rd)} = ${sci(full)} g.`,
        };
      }
      const W = r.pick([10, 12, 15, 20, 24, 30]);
      const loseWater = r.pick([2, 3, 4, 5, 6]);
      if (loseWater >= W) return null;
      const Ww = W - loseWater;
      if (kind === 'solid') {
        return {
          stem: `A solid weighs ${qty(W, U.N)} in air and ${qty(Ww, U.N)} when fully immersed in water. What is its relative density?`,
          ...choices(U.none, W / loseWater, [W / Ww, Ww / W, loseWater / W, Ww / loseWater]),
          explanation: `Upthrust in water = loss in weight = ${W} − ${Ww} = ${loseWater} N.\nRelative density = ${m(`\\frac{\\text{weight in air}}{\\text{loss in water}} = \\frac{${W}}{${loseWater}} = ${sci(W / loseWater)}`)}.`,
        };
      }
      const loseLiquid = r.pick([1, 2, 3, 4, 5, 7, 8].filter((x) => x !== loseWater && x < W));
      const Wl = W - loseLiquid;
      return {
        stem: `A solid weighs ${qty(W, U.N)} in air, ${qty(Ww, U.N)} when fully immersed in water and ${qty(Wl, U.N)} when fully immersed in a liquid X. What is the relative density of X?`,
        ...choices(U.none, loseLiquid / loseWater, [loseWater / loseLiquid, Wl / Ww, W / loseLiquid, W / loseWater]),
        explanation: `Loss in weight in X = ${W} − ${Wl} = ${loseLiquid} N; in water = ${W} − ${Ww} = ${loseWater} N.\nRelative density of X = ${m(`\\frac{${loseLiquid}}{${loseWater}} = ${sci(loseLiquid / loseWater)}`)}.`,
        difficulty: 4,
      };
    },
  },
  {
    key: 'jamb-physics/floating',
    topic: [MAT, 'Upthrust and floatation'],
    difficulty: 2,
    make: (r) => {
      const rho = r.pick([400, 500, 600, 700, 750, 800, 900]);
      const liquid = r.pick([1000, 1000, 1200, 800].filter((x) => x > rho));
      const frac = rho / liquid;
      const lname = liquid === 1000 ? 'water' : `a liquid of density ${qty(liquid, U.kgm3)}`;
      if (r.chance(0.5)) {
        return {
          stem: `A block of wood of density ${qty(rho, U.kgm3)} floats in ${lname}. What fraction of its volume is under the surface?`,
          ...choices(U.none, frac, [1 - frac, liquid / rho, frac / 2, rho / (rho + liquid)]),
          explanation: `A floating body displaces its own weight of liquid: ${m('V_{under}\\rho_{liquid} = V\\rho_{wood}')}.\nFraction under = ${m(`\\frac{${rho}}{${liquid}} = ${sci(frac)}`)}.`,
        };
      }
      const V = r.pick([100, 200, 250, 400, 500]);
      const above = V * (1 - frac);
      return {
        stem: `A block of volume ${m(`${V}\\,\\text{cm}^3`)} and density ${qty(rho, U.kgm3)} floats in ${lname}. What volume of the block is above the surface?`,
        answer: m(`${sci(above)}\\,\\text{cm}^3`),
        wrong: [V * frac, V / 2, (V * (liquid - rho)) / rho, 2 * above].map((x) => m(`${sci(x)}\\,\\text{cm}^3`)),
        explanation: `Fraction under the surface = ${m(`\\frac{${rho}}{${liquid}} = ${sci(frac)}`)}, so ${sci(V * frac)} cm³ is under.\nAbove = ${V} − ${sci(V * frac)} = ${sci(above)} cm³.`,
        difficulty: 3,
      };
    },
  },

  // ── Gas laws ───────────────────────────────────────────
  {
    key: 'jamb-physics/boyle',
    topic: [MAT, 'Diffusion and kinetic theory'],
    difficulty: 2,
    make: (r) => {
      if (r.chance(0.3)) {
        const H = 10;
        const k = r.pick([2, 3, 4, 8]);
        const depth = H * (k - 1);
        return {
          stem: `An air bubble rises from the bottom of a lake ${qty(depth, U.m)} deep to the surface. Atmospheric pressure is equal to ${qty(H, U.m)} of water. If the temperature stays the same, by what factor does the bubble's volume increase?`,
          ...choices(U.none, k, [depth / H, k - 1 + 0.5, k * k, (depth + H) / depth]),
          explanation: `Pressure at the bottom = ${H} + ${depth} = ${H + depth} m of water; at the top = ${H} m.\nBoyle's law: ${m(`V_2 = V_1 \\times \\frac{${H + depth}}{${H}} = ${k}V_1`)}. The volume grows ${k} times.`,
          difficulty: 4,
        };
      }
      const P1 = r.pick([1, 1.5, 2, 3, 4, 5]) * 10 ** 5;
      const V1 = r.pick([100, 120, 200, 240, 300, 500, 600]);
      const V2 = V1 * r.pick([0.5, 0.25, 2, 1.5, 0.75, 4, 0.2]);
      const P2 = (P1 * V1) / V2;
      return {
        stem: `A gas occupies ${m(`${V1}\\,\\text{cm}^3`)} at a pressure of ${qty(P1, U.Pa)}. At constant temperature, what pressure will make it occupy ${m(`${num(V2)}\\,\\text{cm}^3`)}?`,
        ...choices(U.Pa, P2, [(P1 * V2) / V1, P1, P1 + (V1 - V2) * 1000, P2 * 2]),
        explanation: `Boyle's law: ${m('P_1V_1 = P_2V_2')}.\n${m(`P_2 = \\frac{${sci(P1)} \\times ${V1}}{${num(V2)}} = ${sci(P2)}`)} N m⁻².`,
      };
    },
  },
  {
    key: 'jamb-physics/gas-temperature',
    topic: [MAT, 'Diffusion and kinetic theory'],
    difficulty: 3,
    make: (r) => {
      const [c1, c2] = r.shuffle(KELVIN_FRIENDLY).slice(0, 2);
      const [T1, T2] = [K(c1), K(c2)];
      const law = r.pick(['pressure', 'charles', 'general'] as const);
      if (law === 'pressure') {
        const P1 = r.pick([60, 80, 100, 120, 150, 200, 300]);
        const P2 = (P1 * T2) / T1;
        if (c1 === 0) return null;
        return {
          stem: `A fixed mass of gas has a pressure of ${qty(P1, U.Pa)} at ${qty(c1, U.C)}. If its volume stays the same, what is its pressure at ${qty(c2, U.C)}?`,
          ...choices(
            U.Pa,
            P2,
            [(P1 * c2) / c1, (P1 * T1) / T2, P1 + (c2 - c1), P1, P2 * 2].filter((x) => x > 0),
          ),
          explanation: `Change to kelvin first: ${c1} °C = ${T1} K and ${c2} °C = ${T2} K.\nPressure law: ${m(`P_2 = P_1 \\times \\frac{T_2}{T_1} = ${P1} \\times \\frac{${T2}}{${T1}} = ${sci(P2)}`)} N m⁻².`,
        };
      }
      if (law === 'charles') {
        const V1 = r.pick([100, 150, 200, 240, 300, 400, 600]);
        const V2 = (V1 * T2) / T1;
        if (c1 === 0) return null;
        return {
          stem: `A gas occupies ${m(`${V1}\\,\\text{cm}^3`)} at ${qty(c1, U.C)}. At constant pressure, what volume will it occupy at ${qty(c2, U.C)}?`,
          answer: m(`${sci(V2)}\\,\\text{cm}^3`),
          wrong: [(V1 * c2) / c1, (V1 * T1) / T2, V1 + (c2 - c1), V2 * 2].filter((x) => x > 0).map((x) => m(`${sci(x)}\\,\\text{cm}^3`)),
          explanation: `Change to kelvin: ${T1} K and ${T2} K.\nCharles's law: ${m(`V_2 = V_1 \\times \\frac{T_2}{T_1} = ${V1} \\times \\frac{${T2}}{${T1}} = ${sci(V2)}`)} cm³.`,
        };
      }
      const P1 = r.pick([1, 2, 3, 4]) * 10 ** 5;
      const V1 = r.pick([200, 300, 400, 600]);
      const V2 = V1 * r.pick([0.5, 2, 0.25, 1.5]);
      const P2 = (P1 * V1 * T2) / (T1 * V2);
      return {
        stem: `A gas occupies ${m(`${V1}\\,\\text{cm}^3`)} at ${qty(P1, U.Pa)} and ${qty(c1, U.C)}. What will its pressure be if it is compressed to ${m(`${num(V2)}\\,\\text{cm}^3`)} at ${qty(c2, U.C)}?`,
        ...choices(U.Pa, P2, [(P1 * V1) / V2, (P1 * V1 * T1) / (T2 * V2), c1 ? (P1 * V1 * c2) / (c1 * V2) : (P1 * V2) / V1, (P1 * V2 * T2) / (V1 * T1)]),
        explanation: `${m('\\frac{P_1V_1}{T_1} = \\frac{P_2V_2}{T_2}')}, with temperatures in kelvin (${T1} K and ${T2} K).\n${m(`P_2 = \\frac{${sci(P1)} \\times ${V1} \\times ${T2}}{${T1} \\times ${num(V2)}} = ${sci(P2)}`)} N m⁻².`,
        difficulty: 4,
      };
    },
  },

  // ── Temperature ────────────────────────────────────────
  {
    key: 'jamb-physics/thermometer-scale',
    topic: [HEAT, 'Measurement of temperature'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['length', 'resistance', 'kelvin'] as const);
      if (kind === 'kelvin') {
        const c = r.int(-50, 150);
        if (r.chance(0.5)) {
          return {
            stem: `What is ${qty(c, U.C)} on the kelvin scale?`,
            ...choices(U.K, c + 273, [c - 273, 273 - c, c + 100, c + 373]),
            explanation: `${m('T = \\theta + 273')}: ${c} + 273 = ${c + 273} K.`,
          };
        }
        return {
          stem: `A temperature of ${qty(c + 273, U.K)} is the same as`,
          ...choices(U.C, c, [c + 546, c - 273, c + 100, 273 - c]),
          explanation: `${m('\\theta = T - 273')}: ${c + 273} − 273 = ${c} °C.`,
          difficulty: 1,
        };
      }
      const t = r.pick([20, 25, 30, 35, 40, 45, 50, 60, 64, 70, 75, 80]);
      if (kind === 'length') {
        const l0 = r.pick([10, 15, 20, 25, 30]);
        const span = r.pick([150, 180, 200, 210, 240, 250]);
        const lt = l0 + (span * t) / 100;
        if (!Number.isInteger(lt * 10)) return null;
        return {
          stem: `The mercury column of an unmarked thermometer is ${qty(l0, U.mm)} long in melting ice and ${qty(l0 + span, U.mm)} long in steam. What temperature does a length of ${qty(lt, U.mm)} show?`,
          ...choices(U.C, t, [(lt / (l0 + span)) * 100, ((lt - l0) / (l0 + span)) * 100, lt - l0, (lt / span) * 100]),
          explanation: `${m(`\\theta = \\frac{l_\\theta - l_0}{l_{100} - l_0} \\times 100 = \\frac{${sci(lt)} - ${l0}}{${l0 + span} - ${l0}} \\times 100 = ${t}`)} °C.`,
        };
      }
      const R0 = r.pick([20, 25, 40, 50, 80, 100]);
      const dR = r.pick([10, 20, 25, 40, 50]);
      const Rt = R0 + (dR * t) / 100;
      return {
        stem: `A platinum resistance thermometer reads ${qty(R0, U.ohm)} at the ice point and ${qty(R0 + dR, U.ohm)} at the steam point. What temperature gives a reading of ${qty(Rt, U.ohm)}?`,
        ...choices(U.C, t, [(Rt / (R0 + dR)) * 100, Rt - R0, ((Rt - R0) / (R0 + dR)) * 100, (Rt / dR) * 100]),
        explanation: `${m(`\\theta = \\frac{R_\\theta - R_0}{R_{100} - R_0} \\times 100 = \\frac{${sci(Rt)} - ${R0}}{${dR}} \\times 100 = ${t}`)} °C.`,
      };
    },
  },
  {
    key: 'jamb-physics/thermal-expansion',
    topic: [HEAT, 'Thermal expansion'],
    difficulty: 3,
    make: (r) => {
      const a = r.pick([1.2, 1.7, 1.9, 2, 2.5]) * 1e-5;
      const dT = r.pick([50, 80, 100, 120, 150, 200]);
      const kind = r.pick(['length', 'volume', 'alpha'] as const);
      if (kind === 'volume') {
        const V = r.pick([10, 20, 50, 100, 200]);
        const V2 = V * (1 + 3 * a * dT);
        return {
          stem: `The linear expansivity of brass is ${qty(a, U.perK)}. A piece of brass has a volume of ${m(`${V}\\,\\text{cm}^3`)} at ${qty(0, U.C)}. What is its volume at ${qty(dT, U.C)}?`,
          answer: m(`${sci(V2, 6)}\\,\\text{cm}^3`),
          wrong: [V * (1 + a * dT), V * (1 + 2 * a * dT), V * 3 * a * dT, V * (1 + 6 * a * dT)].map((x) => m(`${sci(x, 6)}\\,\\text{cm}^3`)),
          explanation: `Cubic expansivity is three times the linear: ${m(`\\gamma = 3\\alpha = ${sci(3 * a)}`)} K⁻¹.\n${m(`V = V_0(1 + \\gamma\\Delta\\theta) = ${V}(1 + ${sci(3 * a)} \\times ${dT}) = ${sci(V2, 6)}`)} cm³.`,
          difficulty: 4,
        };
      }
      const L = r.pick([50, 100, 200, 500, 1000]);
      const dL = L * a * dT;
      if (kind === 'alpha') {
        return {
          stem: `A metal rod ${qty(L, U.cm)} long expands by ${qty(dL, U.cm, 4)} when heated through ${qty(dT, U.K)}. What is the linear expansivity of the metal?`,
          ...choices(U.perK, a, [dL / dT, dL / (L * dT) / 3, (L * dT) / dL, dL / L]),
          explanation: `${m(`\\alpha = \\frac{\\Delta L}{L\\,\\Delta\\theta} = \\frac{${sci(dL, 4)}}{${L} \\times ${dT}} = ${sci(a)}`)} K⁻¹.`,
        };
      }
      return {
        stem: `A metal rod is ${qty(L, U.cm)} long at ${qty(20, U.C)}. Its linear expansivity is ${qty(a, U.perK)}. How long is it at ${qty(20 + dT, U.C)}?`,
        answer: qty(L + dL, U.cm, 6),
        wrong: [L + 3 * dL, L + dL * 10, L - dL, L + dL / 2].map((x) => qty(x, U.cm, 6)),
        explanation: `${m(`\\Delta L = L\\alpha\\Delta\\theta = ${L} \\times ${sci(a)} \\times ${dT} = ${sci(dL, 4)}`)} cm.\nNew length = ${L} + ${sci(dL, 4)} = ${sci(L + dL, 6)} cm.`,
      };
    },
  },
  {
    key: 'jamb-physics/heat-conduction',
    topic: [HEAT, 'Heat transfer'],
    difficulty: 3,
    make: (r) => {
      const d = r.pick([0.01, 0.02, 0.04, 0.05, 0.1, 0.2]);
      const t1 = r.pick([0, 10, 20, 25, 30]);
      const t2 = t1 + r.pick([20, 40, 50, 60, 80, 100]);
      const grad = (t2 - t1) / d;
      if (r.chance(0.5)) {
        return {
          stem: `The two faces of a copper slab ${qty(d, U.m)} thick are kept at ${qty(t1, U.C)} and ${qty(t2, U.C)}. What is the temperature gradient across it?`,
          answer: m(`${sci(grad)}\\,\\text{K m}^{-1}`),
          wrong: [(t2 - t1) * d, (t2 + t1) / d, t2 / d, (t2 - t1) / (d * 100)].map((x) => m(`${sci(x)}\\,\\text{K m}^{-1}`)),
          explanation: `Temperature gradient = ${m(`\\frac{\\theta_2 - \\theta_1}{d} = \\frac{${t2} - ${t1}}{${num(d)}} = ${sci(grad)}`)} K m⁻¹.`,
        };
      }
      const k = r.pick([0.8, 1, 50, 200, 400]);
      const A = r.pick([0.5, 1, 2, 0.01, 0.05]);
      const rate = (k * A * (t2 - t1)) / d;
      return {
        stem: `A slab ${qty(d, U.m)} thick with a face area of ${m(`${num(A)}\\,\\text{m}^2`)} has its faces at ${qty(t1, U.C)} and ${qty(t2, U.C)}. Its thermal conductivity is ${m(`${num(k)}\\,\\text{W m}^{-1}\\,\\text{K}^{-1}`)}. How much heat flows through it each second?`,
        ...choices(U.W, rate, [k * A * (t2 - t1) * d, (k * (t2 - t1)) / d, (k * A * t2) / d, rate / 2]),
        explanation: `${m(`\\frac{Q}{t} = \\frac{kA(\\theta_2 - \\theta_1)}{d} = \\frac{${num(k)} \\times ${num(A)} \\times ${t2 - t1}}{${num(d)}} = ${sci(rate)}`)} W.`,
        difficulty: 4,
      };
    },
  },

  // ── Quantity of heat ───────────────────────────────────
  {
    key: 'jamb-physics/heat-mc-dt',
    topic: [HEAT, 'Quantity of heat and calorimetry'],
    difficulty: 1,
    make: (r) => {
      const [name, c] = r.pick([
        ['water', 4200],
        ['copper', 400],
        ['aluminium', 900],
        ['iron', 450],
        ['a liquid', 2100],
      ] as const);
      const grams = r.chance(0.4);
      const mass = grams ? r.pick([100, 200, 250, 500]) : r.pick([0.5, 1, 2, 3, 5]);
      const mk = grams ? mass / 1000 : mass;
      const dT = r.pick([5, 10, 20, 25, 40, 50, 80]);
      const Q = mk * c * dT;
      if (r.chance(0.6)) {
        return {
          stem: `How much heat is needed to raise the temperature of ${grams ? qty(mass, U.g) : qty(mass, U.kg)} of ${name} by ${qty(dT, U.K)}? (Specific heat capacity of ${name} = ${qty(c, U.JkgK)}.)`,
          ...choices(U.J, Q, [grams ? Q * 1000 : Q * 10, mk * c, (mk * dT) / c, Q / 2]),
          explanation: `${grams ? `Change grams to kilograms: ${mass} g = ${num(mk)} kg.\n` : ''}${m(`Q = mc\\Delta\\theta = ${num(mk)} \\times ${c} \\times ${dT} = ${sci(Q)}`)} J.`,
          difficulty: grams ? 2 : 1,
        };
      }
      return {
        stem: `${qty(Q, U.J)} of heat raises the temperature of ${qty(mk, U.kg)} of ${name} by ${qty(dT, U.K)}. What is its specific heat capacity?`,
        ...choices(U.JkgK, c, [Q / dT, Q / mk, (Q * mk * dT) / 1000, c * 2]),
        explanation: `${m(`c = \\frac{Q}{m\\Delta\\theta} = \\frac{${sci(Q)}}{${num(mk)} \\times ${dT}} = ${c}`)} J kg⁻¹ K⁻¹.`,
        difficulty: 2,
      };
    },
  },
  {
    key: 'jamb-physics/latent-heat',
    topic: [HEAT, 'Quantity of heat and calorimetry'],
    difficulty: 2,
    make: (r) => {
      const grams = r.pick([10, 20, 50, 100, 200, 500]);
      const mk = grams / 1000;
      const kind = r.pick(['melt', 'ice-to-water', 'boil'] as const);
      if (kind === 'melt') {
        const Q = mk * L_ICE;
        return {
          stem: `How much heat is needed to melt ${qty(grams, U.g)} of ice at ${qty(0, U.C)} into water at ${qty(0, U.C)}? (Specific latent heat of fusion of ice = ${qty(L_ICE, U.Jkg)}.)`,
          ...choices(U.J, Q, [grams * L_ICE, mk * L_ICE * 100, mk * C_WATER, Q + mk * C_WATER * 100]),
          explanation: `The temperature doesn't change, so only latent heat is needed: ${m(`Q = mL = ${num(mk)} \\times ${sci(L_ICE)} = ${sci(Q)}`)} J.`,
        };
      }
      if (kind === 'ice-to-water') {
        const below = r.pick([5, 10, 20]);
        const above = r.pick([10, 20, 30, 50]);
        const q1 = mk * C_ICE * below;
        const q2 = mk * L_ICE;
        const q3 = mk * C_WATER * above;
        return {
          stem: `How much heat is needed to change ${qty(grams, U.g)} of ice at ${qty(-below, U.C)} into water at ${qty(above, U.C)}? (Specific heat capacity of ice = ${qty(C_ICE, U.JkgK)}; of water = ${qty(C_WATER, U.JkgK)}; latent heat of fusion = ${qty(L_ICE, U.Jkg)}.)`,
          ...choices(U.J, q1 + q2 + q3, [q1 + q3, q2 + q3, q1 + q2, mk * C_WATER * (below + above) + q2]),
          explanation: `Three steps:\nWarm the ice to 0 °C: ${m(`${num(mk)} \\times ${C_ICE} \\times ${below} = ${sci(q1)}`)} J.\nMelt it: ${m(`${num(mk)} \\times ${sci(L_ICE)} = ${sci(q2)}`)} J.\nWarm the water to ${above} °C: ${m(`${num(mk)} \\times ${C_WATER} \\times ${above} = ${sci(q3)}`)} J.\nTotal = ${m(sci(q1 + q2 + q3))} J.`,
          difficulty: 4,
        };
      }
      const from = r.pick([20, 30, 50, 80]);
      const q1 = mk * C_WATER * (100 - from);
      const q2 = mk * L_STEAM;
      return {
        stem: `How much heat is needed to turn ${qty(grams, U.g)} of water at ${qty(from, U.C)} completely into steam at ${qty(100, U.C)}? (Specific heat capacity of water = ${qty(C_WATER, U.JkgK)}; latent heat of vaporisation = ${qty(L_STEAM, U.Jkg)}.)`,
        ...choices(U.J, q1 + q2, [q2, q1, mk * C_WATER * 100 + q2, q1 + mk * L_ICE]),
        explanation: `Heat the water to 100 °C: ${m(`${num(mk)} \\times ${C_WATER} \\times ${100 - from} = ${sci(q1)}`)} J.\nBoil it away: ${m(`${num(mk)} \\times ${sci(L_STEAM)} = ${sci(q2)}`)} J.\nTotal = ${m(sci(q1 + q2))} J.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-physics/electrical-heating',
    topic: [HEAT, 'Quantity of heat and calorimetry'],
    difficulty: 2,
    make: (r) => {
      const P = r.pick([50, 100, 200, 500, 1000, 2000]);
      const mass = r.pick([0.01, 0.1, 0.2, 0.5, 1, 2]);
      const c = r.pick([400, 900, 2000, 2100, 4200]);
      const dT = r.pick([5, 10, 20, 25, 40, 50]);
      const t = (mass * c * dT) / P;
      if (t < 5 || t > 3600 || !Number.isInteger(t)) return null;
      if (r.chance(0.5)) {
        return {
          stem: `A ${qty(P, U.W)} heater warms ${qty(mass, U.kg)} of a liquid of specific heat capacity ${qty(c, U.JkgK)}. Ignoring heat losses, how long does it take to raise its temperature by ${qty(dT, U.K)}?`,
          ...choices(U.s, t, [P / (mass * c * dT), (mass * c) / P, t * 60, (c * dT) / P]),
          explanation: `Electrical energy = heat gained: ${m('Pt = mc\\Delta\\theta')}.\n${m(`t = \\frac{${num(mass)} \\times ${c} \\times ${dT}}{${P}} = ${sci(t)}`)} s.`,
        };
      }
      return {
        stem: `Heat is supplied at ${qty(P, U.W)} to ${qty(mass, U.kg)} of a liquid for ${qty(t, U.s)}, and its temperature rises by ${qty(dT, U.K)}. Ignoring heat losses, what is the specific heat capacity of the liquid?`,
        ...choices(U.JkgK, c, [(P * t) / dT, (P * t) / mass, (P * dT) / (mass * t), c / 10]),
        explanation: `${m(`c = \\frac{Pt}{m\\Delta\\theta} = \\frac{${P} \\times ${sci(t)}}{${num(mass)} \\times ${dT}} = ${c}`)} J kg⁻¹ K⁻¹.`,
      };
    },
  },
  {
    key: 'jamb-physics/mixtures',
    topic: [HEAT, 'Quantity of heat and calorimetry'],
    difficulty: 4,
    make: (r) => {
      const [metal, cm] = r.pick([
        ['copper', 400],
        ['iron', 450],
        ['aluminium', 900],
      ] as const);
      const mm = r.pick([0.1, 0.2, 0.5, 1]);
      const mw = r.pick([0.1, 0.2, 0.3, 0.5]);
      const Th = r.pick([80, 90, 100]);
      const Tc = r.pick([20, 25, 30]);
      const T = (mm * cm * Th + mw * C_WATER * Tc) / (mm * cm + mw * C_WATER);
      return {
        stem: `A ${qty(mm, U.kg)} block of ${metal} at ${qty(Th, U.C)} is dropped into ${qty(mw, U.kg)} of water at ${qty(Tc, U.C)}. Ignoring heat losses, what is the final temperature? (Specific heat capacity of ${metal} = ${qty(cm, U.JkgK)}; of water = ${qty(C_WATER, U.JkgK)}.)`,
        ...choices(U.C, T, [(Th + Tc) / 2, (mm * Th + mw * Tc) / (mm + mw), Th - (T - Tc), (cm * Th + C_WATER * Tc) / (cm + C_WATER) + 3]),
        explanation: `Heat lost by the ${metal} = heat gained by the water:\n${m(`${num(mm)} \\times ${cm} \\times (${Th} - T) = ${num(mw)} \\times ${C_WATER} \\times (T - ${Tc})`)}.\nSolving, ${m(`T = \\frac{${sci(mm * cm * Th)} + ${sci(mw * C_WATER * Tc)}}{${sci(mm * cm)} + ${sci(mw * C_WATER)}} = ${sci(T)}`)} °C.`,
      };
    },
  },
  {
    key: 'jamb-physics/humidity',
    topic: [HEAT, 'Vapours and humidity'],
    difficulty: 2,
    make: (r) => {
      const svp = r.pick([17.5, 23.8, 31.8, 42.2, 55.3]);
      const t = { 17.5: 20, 23.8: 25, 31.8: 30, 42.2: 35, 55.3: 40 }[svp]!;
      const p = Number((svp * r.pick([0.4, 0.5, 0.6, 0.7, 0.75, 0.8])).toFixed(1));
      const rh = (p / svp) * 100;
      return {
        stem: `On a day when the air temperature is ${qty(t, U.C)}, the pressure of water vapour in the air is ${qty(p, '\\text{mmHg}')}. The saturated vapour pressure at ${t} °C is ${qty(svp, '\\text{mmHg}')}. What is the relative humidity?`,
        ...choices(U.pct, rh, [(svp / p) * 100, svp - p, (p / (svp + p)) * 100, 100 - rh]),
        explanation: `${m(`\\text{R.H.} = \\frac{\\text{vapour pressure}}{\\text{s.v.p. at air temperature}} \\times 100\\% = \\frac{${num(p)}}{${num(svp)}} \\times 100\\% = ${sci(rh)}\\%`)}.`,
      };
    },
  },
];
