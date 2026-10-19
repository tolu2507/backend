import { m, NAMES, num, type Template } from '../engine.js';
import { an, choices, cosD, G, qty, qtyDp, sci, sig, sinD, tanD, U } from './kit.js';

const MEAS = 'Measurements and Units';
const MOT = 'Motion';
const EQ = 'Equilibrium of Forces';
const WEP = 'Work, Energy and Power';

const DIMS: [string, string][] = [
  ['velocity', 'LT^{-1}'],
  ['acceleration', 'LT^{-2}'],
  ['force', 'MLT^{-2}'],
  ['momentum', 'MLT^{-1}'],
  ['pressure', 'ML^{-1}T^{-2}'],
  ['work', 'ML^{2}T^{-2}'],
  ['power', 'ML^{2}T^{-3}'],
  ['density', 'ML^{-3}'],
  ['frequency', 'T^{-1}'],
  ['volume', 'L^{3}'],
];
const BASE_UNITS: [string, string][] = [
  ['force', '\\text{kg m s}^{-2}'],
  ['pressure', '\\text{kg m}^{-1}\\,\\text{s}^{-2}'],
  ['work', '\\text{kg m}^{2}\\,\\text{s}^{-2}'],
  ['power', '\\text{kg m}^{2}\\,\\text{s}^{-3}'],
  ['momentum', '\\text{kg m s}^{-1}'],
  ['density', '\\text{kg m}^{-3}'],
  ['acceleration', '\\text{m s}^{-2}'],
];
const WHY_DIMS: Record<string, string> = {
  velocity: 'velocity = distance ÷ time',
  acceleration: 'acceleration = velocity ÷ time',
  force: 'force = mass × acceleration',
  momentum: 'momentum = mass × velocity',
  pressure: 'pressure = force ÷ area',
  work: 'work = force × distance',
  power: 'power = work ÷ time',
  density: 'density = mass ÷ volume',
  frequency: 'frequency = 1 ÷ time',
  volume: 'volume = length × length × length',
};

const TRIPLES = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [8, 15, 17],
  [9, 12, 15],
  [12, 16, 20],
  [7, 24, 25],
  [20, 21, 29],
];

export const mechanics: Template[] = [
  {
    key: 'jamb-physics/dimensions-and-units',
    topic: [MEAS, 'Physical quantities and units'],
    difficulty: 2,
    variety: 17,
    make: (r) => {
      if (r.chance(0.55)) {
        const [name, dim] = r.pick(DIMS);
        const others = r.shuffle(DIMS.filter((d) => d[0] !== name)).slice(0, 4);
        return {
          stem: `What are the dimensions of ${name}?`,
          answer: m(dim),
          wrong: others.map((d) => m(d[1])),
          explanation: `Write it in terms of mass (M), length (L) and time (T): ${WHY_DIMS[name]}.\nSo ${name} has dimensions ${m(dim)}.`,
        };
      }
      const [name, unit] = r.pick(BASE_UNITS);
      const others = r.shuffle(BASE_UNITS.filter((d) => d[0] !== name)).slice(0, 4);
      return {
        stem: `Which of these is the S.I. unit of ${name} written in base units?`,
        answer: m(unit),
        wrong: others.map((d) => m(d[1])),
        explanation: `${WHY_DIMS[name][0].toUpperCase()}${WHY_DIMS[name].slice(1)}. Replace each quantity with its base unit (kg, m, s).\nSo the unit of ${name} is ${m(unit)}.`,
      };
    },
  },
  {
    key: 'jamb-physics/displacement',
    topic: [MEAS, 'Position, distance and displacement'],
    difficulty: 2,
    make: (r) => {
      const [a, b, c] = r.pick(TRIPLES);
      const k = r.pick([1, 1, 2, 10]);
      const [d1, d2] = r.pick([
        ['east', 'north'],
        ['north', 'west'],
        ['west', 'south'],
        ['south', 'east'],
      ]);
      const who = r.pick(NAMES);
      const askDistance = r.chance(0.25);
      const x = a * k;
      const y = b * k;
      const z = c * k;
      if (askDistance) {
        return {
          stem: `${who} walks ${qty(x, U.m)} due ${d1} and then ${qty(y, U.m)} due ${d2}. What is the difference between the total distance walked and the magnitude of the displacement?`,
          answer: qty(x + y - z, U.m),
          wrong: [qty(x + y, U.m), qty(z, U.m), qty(Math.abs(y - x), U.m), qty(x + y + z, U.m)],
          explanation: `Distance is the whole path: ${x} + ${y} = ${x + y} m.\nDisplacement is the straight line from start to finish: ${m(`\\sqrt{${x}^2 + ${y}^2} = ${z}`)} m.\nDifference = ${x + y} − ${z} = ${x + y - z} m.`,
          difficulty: 3,
        };
      }
      return {
        stem: `${who} walks ${qty(x, U.m)} due ${d1} and then ${qty(y, U.m)} due ${d2}. What is the magnitude of the displacement?`,
        answer: qty(z, U.m),
        wrong: [qty(x + y, U.m), qty(Math.abs(y - x), U.m), qty((x + y) / 2, U.m), qty(z * 2, U.m)],
        explanation: `The two walks are at right angles, so the displacement is the hypotenuse: ${m(`\\sqrt{${x}^2 + ${y}^2} = \\sqrt{${x * x + y * y}} = ${z}`)} m.\nDistance (${x + y} m) is the whole path; displacement is only start to finish.`,
      };
    },
  },
  {
    key: 'jamb-physics/instrument-reading',
    topic: [MEAS, 'Measuring instruments'],
    difficulty: 1,
    make: (r) => {
      if (r.chance(0.5)) {
        const sleeve = r.int(2, 14) + r.pick([0, 0.5]);
        const div = r.int(1, 49);
        const reading = sleeve + div * 0.01;
        return {
          stem: `On a micrometer screw gauge, the sleeve reads ${qtyDp(sleeve, U.mm, sleeve % 1 ? 1 : 0)} and the ${div}${div % 10 === 1 && div !== 11 ? 'st' : div % 10 === 2 && div !== 12 ? 'nd' : div % 10 === 3 && div !== 13 ? 'rd' : 'th'} thimble division is on the reference line. What is the reading?`,
          answer: qtyDp(reading, U.mm, 2),
          wrong: [qtyDp(sleeve + div * 0.1, U.mm, 2), qtyDp(sleeve + div * 0.001, U.mm, 3), qtyDp(Math.floor(sleeve) + div * 0.01 + (sleeve % 1 ? 0 : 0.5), U.mm, 2), qtyDp(reading + 1, U.mm, 2)],
          explanation: `Each thimble division is 0.01 mm.\nReading = sleeve + thimble = ${num(sleeve)} + ${div} × 0.01 = ${num(reading, 2)} mm.`,
        };
      }
      const main = r.int(10, 95) / 10;
      const v = r.int(1, 9);
      const reading = main + v * 0.01;
      return {
        stem: `On a pair of vernier callipers, the main scale reads ${qtyDp(main, U.cm, 1)} just before the vernier zero, and the ${v}${v === 1 ? 'st' : v === 2 ? 'nd' : v === 3 ? 'rd' : 'th'} vernier mark lines up with a main scale mark. What is the reading?`,
        answer: qtyDp(reading, U.cm, 2),
        wrong: [qtyDp(main + v * 0.1, U.cm, 2), qtyDp(main + v * 0.001, U.cm, 3), qtyDp(main, U.cm, 2), qtyDp(main + 0.1 - v * 0.01, U.cm, 2)],
        explanation: `A vernier calliper reads to 0.01 cm.\nReading = ${num(main)} + ${v} × 0.01 = ${num(reading, 2)} cm.`,
      };
    },
  },

  // ── Linear motion ──────────────────────────────────────
  {
    key: 'jamb-physics/v-u-at',
    topic: [MOT, 'Linear motion'],
    difficulty: 1,
    make: (r) => {
      const u = r.pick([0, 0, 2, 4, 5, 8, 10, 12, 15, 20]);
      const a = r.pick([1, 1.5, 2, 2.5, 3, 4, 5]);
      const t = r.int(3, 12);
      const v = u + a * t;
      if (r.chance(0.3) && u > 0) {
        // A body slowing down: find the time to stop.
        const u2 = a * t;
        return {
          stem: `A car moving at ${qty(u2, U.ms)} brakes and slows down uniformly at ${qty(a, U.ms2)}. How long does it take to stop?`,
          ...choices(U.s, t, [u2 * a, u2 / (2 * a), t * 2, u2 - a]),
          explanation: `Use ${m('v = u + at')} with ${m('v = 0')} and ${m(`a = -${num(a)}`)}: ${m(`0 = ${num(u2)} - ${num(a)}t`)}, so ${m(`t = \\frac{${num(u2)}}{${num(a)}} = ${t}`)} s.`,
          difficulty: 2,
        };
      }
      return {
        stem: `${u === 0 ? 'A car starts from rest and accelerates' : `A car moving at ${qty(u, U.ms)} accelerates`} uniformly at ${qty(a, U.ms2)} for ${qty(t, U.s)}. What is its final velocity?`,
        ...choices(U.ms, v, [u + a, u === 0 ? v / 2 : a * t, u * t + 0.5 * a * t * t, 2 * v]),
        explanation: `Use ${m('v = u + at')}: ${m(`v = ${num(u)} + ${num(a)} \\times ${t} = ${num(v)}`)} m/s.`,
      };
    },
  },
  {
    key: 'jamb-physics/accel-from-distance',
    topic: [MOT, 'Linear motion'],
    difficulty: 2,
    make: (r) => {
      const a = r.pick([0.5, 1, 1.5, 2, 2.5, 3, 4, 5]);
      const t = r.int(2, 12);
      const s = 0.5 * a * t * t;
      if (!Number.isInteger(s)) return null;
      return {
        stem: `A body starts from rest and covers ${qty(s, U.m)} in ${qty(t, U.s)} with uniform acceleration. What is its acceleration?`,
        ...choices(U.ms2, a, [s / (t * t), s / t, (2 * s) / t, 2 * a]),
        explanation: `From rest, ${m('s = \\tfrac{1}{2}at^2')}, so ${m(`a = \\frac{2s}{t^2} = \\frac{2 \\times ${s}}{${t}^2} = ${num(a)}`)} m/s².`,
      };
    },
  },
  {
    key: 'jamb-physics/braking-distance',
    topic: [MOT, 'Linear motion'],
    difficulty: 2,
    make: (r) => {
      const u = r.pick([10, 12, 15, 20, 24, 25, 30]);
      const a = r.pick([2, 2.5, 3, 4, 5, 6]);
      const s = (u * u) / (2 * a);
      if (s !== sig(s, 3)) return null;
      if (r.chance(0.5)) {
        return {
          stem: `A car travelling at ${qty(u, U.ms)} is brought to rest with a uniform deceleration of ${qty(a, U.ms2)}. How far does it travel before stopping?`,
          ...choices(U.m, s, [(u * u) / a, u / (2 * a), u * u * a, (u / a) * u]),
          explanation: `Use ${m('v^2 = u^2 + 2as')} with ${m('v = 0')}: ${m(`s = \\frac{u^2}{2a} = \\frac{${u}^2}{2 \\times ${num(a)}} = ${num(s)}`)} m.`,
        };
      }
      return {
        stem: `A car travelling at ${qty(u, U.ms)} brakes and stops uniformly in a distance of ${qty(s, U.m)}. What is its deceleration?`,
        ...choices(U.ms2, a, [(u * u) / s, u / s, u / (2 * s), 2 * a]),
        explanation: `Use ${m('v^2 = u^2 + 2as')} with ${m('v = 0')}: ${m(`a = \\frac{u^2}{2s} = \\frac{${u}^2}{2 \\times ${num(s)}} = ${num(a)}`)} m/s².`,
      };
    },
  },
  {
    key: 'jamb-physics/next-interval',
    topic: [MOT, 'Linear motion'],
    difficulty: 4,
    make: (r) => {
      const u = r.int(1, 10);
      const a = r.int(1, 5);
      const t = r.int(2, 10);
      const s1 = u * t + 0.5 * a * t * t;
      const next = u * t + 1.5 * a * t * t;
      if (!Number.isInteger(s1)) return null;
      return {
        stem: `A lorry accelerates uniformly in a straight line at ${qty(a, U.ms2)} and covers ${qty(s1, U.m)} in ${qty(t, U.s)}. How far will it travel in the next ${t} s?`,
        ...choices(U.m, next, [s1, 2 * s1, 3 * s1, s1 + next]),
        explanation: `First find the starting speed from ${m('s = ut + \\tfrac{1}{2}at^2')}: ${m(`${s1} = ${t}u + \\tfrac{1}{2} \\times ${a} \\times ${t}^2`)}, so ${m(`u = ${u}`)} m/s.\nIn ${2 * t} s it covers ${m(`${u} \\times ${2 * t} + \\tfrac{1}{2} \\times ${a} \\times ${2 * t}^2 = ${s1 + next}`)} m.\nSo in the next ${t} s: ${s1 + next} − ${s1} = ${next} m.`,
      };
    },
  },
  {
    key: 'jamb-physics/velocity-time-graph',
    topic: [MOT, 'Linear motion'],
    difficulty: 3,
    make: (r) => {
      const v = r.pick([5, 8, 10, 12, 15, 20, 25, 30]);
      const t1 = r.int(2, 10);
      const t2 = r.int(5, 30);
      const t3 = r.int(2, 10);
      const s = v * (t1 / 2 + t2 + t3 / 2);
      const total = t1 + t2 + t3;
      const lead = `A car starts from rest and accelerates uniformly to ${qty(v, U.ms)} in ${qty(t1, U.s)}. It keeps this speed for ${qty(t2, U.s)}, then slows down uniformly to rest in ${qty(t3, U.s)}.`;
      const working = `On the velocity–time graph, distance is the area under the line (a trapezium): ${m(`\\tfrac{1}{2} \\times ${t1} \\times ${v} + ${t2} \\times ${v} + \\tfrac{1}{2} \\times ${t3} \\times ${v} = ${num(s)}`)} m.`;
      if (r.chance(0.35)) {
        const avg = s / total;
        return {
          stem: `${lead} What is its average speed for the whole journey?`,
          ...choices(U.ms, avg, [v / 2, v, 0.75 * v, s / t2]),
          explanation: `${working}\nAverage speed = total distance ÷ total time = ${m(`\\frac{${num(s)}}{${total}} = ${sci(avg)}`)} m/s.`,
          difficulty: 4,
        };
      }
      return {
        stem: `${lead} What is the total distance covered?`,
        ...choices(U.m, s, [v * total, v * t2, (v * total) / 2, v * (t1 + t2)]),
        explanation: working,
      };
    },
  },
  {
    key: 'jamb-physics/free-fall',
    topic: [MOT, 'Linear motion'],
    difficulty: 2,
    make: (r) => {
      const t = r.int(1, 6);
      const h = 0.5 * G * t * t;
      const v = G * t;
      const ask = r.pick(['time', 'speed', 'height'] as const);
      const given = `(Take ${m(`g = ${G}\\,${U.ms2}`)}; ignore air resistance.)`;
      if (ask === 'time') {
        return {
          stem: `A stone is dropped from rest from the top of a building ${qty(h, U.m)} high. How long does it take to reach the ground? ${given}`,
          ...choices(U.s, t, [h / G, (2 * h) / G, Math.sqrt(h / G), t * 2]),
          explanation: `${m('h = \\tfrac{1}{2}gt^2')}, so ${m(`t = \\sqrt{\\frac{2h}{g}} = \\sqrt{\\frac{2 \\times ${h}}{${G}}} = ${t}`)} s.`,
        };
      }
      if (ask === 'speed') {
        return {
          stem: `A stone is dropped from rest from a height of ${qty(h, U.m)}. With what speed does it hit the ground? ${given}`,
          ...choices(U.ms, v, [G * h, Math.sqrt(G * h), 2 * G * h, v / 2]),
          explanation: `${m('v^2 = u^2 + 2gh')} with ${m('u = 0')}: ${m(`v = \\sqrt{2 \\times ${G} \\times ${h}} = \\sqrt{${2 * G * h}} = ${v}`)} m/s.`,
        };
      }
      return {
        stem: `A stone dropped from rest from the top of a cliff takes ${qty(t, U.s)} to reach the ground. How high is the cliff? ${given}`,
        ...choices(U.m, h, [G * t, G * t * t, 2 * G * t * t, h / 2]),
        explanation: `${m(`h = \\tfrac{1}{2}gt^2 = \\tfrac{1}{2} \\times ${G} \\times ${t}^2 = ${h}`)} m.`,
      };
    },
  },
  {
    key: 'jamb-physics/thrown-up',
    topic: [MOT, 'Linear motion'],
    difficulty: 2,
    make: (r) => {
      const u = r.pick([10, 15, 20, 25, 30, 35, 40, 50]);
      const H = (u * u) / (2 * G);
      const tUp = u / G;
      const ask = r.pick(['height', 'time-up', 'flight'] as const);
      const lead = `A ball is thrown vertically upwards with a speed of ${qty(u, U.ms)}. (Take ${m(`g = ${G}\\,${U.ms2}`)}.)`;
      if (ask === 'height') {
        return {
          stem: `${lead} What is the greatest height it reaches?`,
          ...choices(U.m, H, [(u * u) / G, u / G, u * G, H / 2]),
          explanation: `At the top ${m('v = 0')}, so ${m(`H = \\frac{u^2}{2g} = \\frac{${u}^2}{2 \\times ${G}} = ${num(H)}`)} m.`,
        };
      }
      if (ask === 'time-up') {
        return {
          stem: `${lead} How long does it take to reach its highest point?`,
          ...choices(U.s, tUp, [2 * tUp, (u * u) / G, tUp / 2, u * G]),
          explanation: `At the top ${m('v = 0')}: ${m(`0 = ${u} - ${G}t`)}, so ${m(`t = \\frac{u}{g} = ${num(tUp)}`)} s.`,
        };
      }
      return {
        stem: `${lead} How long is it in the air before it comes back to the thrower's hand?`,
        ...choices(U.s, 2 * tUp, [tUp, (u * u) / G, 4 * tUp, u / (2 * G)]),
        explanation: `Time to the top is ${m(`\\frac{u}{g} = ${num(tUp)}`)} s, and coming down takes the same time.\nTotal time of flight = ${m(`\\frac{2u}{g} = ${num(2 * tUp)}`)} s.`,
      };
    },
  },

  // ── Projectiles ────────────────────────────────────────
  {
    key: 'jamb-physics/projectile-range',
    topic: [MOT, 'Projectiles'],
    difficulty: 3,
    make: (r) => {
      const u = r.pick([10, 20, 30, 40, 50, 60, 80, 100]);
      const th = r.pick([15, 30, 45, 60, 75]);
      const R = (u * u * sinD(2 * th)) / G;
      return {
        stem: `A ball is projected with a speed of ${qty(u, U.ms)} at an angle of ${m(`${th}^\\circ`)} to the horizontal. What is its horizontal range? (Take ${m(`g = ${G}\\,${U.ms2}`)}.)`,
        ...choices(U.m, R, [(u * u * sinD(th)) / G, th === 45 ? (u * u) / (2 * G) : (u * u) / G, R / 2, (u * sinD(2 * th)) / G]),
        explanation: `${m('R = \\frac{u^2 \\sin 2\\theta}{g}')}. Here ${m(`2\\theta = ${2 * th}^\\circ`)} and ${m(`\\sin ${2 * th}^\\circ = ${sig(sinD(2 * th), 3)}`)}.\n${m(`R = \\frac{${u}^2 \\times ${sig(sinD(2 * th), 3)}}{${G}} = ${sci(R)}`)} m.`,
      };
    },
  },
  {
    key: 'jamb-physics/projectile-height-time',
    topic: [MOT, 'Projectiles'],
    difficulty: 3,
    make: (r) => {
      const u = r.pick([20, 30, 40, 50, 60]);
      const th = r.pick([30, 45, 60]);
      const s = sinD(th);
      const lead = `A stone is projected at ${qty(u, U.ms)} at ${m(`${th}^\\circ`)} to the horizontal. (Take ${m(`g = ${G}\\,${U.ms2}`)}.)`;
      if (r.chance(0.5)) {
        const T = (2 * u * s) / G;
        return {
          stem: `${lead} What is its time of flight?`,
          ...choices(U.s, T, [(u * s) / G, (2 * u) / G, (2 * u * cosD(th)) / G, T * 2]),
          explanation: `${m(`T = \\frac{2u\\sin\\theta}{g} = \\frac{2 \\times ${u} \\times ${sig(s, 3)}}{${G}} = ${sci(T)}`)} s.`,
        };
      }
      const H = (u * u * s * s) / (2 * G);
      return {
        stem: `${lead} What is the greatest height it reaches?`,
        ...choices(U.m, H, [(u * u * s) / (2 * G), (u * u) / (2 * G), (u * u * s * s) / G, (u * s) / (2 * G)]),
        explanation: `Only the vertical part of the velocity, ${m('u\\sin\\theta')}, lifts the stone.\n${m(`H = \\frac{u^2\\sin^2\\theta}{2g} = \\frac{${u}^2 \\times ${sig(s * s, 3)}}{2 \\times ${G}} = ${sci(H)}`)} m.`,
      };
    },
  },
  {
    key: 'jamb-physics/horizontal-launch',
    topic: [MOT, 'Projectiles'],
    difficulty: 3,
    make: (r) => {
      const t = r.int(1, 6);
      const h = 0.5 * G * t * t;
      const u = r.pick([5, 8, 10, 12, 15, 20, 25]);
      const x = u * t;
      return {
        stem: `A stone is thrown horizontally at ${qty(u, U.ms)} from the top of a cliff ${qty(h, U.m)} high. How far from the foot of the cliff does it land? (Take ${m(`g = ${G}\\,${U.ms2}`)}.)`,
        ...choices(U.m, x, [u * 2 * t, u * (h / G), (u * t) / 2, Math.sqrt(u * u + (G * t) ** 2) * t]),
        explanation: `The fall takes the same time as a dropped stone: ${m(`t = \\sqrt{\\frac{2h}{g}} = \\sqrt{\\frac{2 \\times ${h}}{${G}}} = ${t}`)} s.\nHorizontally the speed doesn't change: ${m(`x = ut = ${u} \\times ${t} = ${x}`)} m.`,
      };
    },
  },

  // ── Newton's laws and momentum ─────────────────────────
  {
    key: 'jamb-physics/net-force',
    topic: [MOT, "Newton's laws and momentum"],
    difficulty: 2,
    make: (r) => {
      const mass = r.pick([2, 4, 5, 8, 10, 20, 25, 50]);
      const a = r.pick([0.5, 1, 1.5, 2, 2.5, 3, 4]);
      const f = r.pick([5, 10, 12, 15, 20, 30, 40]);
      const F = mass * a + f;
      return {
        stem: `A horizontal force of ${qty(F, U.N)} pulls a box of mass ${qty(mass, U.kg)} along a rough floor. The friction force is ${qty(f, U.N)}. What is the acceleration of the box?`,
        ...choices(U.ms2, a, [F / mass, (F + f) / mass, f / mass, F - f]),
        explanation: `Net force = ${F} − ${f} = ${F - f} N.\n${m(`a = \\frac{F_{net}}{m} = \\frac{${F - f}}{${mass}} = ${num(a)}`)} m/s².`,
      };
    },
  },
  {
    key: 'jamb-physics/impulse',
    topic: [MOT, "Newton's laws and momentum"],
    difficulty: 3,
    make: (r) => {
      if (r.chance(0.5)) {
        const mass = r.pick([0.1, 0.2, 0.25, 0.4, 0.5, 2]);
        const v1 = r.pick([5, 8, 10, 12, 15, 20]);
        const v2 = r.pick([2, 4, 5, 6, 8, 10]);
        const dp = mass * (v1 + v2);
        return {
          stem: `A ball of mass ${qty(mass, U.kg)} hits a wall at ${qty(v1, U.ms)} and bounces straight back at ${qty(v2, U.ms)}. What is the magnitude of its change in momentum?`,
          ...choices(U.Ns, dp, [mass * Math.abs(v1 - v2), mass * v1, mass * v2, (v1 + v2) / mass]),
          explanation: `Momentum is a vector. Take towards the wall as positive: before = ${m(`${mass} \\times ${v1}`)}, after = ${m(`${mass} \\times (-${v2})`)}.\nChange = ${m(`${mass} \\times (${v1} + ${v2}) = ${sci(dp)}`)} N s.`,
        };
      }
      const F = r.pick([4, 5, 10, 12, 20, 25, 50]);
      const t = r.pick([0.5, 1, 2, 3, 4, 5]);
      const mass = r.pick([0.5, 1, 2, 4, 5, 10]);
      const v = (F * t) / mass;
      return {
        stem: `A constant force of ${qty(F, U.N)} acts for ${qty(t, U.s)} on a body of mass ${qty(mass, U.kg)} at rest. What velocity does it gain?`,
        ...choices(U.ms, v, [F * t, F / mass, F * mass * t, (F * mass) / t]),
        explanation: `Impulse = change in momentum: ${m('Ft = mv')}.\n${m(`v = \\frac{Ft}{m} = \\frac{${F} \\times ${num(t)}}{${num(mass)}} = ${sci(v)}`)} m/s.`,
      };
    },
  },
  {
    key: 'jamb-physics/collision-together',
    topic: [MOT, "Newton's laws and momentum"],
    difficulty: 3,
    make: (r) => {
      const m1 = r.pick([0.5, 1, 2, 3, 4, 5, 1000, 1500, 2000]);
      const m2 = m1 >= 1000 ? r.pick([500, 1000, 1500, 3000]) : r.pick([0.5, 1, 2, 3, 5]);
      const u1 = r.pick([4, 6, 8, 10, 12, 15, 20]);
      const v = (m1 * u1) / (m1 + m2);
      const lead = `A body of mass ${qty(m1, U.kg)} moving at ${qty(u1, U.ms)} hits a body of mass ${qty(m2, U.kg)} at rest, and they move off together.`;
      const momentum = `Momentum is conserved: ${m(`${num(m1)} \\times ${u1} = (${num(m1)} + ${num(m2)})v`)}, so ${m(`v = ${sci(v)}`)} m/s.`;
      if (r.chance(0.35) && m1 < 1000) {
        const lost = 0.5 * m1 * u1 * u1 - 0.5 * (m1 + m2) * v * v;
        return {
          stem: `${lead} How much kinetic energy is lost in the collision?`,
          ...choices(U.J, lost, [0.5 * m1 * u1 * u1, 0.5 * (m1 + m2) * v * v, 0, m1 * u1 - (m1 + m2) * v + 1]),
          explanation: `${momentum}\nKE before = ${m(`\\tfrac{1}{2} \\times ${num(m1)} \\times ${u1}^2 = ${sci(0.5 * m1 * u1 * u1)}`)} J; KE after = ${m(`\\tfrac{1}{2} \\times ${num(m1 + m2)} \\times ${sci(v)}^2 = ${sci(0.5 * (m1 + m2) * v * v)}`)} J.\nLost = ${sci(lost)} J.`,
          difficulty: 4,
        };
      }
      return {
        stem: `${lead} What is their common velocity?`,
        ...choices(U.ms, v, [(m2 * u1) / (m1 + m2), u1 / 2, (m1 * u1) / m2, u1]),
        explanation: momentum,
      };
    },
  },
  {
    key: 'jamb-physics/recoil',
    topic: [MOT, "Newton's laws and momentum"],
    difficulty: 3,
    make: (r) => {
      const M = r.pick([2, 4, 5, 8, 10]);
      const g = r.pick([10, 20, 25, 40, 50]);
      const v = r.pick([100, 200, 250, 300, 400, 500]);
      const V = ((g / 1000) * v) / M;
      return {
        stem: `A gun of mass ${qty(M, U.kg)} fires a bullet of mass ${qty(g, U.g)} at ${qty(v, U.ms)}. What is the recoil speed of the gun?`,
        ...choices(U.ms, V, [(g * v) / M, V * 10, (M * v) / g, v / M]),
        explanation: `Before firing, the total momentum is zero, so the gun's momentum equals the bullet's: ${m('MV = mv')}.\nChange grams to kilograms first: ${g} g = ${num(g / 1000)} kg.\n${m(`V = \\frac{${num(g / 1000)} \\times ${v}}{${M}} = ${sci(V)}`)} m/s.`,
      };
    },
  },
  {
    key: 'jamb-physics/lift',
    topic: [MOT, "Newton's laws and momentum"],
    difficulty: 3,
    make: (r) => {
      const mass = r.pick([40, 50, 60, 70, 80]);
      const a = r.pick([1, 2, 2.5, 3, 4]);
      const motion = r.pick(['up', 'down', 'steady'] as const);
      const R = motion === 'up' ? mass * (G + a) : motion === 'down' ? mass * (G - a) : mass * G;
      const how = motion === 'up' ? `accelerating upwards at ${qty(a, U.ms2)}` : motion === 'down' ? `accelerating downwards at ${qty(a, U.ms2)}` : `moving upwards at a steady ${qty(a, U.ms)}`;
      return {
        stem: `A person of mass ${qty(mass, U.kg)} stands on a weighing scale in a lift that is ${how}. What does the scale read? (Take ${m(`g = ${G}\\,${U.ms2}`)}.)`,
        ...choices(U.N, R, [mass * G, mass * (G + a), mass * (G - a), mass * a]),
        explanation:
          motion === 'steady'
            ? `At steady speed there is no acceleration, so the scale reads the ordinary weight: ${m(`mg = ${mass} \\times ${G} = ${R}`)} N.`
            : `The scale pushes with ${m(`R = m(g ${motion === 'up' ? '+' : '-'} a)`)}.\n${m(`R = ${mass} \\times (${G} ${motion === 'up' ? '+' : '-'} ${num(a)}) = ${num(R)}`)} N.`,
      };
    },
  },
  {
    key: 'jamb-physics/moon-weight',
    topic: [MOT, "Newton's laws and momentum"],
    difficulty: 1,
    make: (r) => {
      const w = r.pick([2, 3, 4, 5, 6, 8, 10, 12, 15, 20]);
      if (r.chance(0.5)) {
        return {
          stem: `The pull of gravity on the moon is ${m('\\tfrac{1}{6}')} of that on Earth. A body weighs ${qty(w, U.N)} on the moon. What does it weigh on Earth?`,
          ...choices(U.N, 6 * w, [w, w / 6, w * 10, 6 * w * 10]),
          explanation: `Weight is 6 times bigger on Earth: ${w} × 6 = ${6 * w} N. (Its mass is the same in both places.)`,
        };
      }
      const W = w * 60;
      return {
        stem: `A body weighs ${qty(W, U.N)} on Earth, where ${m(`g = ${G}\\,${U.ms2}`)}. The pull of gravity on the moon is ${m('\\tfrac{1}{6}')} of Earth's. What is its mass on the moon?`,
        ...choices(U.kg, W / G, [W / 6, W / (6 * G), W, (W * 6) / G]),
        explanation: `Mass doesn't change from place to place. ${m(`m = \\frac{W}{g} = \\frac{${W}}{${G}} = ${W / G}`)} kg, on Earth and on the moon.`,
      };
    },
  },
  {
    key: 'jamb-physics/force-ratio',
    topic: [MOT, "Newton's laws and momentum"],
    difficulty: 2,
    make: (r) => {
      const [p, q, s, t] = [r.int(1, 6), r.int(1, 6), r.int(1, 9), r.int(1, 9)];
      if (p === q || s === t) return null;
      const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
      const simp = (a: number, b: number) => `${a / g(a, b)}:${b / g(a, b)}`;
      const ans = simp(p * s, q * t);
      return {
        stem: `Two bodies have masses in the ratio ${p}:${q}. Forces on them give accelerations in the ratio ${s}:${t}. What is the ratio of the forces?`,
        answer: ans,
        wrong: [simp(p * t, q * s), simp(p + s, q + t), simp(s, t), simp(p, q), simp(q * s, p * t)],
        explanation: `${m('F = ma')}, so the forces are in the ratio ${m(`${p} \\times ${s} : ${q} \\times ${t} = ${p * s}:${q * t}`)}, which is ${ans}.`,
      };
    },
  },

  // ── Circular motion and SHM ────────────────────────────
  {
    key: 'jamb-physics/centripetal-speed',
    topic: [MOT, 'Circular and simple harmonic motion'],
    difficulty: 2,
    make: (r) => {
      const mass = r.pick([0.2, 0.5, 1, 2, 4, 5]);
      const v = r.pick([2, 3, 4, 5, 6, 8, 10]);
      const rad = r.pick([0.5, 1, 1.5, 2, 2.5, 4, 5]);
      const F = (mass * v * v) / rad;
      return {
        stem: `A body of mass ${qty(mass, U.kg)} moves in a circle of radius ${qty(rad, U.m)} at a steady speed of ${qty(v, U.ms)}. What is the centripetal force on it?`,
        ...choices(U.N, F, [(mass * v) / rad, mass * v * v * rad, (mass * v * v) / (2 * rad), (v * v) / rad]),
        explanation: `${m(`F = \\frac{mv^2}{r} = \\frac{${num(mass)} \\times ${v}^2}{${num(rad)}} = ${sci(F)}`)} N.`,
      };
    },
  },
  {
    key: 'jamb-physics/centripetal-revs',
    topic: [MOT, 'Circular and simple harmonic motion'],
    difficulty: 4,
    make: (r) => {
      const mass = r.pick([0.5, 1, 2, 3]);
      const rad = r.pick([0.5, 0.8, 1, 1.2, 1.5, 2]);
      const perMin = r.chance(0.6);
      const n = perMin ? r.pick([30, 60, 90, 120, 150, 180]) : r.pick([1, 2, 3, 4]);
      const w = perMin ? (2 * Math.PI * n) / 60 : 2 * Math.PI * n;
      const F = mass * w * w * rad;
      const k = perMin ? n / 30 : 2 * n;
      return {
        stem: `A body of mass ${qty(mass, U.kg)} on a string ${qty(rad, U.m)} long is whirled in a horizontal circle at ${n} ${perMin ? 'revolutions per minute' : `revolution${n > 1 ? 's' : ''} per second`}. What is the tension in the string?`,
        ...choices(U.N, F, [mass * w * rad, mass * (perMin ? n / 60 : n) ** 2 * rad, mass * n * n * rad, (mass * w * w) / rad]),
        explanation: `Change the speed to angular velocity: ${m(`\\omega = ${perMin ? `\\frac{2\\pi \\times ${n}}{60}` : `2\\pi \\times ${n}`} = ${k}\\pi`)} rad/s.\nThe tension provides the centripetal force: ${m(`T = m\\omega^2 r = ${num(mass)} \\times (${k}\\pi)^2 \\times ${num(rad)} = ${sci(F)}`)} N.`,
      };
    },
  },
  {
    key: 'jamb-physics/pendulum',
    topic: [MOT, 'Circular and simple harmonic motion'],
    difficulty: 2,
    make: (r) => {
      if (r.chance(0.5)) {
        const k = r.pick([2, 3, 4]);
        const T0 = r.pick([1, 1.2, 1.5, 2, 2.5]);
        const up = r.chance(0.6);
        const T1 = up ? T0 * k : T0 / k;
        return {
          stem: `A simple pendulum has a period of ${qty(T0, U.s)}. Its length is ${up ? `increased to ${k * k} times` : `reduced to ${m(`\\tfrac{1}{${k * k}}`)} of`} its first value. What is the new period?`,
          ...choices(U.s, T1, [up ? T0 * k * k : T0 / (k * k), T0, up ? T0 / k : T0 * k, up ? T0 * 2 * k : T0 / (2 * k)]),
          explanation: `${m('T = 2\\pi\\sqrt{\\frac{l}{g}}')}, so the period goes with the square root of the length.\nLength ×${up ? k * k : `1/${k * k}`} means period ×${up ? k : `1/${k}`}: ${m(`${num(T0)} ${up ? '\\times' : '\\div'} ${k} = ${sci(T1)}`)} s.`,
        };
      }
      const s = r.int(1, 10) / 10;
      const l = sig(s * s * G, 6);
      const T = 2 * Math.PI * s;
      return {
        stem: `What is the period of a simple pendulum of length ${qty(l, U.m)}? (Take ${m(`g = ${G}\\,${U.ms2}`)} and ${m('\\pi = 3.142')}.)`,
        ...choices(U.s, T, [Math.PI * s, 2 * Math.PI * (l / G), 2 * Math.PI * Math.sqrt(G / l), 2 * Math.PI * l]),
        explanation: `${m(`T = 2\\pi\\sqrt{\\frac{l}{g}} = 2\\pi\\sqrt{\\frac{${num(l)}}{${G}}} = 2\\pi \\times ${num(s)} = ${sci(T)}`)} s.`,
      };
    },
  },
  {
    key: 'jamb-physics/shm-max',
    topic: [MOT, 'Circular and simple harmonic motion'],
    difficulty: 3,
    make: (r) => {
      const A = r.pick([2, 4, 5, 8, 10]);
      const f = r.pick([0.5, 1, 2, 2.5, 5]);
      const w = 2 * Math.PI * f;
      const Am = A / 100;
      if (r.chance(0.5)) {
        return {
          stem: `A particle moves with simple harmonic motion of amplitude ${qty(A, U.cm)} and frequency ${qty(f, U.Hz)}. What is its maximum speed?`,
          ...choices(U.ms, w * Am, [f * Am, w * A, w * w * Am, 2 * w * Am]),
          explanation: `${m(`\\omega = 2\\pi f = ${sci(w)}`)} rad/s.\nMaximum speed is at the centre: ${m(`v_{max} = \\omega A = ${sci(w)} \\times ${num(Am)} = ${sci(w * Am)}`)} m/s.`,
        };
      }
      return {
        stem: `A particle moves with simple harmonic motion of amplitude ${qty(A, U.cm)} and frequency ${qty(f, U.Hz)}. What is its maximum acceleration?`,
        ...choices(U.ms2, w * w * Am, [w * Am, w * w * A, f * f * Am, (w * w * Am) / 2]),
        explanation: `${m(`\\omega = 2\\pi f = ${sci(w)}`)} rad/s.\nAcceleration is greatest at the ends: ${m(`a_{max} = \\omega^2 A = ${sci(w)}^2 \\times ${num(Am)} = ${sci(w * w * Am)}`)} m/s².`,
      };
    },
  },

  // ── Equilibrium, friction, machines ────────────────────
  {
    key: 'jamb-physics/metre-rule',
    topic: [EQ, 'Equilibrium and moments'],
    difficulty: 3,
    make: (r) => {
      const p = r.pick([55, 60, 65, 70, 75, 80, 85, 90]);
      const mass = r.pick([0.05, 0.1, 0.2, 0.25, 0.3, 0.5]);
      const M = (mass * (100 - p)) / (p - 50);
      if (r.chance(0.5)) {
        return {
          stem: `A uniform metre rule balances horizontally on a knife-edge at the ${p} cm mark when a mass of ${qty(mass, U.kg)} hangs from the 100 cm end. What is the mass of the metre rule?`,
          ...choices(U.kg, M, [(mass * p) / 50, (mass * (p - 50)) / (100 - p), (mass * (100 - p)) / p, mass]),
          explanation: `The rule's weight acts at its centre, the 50 cm mark, ${p - 50} cm from the pivot. The hanging mass is ${100 - p} cm on the other side.\nTake moments: ${m(`M \\times ${p - 50} = ${num(mass)} \\times ${100 - p}`)}, so ${m(`M = ${sci(M)}`)} kg.`,
        };
      }
      const rule = r.pick([0.1, 0.12, 0.15, 0.2]);
      const x = r.pick([5, 10, 15, 20, 25, 30, 35]);
      const piv = r.pick([30, 35, 40, 45]);
      if (x >= piv) return null;
      const need = (rule * (50 - piv)) / (piv - x);
      return {
        stem: `A uniform metre rule of mass ${qty(rule, U.kg)} is pivoted at the ${piv} cm mark. What mass must hang at the ${x} cm mark to keep it horizontal?`,
        ...choices(U.kg, need, [(rule * (piv - x)) / (50 - piv), (rule * 50) / piv, (rule * piv) / (50 - x), rule]),
        explanation: `The rule's weight acts at 50 cm, ${50 - piv} cm from the pivot; the mass hangs ${piv - x} cm on the other side.\nMoments: ${m(`m \\times ${piv - x} = ${num(rule)} \\times ${50 - piv}`)}, so ${m(`m = ${sci(need)}`)} kg.`,
      };
    },
  },
  {
    key: 'jamb-physics/seesaw',
    topic: [EQ, 'Equilibrium and moments'],
    difficulty: 2,
    make: (r) => {
      const [a, b] = r.shuffle(NAMES).slice(0, 2);
      const ma = r.pick([20, 24, 25, 30, 36, 40, 45]);
      const mb = r.pick([20, 24, 25, 30, 36, 40, 45, 50]);
      const da = r.pick([1, 1.2, 1.5, 1.8, 2, 2.4]);
      if (ma === mb) return null;
      const db = (ma * da) / mb;
      return {
        stem: `${a} (${qty(ma, U.kg)}) sits ${qty(da, U.m)} from the pivot of a see-saw. How far from the pivot, on the other side, must ${b} (${qty(mb, U.kg)}) sit to balance it?`,
        ...choices(U.m, db, [(mb * da) / ma, da, (ma + mb) / (da * 10), Math.abs(ma - mb) / 10 + da]),
        explanation: `Clockwise moment = anticlockwise moment: ${m(`${ma} \\times ${num(da)} = ${mb} \\times d`)}.\n${m(`d = \\frac{${num(ma * da)}}{${mb}} = ${sci(db)}`)} m.`,
      };
    },
  },
  {
    key: 'jamb-physics/friction',
    topic: [EQ, 'Friction'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['coefficient', 'force', 'incline'] as const);
      if (kind === 'incline') {
        const th = r.pick([30, 45, 60, 20, 35]);
        const mu = tanD(th);
        return {
          stem: `A block just begins to slide down a plank when the plank is tilted at ${m(`${th}^\\circ`)} to the horizontal. What is the coefficient of static friction?`,
          ...choices(U.none, mu, [sinD(th), cosD(th), 1 / mu, th / 90]),
          explanation: `When it just slides, friction balances the pull down the slope: ${m('\\mu mg\\cos\\theta = mg\\sin\\theta')}.\nSo ${m(`\\mu = \\tan ${th}^\\circ = ${sci(mu)}`)}.`,
          difficulty: 3,
        };
      }
      const mass = r.pick([2, 4, 5, 8, 10, 20, 40, 50]);
      const mu = r.pick([0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6]);
      const W = mass * G;
      if (kind === 'force') {
        return {
          stem: `A box of mass ${qty(mass, U.kg)} rests on a floor where the coefficient of friction is ${num(mu)}. What horizontal force will just keep it moving at a steady speed? (Take ${m(`g = ${G}\\,${U.ms2}`)}.)`,
          ...choices(U.N, mu * W, [mu * mass, W, W / mu, mu * W + W]),
          explanation: `At steady speed the pull equals friction: ${m(`F = \\mu mg = ${num(mu)} \\times ${mass} \\times ${G} = ${num(mu * W)}`)} N.`,
        };
      }
      const F = mu * W;
      return {
        stem: `A horizontal force of ${qty(F, U.N)} pulls a box of weight ${qty(W, U.N)} across a floor at a steady speed. What is the coefficient of friction?`,
        ...choices(U.none, mu, [W / F, F / (W * G), mu * G, 1 - mu]),
        explanation: `At steady speed, friction = pull, and the normal reaction = weight.\n${m(`\\mu = \\frac{F}{R} = \\frac{${num(F)}}{${W}} = ${num(mu)}`)}.`,
      };
    },
  },
  {
    key: 'jamb-physics/machine-efficiency',
    topic: [EQ, 'Machines'],
    difficulty: 2,
    make: (r) => {
      const vr = r.pick([2, 3, 4, 5, 6]);
      const load = r.pick([120, 150, 200, 240, 300, 360, 400, 600]);
      if (r.chance(0.5)) {
        const eff = r.pick([40, 50, 60, 75, 80]);
        const effort = load / ((eff / 100) * vr);
        return {
          stem: `A block-and-tackle pulley system with ${vr} pulleys lifts a load of ${qty(load, U.N)}. Its efficiency is ${eff}%. What effort is needed?`,
          ...choices(U.N, effort, [load / vr, (load * eff) / 100, (load * (eff / 100)) / vr, load / (eff / 100)]),
          explanation: `The velocity ratio equals the number of pulleys: ${vr}.\nMechanical advantage = efficiency × VR = ${num(eff / 100)} × ${vr} = ${num((eff / 100) * vr)}.\nEffort = load ÷ MA = ${m(`\\frac{${load}}{${num((eff / 100) * vr)}} = ${sci(effort)}`)} N.`,
        };
      }
      const effort = r.pick([40, 50, 60, 75, 80, 100, 120, 150]);
      const ma = load / effort;
      const eff = (ma / vr) * 100;
      if (eff >= 100 || eff < 30) return null;
      return {
        stem: `A machine with a velocity ratio of ${vr} lifts a load of ${qty(load, U.N)} with an effort of ${qty(effort, U.N)}. What is its efficiency?`,
        ...choices(U.pct, eff, [ma * 100, (vr / ma) * 100, ((load - effort) / load) * 100, ma * vr]),
        explanation: `Mechanical advantage = load ÷ effort = ${m(`\\frac{${load}}{${effort}} = ${sci(ma)}`)}.\nEfficiency = ${m(`\\frac{MA}{VR} \\times 100\\% = \\frac{${sci(ma)}}{${vr}} \\times 100\\% = ${sci(eff)}\\%`)}.`,
      };
    },
  },
  {
    key: 'jamb-physics/screw-and-incline',
    topic: [EQ, 'Machines'],
    difficulty: 4,
    make: (r) => {
      if (r.chance(0.5)) {
        const arm = r.pick([14, 21, 28, 35, 42, 49]);
        const pitch = r.pick([0.2, 0.25, 0.4, 0.5, 0.5]);
        const vr = (2 * (22 / 7) * arm) / pitch;
        const eff = r.pick([20, 25, 30, 40, 50]);
        const ma = (eff / 100) * vr;
        return {
          stem: `A screw jack has a pitch of ${qty(pitch, U.cm)} and a handle ${qty(arm, U.cm)} long. If its efficiency is ${eff}%, what is its mechanical advantage? (Take ${m('\\pi = \\tfrac{22}{7}')}.)`,
          ...choices(U.none, ma, [vr, ((22 / 7) * arm * eff) / 100 / pitch, (arm / pitch) * (eff / 100), (2 * (22 / 7) * pitch * eff) / 100]),
          explanation: `In one turn the handle goes round a circle of ${m(`2\\pi \\times ${arm}`)} cm while the load rises one pitch.\n${m(`VR = \\frac{2\\pi r}{p} = \\frac{2 \\times \\tfrac{22}{7} \\times ${arm}}{${num(pitch)}} = ${sci(vr)}`)}.\nMA = efficiency × VR = ${num(eff / 100)} × ${sci(vr)} = ${sci(ma)}.`,
        };
      }
      const [len, h] = r.pick([
        [4, 2],
        [5, 1],
        [6, 2],
        [10, 2],
        [8, 2],
        [3, 1],
        [12, 3],
      ]);
      const load = r.pick([200, 300, 400, 500, 600]);
      const effort = r.pick([80, 100, 120, 150, 200, 250]);
      const vr = len / h;
      const eff = (load / effort / vr) * 100;
      if (eff >= 100 || eff < 30) return null;
      return {
        stem: `A load of ${qty(load, U.N)} is pushed up an inclined plane ${qty(len, U.m)} long onto a platform ${qty(h, U.m)} high, using a force of ${qty(effort, U.N)} along the plane. What is the efficiency?`,
        ...choices(U.pct, eff, [(load / effort) * 100, ((load * len) / (effort * h)) * 100, (effort / load) * vr * 100, (h / len) * 100]),
        explanation: `Work out = ${load} × ${h} = ${load * h} J; work in = ${effort} × ${len} = ${effort * len} J.\nEfficiency = ${m(`\\frac{${load * h}}{${effort * len}} \\times 100\\% = ${sci(eff)}\\%`)}.`,
      };
    },
  },

  // ── Work, energy and power ─────────────────────────────
  {
    key: 'jamb-physics/work-done',
    topic: [WEP, 'Work, energy and power'],
    difficulty: 1,
    make: (r) => {
      if (r.chance(0.5)) {
        const mass = r.pick([2, 3, 5, 10, 20, 50, 60]);
        const h = r.pick([2, 4, 5, 10, 12, 20, 25, 240]);
        return {
          stem: `How much work is done against gravity in lifting a ${qty(mass, U.kg)} load through a height of ${qty(h, U.m)}? (Take ${m(`g = ${G}\\,${U.ms2}`)}.)`,
          ...choices(U.J, mass * G * h, [mass * h, (mass * G) / h, 0.5 * mass * G * h, mass * G]),
          explanation: `${m(`W = mgh = ${mass} \\times ${G} \\times ${h} = ${num(mass * G * h)}`)} J.`,
        };
      }
      const F = r.pick([10, 20, 40, 50, 80, 100]);
      const d = r.pick([2, 3, 5, 8, 10, 20]);
      const th = r.pick([60, 60, 0, 30]);
      const W = F * d * cosD(th);
      return {
        stem: `A force of ${qty(F, U.N)} pulls a box ${qty(d, U.m)} along level ground. The force acts at ${m(`${th}^\\circ`)} to the horizontal. How much work does it do?`,
        ...(th === 0 ? choices(U.J, W, [F / d, 0.5 * F * d, F * d * G, F + d]) : choices(U.J, W, [F * d, F * d * sinD(th), F / d, 0.5 * F * d * sinD(th)])),
        explanation: `Only the part of the force along the motion does work: ${m(`W = Fd\\cos\\theta = ${F} \\times ${d} \\times \\cos ${th}^\\circ = ${sci(W)}`)} J.`,
      };
    },
  },
  {
    key: 'jamb-physics/work-energy',
    topic: [WEP, 'Work, energy and power'],
    difficulty: 2,
    make: (r) => {
      const mass = r.pick([2, 4, 5, 10, 800, 1000, 1200, 1500]);
      const u = r.pick([0, 2, 4, 5, 10]);
      const v = u + r.pick([2, 5, 6, 10]);
      const W = 0.5 * mass * (v * v - u * u);
      return {
        stem: `How much net work is needed to speed up ${an(mass)} ${qty(mass, U.kg)} ${mass >= 800 ? 'car' : 'trolley'} from ${u === 0 ? 'rest' : qty(u, U.ms)} to ${qty(v, U.ms)}?`,
        ...choices(U.J, W, [0.5 * mass * (v - u) ** 2, 0.5 * mass * v * v + (u ? 0 : mass * v), mass * (v * v - u * u), mass * (v - u)]),
        explanation: `Net work = change in kinetic energy: ${m(`\\tfrac{1}{2}m(v^2 - u^2) = \\tfrac{1}{2} \\times ${mass} \\times (${v}^2 - ${u}^2) = ${sci(W)}`)} J.`,
      };
    },
  },
  {
    key: 'jamb-physics/power',
    topic: [WEP, 'Work, energy and power'],
    difficulty: 2,
    make: (r) => {
      if (r.chance(0.5)) {
        const mass = r.pick([40, 50, 60, 80, 100, 200, 500]);
        const h = r.pick([3, 4, 5, 6, 10, 12, 20]);
        const t = r.pick([2, 4, 5, 6, 8, 10, 20, 30]);
        const P = (mass * G * h) / t;
        return {
          stem: `A crane lifts a load of mass ${qty(mass, U.kg)} through ${qty(h, U.m)} in ${qty(t, U.s)}. What power does it develop? (Take ${m(`g = ${G}\\,${U.ms2}`)}.)`,
          ...choices(U.W, P, [mass * G * h, (mass * h) / t, (mass * G * t) / h, (mass * G) / t]),
          explanation: `${m(`P = \\frac{mgh}{t} = \\frac{${mass} \\times ${G} \\times ${h}}{${t}} = ${sci(P)}`)} W.`,
        };
      }
      const mass = r.pick([800, 1000, 1200, 1500, 1600, 2000]);
      const v = r.pick([10, 15, 20, 25, 30]);
      const t = r.pick([5, 10, 15, 20, 25]);
      const P = (0.5 * mass * v * v) / t;
      return {
        stem: `A car of mass ${qty(mass, U.kg)} starts from rest and reaches ${qty(v, U.ms)} in ${qty(t, U.s)}. What average power does the engine develop?`,
        ...choices(U.W, P, [(mass * v * v) / t, (mass * v) / t, 0.5 * mass * v * v, (0.5 * mass * v) / t]),
        explanation: `Work done = kinetic energy gained = ${m(`\\tfrac{1}{2} \\times ${mass} \\times ${v}^2 = ${sci(0.5 * mass * v * v)}`)} J.\n${m(`P = \\frac{W}{t} = \\frac{${sci(0.5 * mass * v * v)}}{${t}} = ${sci(P)}`)} W.`,
      };
    },
  },
  {
    key: 'jamb-physics/energy-conservation',
    topic: [WEP, 'Conservation and forms of energy'],
    difficulty: 2,
    make: (r) => {
      if (r.chance(0.5)) {
        const v = r.pick([10, 20, 30, 40]);
        const h = (v * v) / (2 * G);
        const mass = r.pick([0.5, 1, 2, 5]);
        if (r.chance(0.5)) {
          return {
            stem: `A ${qty(mass, U.kg)} ball falls from rest from a height of ${qty(h, U.m)}. What is its kinetic energy just before it hits the ground? (Take ${m(`g = ${G}\\,${U.ms2}`)}; ignore air resistance.)`,
            ...choices(U.J, mass * G * h, [mass * h, 0.5 * mass * G * h, mass * G * h * 2, mass * v]),
            explanation: `All the potential energy turns into kinetic energy: ${m(`KE = mgh = ${num(mass)} \\times ${G} \\times ${h} = ${sci(mass * G * h)}`)} J.`,
          };
        }
        return {
          stem: `A ball falls from rest from a height of ${qty(h, U.m)}. With what speed does it reach the ground? (Take ${m(`g = ${G}\\,${U.ms2}`)}; ignore air resistance.)`,
          ...choices(U.ms, v, [G * h, Math.sqrt(G * h), 2 * G * h, v / 2]),
          explanation: `${m('mgh = \\tfrac{1}{2}mv^2')}, so ${m(`v = \\sqrt{2gh} = \\sqrt{2 \\times ${G} \\times ${h}} = ${v}`)} m/s.`,
        };
      }
      const mass = r.pick([0.1, 0.2, 0.5, 1]);
      const u = r.pick([5, 10, 15, 20]);
      const h = r.pick([5, 10, 15, 20, 25]);
      const E = 0.5 * mass * u * u + mass * G * h;
      return {
        stem: `A ball of mass ${qty(mass, U.kg)} is thrown vertically upwards at ${qty(u, U.ms)} from the top of a tower ${qty(h, U.m)} high. Ignoring air resistance, what is its total energy just before it hits the ground? (Take ${m(`g = ${G}\\,${U.ms2}`)}; ground level is zero potential energy.)`,
        ...choices(U.J, E, [0.5 * mass * u * u, mass * G * h, 0.5 * mass * u * u - mass * G * h, mass * u + mass * G * h]),
        explanation: `Energy is conserved, so the total just before landing equals the total at the start.\nKE + PE at the top = ${m(`\\tfrac{1}{2} \\times ${num(mass)} \\times ${u}^2 + ${num(mass)} \\times ${G} \\times ${h} = ${sci(E)}`)} J.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-physics/fall-heats',
    topic: [WEP, 'Conservation and forms of energy'],
    difficulty: 3,
    make: (r) => {
      const c = r.pick([125, 130, 250, 400, 450, 500, 900]);
      const h = r.pick([10, 20, 25, 40, 50, 100, 200]);
      const rise = (G * h) / c;
      return {
        stem: `A piece of metal of specific heat capacity ${qty(c, U.JkgK)} falls from rest through ${qty(h, U.m)}. If all its energy on landing becomes heat in the metal, what is its rise in temperature? (Take ${m(`g = ${G}\\,${U.ms2}`)}.)`,
        ...choices(U.C, rise, [h / c, (G * c) / h, (G * h) / (2 * c), c / (G * h)]),
        explanation: `${m('mgh = mc\\Delta\\theta')}. The mass cancels, so ${m(`\\Delta\\theta = \\frac{gh}{c} = \\frac{${G} \\times ${h}}{${c}} = ${sci(rise)}`)} °C.`,
      };
    },
  },
];
