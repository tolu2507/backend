import { bearing, deg, Frac, gcd, isInt, m, num, rad, signed, TOWNS, type Template } from '../engine.js';

const GEO = 'Euclidean Geometry';
const TRIG = 'Trigonometry';
const MENS = 'Mensuration';
const COORD = 'Coordinate Geometry';
const dg = (x: number) => m(`${x}^\\circ`);
const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [12, 16, 20], [20, 21, 29]];

/** "3x - 2y = 7" with a positive x coefficient. */
function line(a: number, b: number, c: number) {
  if (a < 0 || (a === 0 && b < 0)) [a, b, c] = [-a, -b, -c];
  const g = gcd(gcd(Math.abs(a), Math.abs(b)), Math.abs(c)) || 1;
  [a, b, c] = [a / g, b / g, c / g];
  const x = a === 0 ? '' : `${a === 1 ? '' : a}x`;
  const y = b === 0 ? '' : `${x ? (b < 0 ? ' - ' : ' + ') : b < 0 ? '-' : ''}${Math.abs(b) === 1 ? '' : Math.abs(b)}y`;
  return m(`${x}${y} = ${c}`);
}

export const geometry: Template[] = [
  {
    key: 'jamb-maths/polygon-angles',
    topic: [GEO, 'Polygons and their angles'],
    difficulty: 2,
    make: (r) => {
      const n = r.pick([5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 36]);
      const interior = 180 - 360 / n;
      const kind = r.pick(['sum', 'sides', 'ratio'] as const);
      if (kind === 'sum') {
        return {
          stem: `Each interior angle of a regular polygon is ${dg(interior)}. Find the sum of all its interior angles.`,
          answer: dg((n - 2) * 180),
          wrong: [dg(n * 180), dg((n - 1) * 180), dg((n - 4) * 90)],
          explanation: `Each exterior angle is ${m(`180^\\circ - ${interior}^\\circ = ${360 / n}^\\circ`)}, so the polygon has ${m(`\\frac{360}{${360 / n}} = ${n}`)} sides.\nSum of interior angles = ${m(`(n - 2) \\times 180^\\circ = ${n - 2} \\times 180^\\circ = ${(n - 2) * 180}^\\circ`)}.`,
        };
      }
      if (kind === 'sides') {
        return {
          stem: `Each interior angle of a regular polygon is ${dg(interior)}. How many sides does it have?`,
          answer: String(n),
          wrong: [String(n + 2), String(n - 2), String(Math.round(360 / interior)) === String(n) ? String(n * 2) : String(Math.round(360 / interior))],
          explanation: `Exterior angle = ${m(`180^\\circ - ${interior}^\\circ = ${360 / n}^\\circ`)}. Number of sides = ${m(`\\frac{360^\\circ}{${360 / n}^\\circ} = ${n}`)}.`,
          difficulty: 1,
        };
      }
      const k = r.int(2, 5);
      return {
        stem: `Each interior angle of a regular polygon is ${k} times its exterior angle. How many sides does the polygon have?`,
        answer: String(2 * (k + 1)),
        wrong: [String(k + 1), String(2 * k), String(4 * (k + 1))],
        explanation: `Interior + exterior = ${dg(180)}, so ${m(`${k}e + e = 180^\\circ`)} and ${m(`e = ${180 / (k + 1)}^\\circ`)}.\nNumber of sides = ${m(`\\frac{360}{${180 / (k + 1)}} = ${2 * (k + 1)}`)}.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-maths/circle-theorems',
    topic: [GEO, 'Circles and circle theorems'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['centre', 'cyclic', 'semicircle', 'tangent'] as const);
      const x = r.int(16, 82);
      if (kind === 'centre') {
        return {
          stem: `In a circle with centre O, the chord AB subtends an angle of ${dg(2 * x)} at O. Find the angle that AB subtends at a point C on the major arc.`,
          answer: dg(x),
          wrong: [dg(2 * x), dg(4 * x > 360 ? 180 - x : 4 * x), dg(180 - 2 * x)],
          explanation: `The angle at the centre is twice the angle at the circumference, so ${m(`\\angle ACB = \\frac{${2 * x}^\\circ}{2} = ${x}^\\circ`)}.`,
        };
      }
      if (kind === 'cyclic') {
        return {
          stem: `PQRS is a cyclic quadrilateral. If ${m(`\\angle PQR = ${x + 40}^\\circ`)}, find ${m('\\angle PSR')}.`,
          answer: dg(140 - x),
          wrong: [dg(x + 40), dg(360 - (x + 40)), dg(Math.abs(50 - x) || 90)],
          explanation: `Opposite angles of a cyclic quadrilateral add up to ${dg(180)}: ${m(`\\angle PSR = 180^\\circ - ${x + 40}^\\circ = ${140 - x}^\\circ`)}.`,
        };
      }
      if (kind === 'semicircle') {
        const a = r.int(15, 75);
        return {
          stem: `AB is a diameter of a circle and C is a point on the circumference. If ${m(`\\angle CAB = ${a}^\\circ`)}, find ${m('\\angle CBA')}.`,
          answer: dg(90 - a),
          wrong: [dg(180 - a), dg(a), dg(90 + a)],
          explanation: `The angle in a semicircle is a right angle, so ${m('\\angle ACB = 90^\\circ')}.\nAngles in triangle ABC: ${m(`\\angle CBA = 180^\\circ - 90^\\circ - ${a}^\\circ = ${90 - a}^\\circ`)}.`,
        };
      }
      const a = r.int(15, 75);
      return {
        stem: `PT is a tangent to a circle with centre O, touching it at T. If ${m(`\\angle TOP = ${a}^\\circ`)}, find ${m('\\angle TPO')}.`,
        answer: dg(90 - a),
        wrong: [dg(a), dg(180 - a), dg(2 * a)],
        explanation: `A tangent is perpendicular to the radius at the point of contact, so ${m('\\angle OTP = 90^\\circ')}.\n${m(`\\angle TPO = 180^\\circ - 90^\\circ - ${a}^\\circ = ${90 - a}^\\circ`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/triangle-angles',
    topic: [GEO, 'Angles and lines'],
    difficulty: 1,
    make: (r) => {
      if (r.chance(0.5)) {
        const v = r.int(10, 80) * 2;
        return {
          stem: `The vertical angle of an isosceles triangle is ${dg(v)}. Find each of its base angles.`,
          answer: dg((180 - v) / 2),
          wrong: [dg(180 - v), dg(v / 2), dg(90 - v / 4 === (180 - v) / 2 ? 90 : Math.round(90 - v / 4))],
          explanation: `The base angles are equal and the three angles add up to ${dg(180)}: ${m(`\\frac{180^\\circ - ${v}^\\circ}{2} = ${(180 - v) / 2}^\\circ`)}.`,
        };
      }
      const a = r.int(25, 80);
      const b = r.int(25, 80);
      return {
        stem: `Two interior angles of a triangle are ${dg(a)} and ${dg(b)}. Find the exterior angle at the third vertex.`,
        answer: dg(a + b),
        wrong: [dg(180 - a - b), dg(360 - a - b), dg(Math.abs(a - b) || 90)],
        explanation: `An exterior angle equals the sum of the two interior opposite angles: ${m(`${a}^\\circ + ${b}^\\circ = ${a + b}^\\circ`)}.`,
      };
    },
  },

  // ── Trigonometry ────────────────────────────────────────────
  {
    key: 'jamb-maths/special-angles',
    topic: [TRIG, 'Trigonometrical ratios and identities'],
    difficulty: 2,
    make: (r) => {
      const half = new Frac(1, 2);
      const f = [
        { tex: '\\sin 30^\\circ', val: half, swap: null },
        { tex: '\\cos 60^\\circ', val: half, swap: null },
        { tex: '\\tan 45^\\circ', val: new Frac(1), swap: null },
        { tex: '\\sin 90^\\circ', val: new Frac(1), swap: new Frac(0) },
        { tex: '\\cos 0^\\circ', val: new Frac(1), swap: new Frac(0) },
        { tex: '\\sin^2 60^\\circ', val: new Frac(3, 4), swap: new Frac(1, 4) },
        { tex: '\\cos^2 30^\\circ', val: new Frac(3, 4), swap: new Frac(1, 4) },
        { tex: '\\sin^2 45^\\circ', val: half, swap: null },
        { tex: '\\tan^2 60^\\circ', val: new Frac(3), swap: new Frac(1, 3) },
        { tex: '\\tan^2 30^\\circ', val: new Frac(1, 3), swap: new Frac(3) },
        { tex: '\\cos^2 60^\\circ', val: new Frac(1, 4), swap: new Frac(3, 4) },
      ];
      const [f1, f2] = r.shuffle(f).slice(0, 2);
      const [c1, c2] = [r.int(1, 6), r.int(1, 6)];
      const plus = r.chance(0.6);
      const combine = (a: Frac, b: Frac, add: boolean) => a.mul(c1)[add ? 'add' : 'sub'](b.mul(c2));
      const ans = combine(f1.val, f2.val, plus);
      const wrong = [combine(f1.val, f2.val, !plus), f1.swap ? combine(f1.swap, f2.val, plus) : ans.add(1), f2.swap ? combine(f1.val, f2.swap, plus) : ans.sub(new Frac(1, 2)), ans.neg()];
      const term = (c: number, t: string) => `${c === 1 ? '' : c}${t}`;
      return {
        stem: `Evaluate ${m(`${term(c1, f1.tex)} ${plus ? '+' : '-'} ${term(c2, f2.tex)}`)} without using tables.`,
        answer: m(ans.tex()),
        wrong: wrong.map((w) => m(w.tex())),
        explanation: `${m(`${f1.tex} = ${f1.val.tex()}`)} and ${m(`${f2.tex} = ${f2.val.tex()}`)}.\nSo ${m(`${c1} \\times ${f1.val.tex()} ${plus ? '+' : '-'} ${c2} \\times ${f2.val.tex()} = ${ans.tex()}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/angle-of-elevation',
    topic: [TRIG, 'Angles of elevation and depression'],
    difficulty: 3,
    make: (r) => {
      const theta = r.pick([25, 28, 32, 35, 38, 40, 42, 48, 50, 52, 55, 58, 62, 65, 68, 70, 72, 75, 78]);
      const tan = Number(Math.tan(rad(theta)).toFixed(3));
      const d = r.int(4, 30) * 5;
      const elevation = r.chance(0.5);
      if (elevation) {
        const thing = r.pick(['tree', 'flagpole', 'mast', 'building']);
        const h = Math.round(d * tan);
        return {
          stem: `The angle of elevation of the top of a ${thing} from a point on level ground ${d}m from its foot is ${dg(theta)}. Find the height of the ${thing}, correct to the nearest metre. (Take ${m(`\\tan ${theta}^\\circ = ${tan}`)}.)`,
          answer: m(`${h}\\text{ m}`),
          wrong: [Math.round(d / tan), Math.round(d * Math.sin(rad(theta))), Math.round(d * Math.cos(rad(theta))), h + 10].map((x) => m(`${x}\\text{ m}`)),
          explanation: `The height is opposite the angle and the ${d}m is adjacent, so ${m(`\\tan ${theta}^\\circ = \\frac{h}{${d}}`)}.\n${m(`h = ${d} \\times ${tan} = ${num(d * tan)} \\approx ${h}\\text{ m}`)}.`,
        };
      }
      const h = r.int(4, 40) * 5;
      const dist = Math.round(h / tan);
      return {
        stem: `From the top of a cliff ${h}m high, the angle of depression of a boat at sea is ${dg(theta)}. How far is the boat from the foot of the cliff, correct to the nearest metre? (Take ${m(`\\tan ${theta}^\\circ = ${tan}`)}.)`,
        answer: m(`${dist}\\text{ m}`),
        wrong: [Math.round(h * tan), Math.round(h / Math.sin(rad(theta))), Math.round(h * Math.cos(rad(theta))), dist + 10].map((x) => m(`${x}\\text{ m}`)),
        explanation: `The angle of depression equals the angle of elevation from the boat (alternate angles), so ${m(`\\tan ${theta}^\\circ = \\frac{${h}}{d}`)}.\n${m(`d = \\frac{${h}}{${tan}} = ${num(h / tan, 2)} \\approx ${dist}\\text{ m}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/bearings-distance',
    topic: [TRIG, 'Bearings and distances'],
    difficulty: 3,
    make: (r) => {
      const [A, B] = r.shuffle(TOWNS).slice(0, 2);
      if (r.chance(0.5)) {
        const [p, q, hyp] = r.pick(TRIPLES);
        const k = r.int(1, 4);
        const [north, east] = r.chance(0.5) ? [p * k, q * k] : [q * k, p * k];
        return {
          stem: `A car leaves ${A}, travels ${north}km due north and then ${east}km due east to reach ${B}. How far is ${B} from ${A} in a straight line?`,
          answer: m(`${hyp * k}\\text{ km}`),
          wrong: [north + east, north * north + east * east, Math.abs(north - east) || hyp * k * 2].map((x) => m(`${num(x)}\\text{ km}`)),
          explanation: `The two journeys are at right angles, so use Pythagoras: ${m(`d = \\sqrt{${north}^2 + ${east}^2} = \\sqrt{${north * north + east * east}} = ${hyp * k}\\text{ km}`)}.`,
        };
      }
      const north = r.int(5, 30);
      const east = r.int(4, 30);
      const alpha = deg(Math.atan(east / north));
      return {
        stem: `Points X and Y are ${north}km due north and ${east}km due east of a point O respectively. Find the bearing of Y from X, correct to the nearest degree.`,
        answer: m(bearing(180 - alpha)),
        wrong: [m(bearing(alpha)), m(bearing(180 + alpha)), m(bearing(360 - alpha)), m(bearing(90 + alpha))],
        explanation: `At X, the angle between the line XO (due south) and XY is ${m(`\\tan^{-1}\\frac{${east}}{${north}} \\approx ${Math.round(alpha)}^\\circ`)}.\nY is south-east of X, so its bearing is ${m(`180^\\circ - ${Math.round(alpha)}^\\circ = ${bearing(180 - alpha)}`)}.`,
        difficulty: 4,
      };
    },
  },
  {
    key: 'jamb-maths/trig-quadrants',
    topic: [TRIG, 'Trigonometrical ratios and identities'],
    difficulty: 2,
    variety: 12,
    make: (r) => {
      const cases: [string, boolean, string, boolean, number][] = [
        ['\\sin', true, '\\cos', false, 2], ['\\tan', true, '\\sin', false, 3], ['\\cos', true, '\\sin', false, 4], ['\\sin', true, '\\tan', false, 2],
        ['\\cos', false, '\\tan', true, 3], ['\\tan', false, '\\cos', true, 4], ['\\sin', false, '\\cos', false, 3], ['\\sin', true, '\\cos', true, 1],
      ];
      const [f1, s1, f2, s2, q] = r.pick(cases);
      const [a, b] = r.chance(0.5) ? [[f1, s1], [f2, s2]] as const : [[f2, s2], [f1, s1]] as const;
      const name = ['', 'First', 'Second', 'Third', 'Fourth'];
      return {
        stem: `If ${m(`${a[0]}\\theta`)} is ${a[1] ? 'positive' : 'negative'} and ${m(`${b[0]}\\theta`)} is ${b[1] ? 'positive' : 'negative'}, in which quadrant does ${m('\\theta')} lie?`,
        answer: `${name[q]} quadrant only`,
        wrong: [1, 2, 3, 4].filter((x) => x !== q).map((x) => `${name[x]} quadrant only`),
        explanation: `All ratios are positive in the first quadrant, only sine in the second, only tangent in the third and only cosine in the fourth ("All Students Take Chemistry").\nThe signs given match the ${name[q].toLowerCase()} quadrant.`,
      };
    },
  },
  {
    key: 'jamb-maths/complementary-angles',
    topic: [TRIG, 'Trigonometrical equations'],
    difficulty: 3,
    make: (r) => {
      const x = r.int(3, 20);
      const [a, c] = [r.int(1, 6), r.int(1, 6)];
      const b = r.int(-40, 40);
      const d = 90 - (a + c) * x - b;
      const A = a * x + b;
      const C = c * x + d;
      if (A <= 0 || A >= 90 || C <= 0 || C >= 90 || Math.abs(d) > 60 || a === c) return null;
      const viaEqual = (d - b) / (a - c);
      const via180 = (180 - b - d) / (a + c);
      const ang = (k: number, s: number) => `(${k === 1 ? '' : k}x ${signed(s)})^\\circ`.replace(' + 0)', ')');
      return {
        stem: `If ${m(`\\sin ${ang(a, b)} = \\cos ${ang(c, d)}`)}, where both angles are acute, find the value of ${m('x')}.`,
        answer: dg(x),
        wrong: [isInt(viaEqual) && viaEqual > 0 ? dg(viaEqual) : dg(x + 3), isInt(via180) ? dg(via180) : dg(2 * x), dg(x + 1), dg(Math.max(1, x - 2))],
        explanation: `${m('\\sin A = \\cos B')} when ${m('A + B = 90^\\circ')}.\n${m(`${a === 1 ? '' : a}x ${signed(b)} + ${c === 1 ? '' : c}x ${signed(d)} = 90`)}, so ${m(`${a + c}x = ${90 - b - d}`)} and ${m(`x = ${x}^\\circ`)}.`,
      };
    },
  },

  // ── Mensuration ─────────────────────────────────────────────
  {
    key: 'jamb-maths/cylinder-depth',
    topic: [MENS, 'Volumes and surface areas'],
    difficulty: 2,
    make: (r) => {
      const radius = r.pick([7, 14, 21, 28]);
      const h = r.int(2, 30);
      const V = (22 / 7) * radius * radius * h;
      return {
        stem: `A cylindrical tank has a capacity of ${m(`${num(V)}\\text{ m}^3`)}. What is its depth if the diameter of its base is ${radius * 2}m? (Take ${m('\\pi = \\frac{22}{7}')}.)`,
        answer: m(`${h}\\text{ m}`),
        wrong: [num(h / 4), num(h * radius), num(2 * h), num(h / 2)].map((x) => m(`${x}\\text{ m}`)),
        explanation: `${m('V = \\pi r^2 h')} with radius ${m(`r = \\frac{${radius * 2}}{2} = ${radius}`)}.\n${m(`${num(V)} = \\frac{22}{7} \\times ${radius}^2 \\times h = ${num((22 / 7) * radius * radius)}h`)}, so ${m(`h = ${h}\\text{ m}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/cuboid-surface-area',
    topic: [MENS, 'Volumes and surface areas'],
    difficulty: 2,
    make: (r) => {
      const [l, w, h] = r.shuffle([3, 4, 5, 6, 7, 8, 9, 10, 12, 15]).slice(0, 3);
      const tsa = 2 * (l * w + l * h + w * h);
      return {
        stem: `Calculate the total surface area of a closed box measuring ${l}cm by ${w}cm by ${h}cm.`,
        answer: m(`${num(tsa)}\\text{ cm}^2`),
        wrong: [l * w * h, tsa / 2, 2 * (l * w + l * h), 4 * (l * w + l * h + w * h)].map((x) => m(`${num(x)}\\text{ cm}^2`)),
        explanation: `A cuboid has three pairs of equal faces: ${m(`2(lw + lh + wh) = 2(${l * w} + ${l * h} + ${w * h}) = ${tsa}\\text{ cm}^2`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/sector-perimeter',
    topic: [MENS, 'Lengths and perimeters'],
    difficulty: 3,
    make: (r) => {
      const radius = r.pick([7, 14, 21, 28, 35]);
      const theta = r.pick([30, 45, 60, 72, 90, 120, 135, 150, 210, 240, 270, 300]);
      const arc = new Frac(theta * 44 * radius, 360 * 7);
      const show = (f: Frac) => m(`${f.isInt ? f.n : num(f.value, 2)}\\text{ cm}`);
      return {
        stem: `An arc of a circle of radius ${radius}cm subtends an angle of ${dg(theta)} at the centre. Find the perimeter of the sector formed. (Take ${m('\\pi = \\frac{22}{7}')}.)`,
        answer: show(arc.add(2 * radius)),
        wrong: [show(arc), show(arc.add(radius)), show(new Frac(44 * radius, 7).add(2 * radius)), show(arc.mul(2).add(2 * radius))],
        explanation: `Arc length = ${m(`\\frac{${theta}}{360} \\times 2 \\times \\frac{22}{7} \\times ${radius} = ${arc.isInt ? arc.n : num(arc.value, 2)}\\text{ cm}`)}.\nThe perimeter also includes the two radii: ${m(`${arc.isInt ? arc.n : num(arc.value, 2)} + 2 \\times ${radius} = ${arc.add(2 * radius).isInt ? arc.add(2 * radius).n : num(arc.add(2 * radius).value, 2)}\\text{ cm}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/equilateral-area',
    topic: [MENS, 'Areas of plane figures'],
    difficulty: 2,
    make: (r) => {
      const a = r.int(2, 20);
      const coef = new Frac(a * a, 4);
      const root3 = (f: Frac) => m(`${f.equals(1) ? '' : f.tex()}\\sqrt{3}\\text{ cm}^2`);
      return {
        stem: `Calculate the area of an equilateral triangle of side ${a}cm.`,
        answer: root3(coef),
        wrong: [root3(coef.mul(2)), m(`${coef.tex()}\\text{ cm}^2`), root3(new Frac(a, 2)), root3(coef.mul(4))],
        explanation: `Area = ${m('\\frac{1}{2}ab\\sin C')}, and every angle is ${dg(60)}: ${m(`\\frac{1}{2} \\times ${a} \\times ${a} \\times \\frac{\\sqrt{3}}{2} = ${coef.tex()}\\sqrt{3}\\text{ cm}^2`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/cone-volume',
    topic: [MENS, 'Volumes and surface areas'],
    difficulty: 2,
    make: (r) => {
      const radius = r.pick([7, 14, 21]);
      const h = r.int(1, 10) * 3;
      const V = ((22 / 7) * radius * radius * h) / 3;
      return {
        stem: `A cone has base radius ${radius}cm and height ${h}cm. Find its volume. (Take ${m('\\pi = \\frac{22}{7}')}.)`,
        answer: m(`${num(V)}\\text{ cm}^3`),
        wrong: [3 * V, 4 * V, V / radius * 3].map((x) => m(`${num(Math.round(x))}\\text{ cm}^3`)),
        explanation: `${m(`V = \\frac{1}{3}\\pi r^2 h = \\frac{1}{3} \\times \\frac{22}{7} \\times ${radius}^2 \\times ${h} = ${num(V)}\\text{ cm}^3`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/laps-of-track',
    topic: [MENS, 'Lengths and perimeters'],
    difficulty: 2,
    make: (r) => {
      const d = r.pick([70, 100, 140, 200, 350]);
      const D = r.int(2, 10) * 500;
      const exact = D / ((22 / 7) * d);
      const laps = Math.round(exact);
      if (Math.abs(exact - laps) > 0.4 || laps < 2) return null;
      return {
        stem: `How many times, correct to the nearest whole number, will an athlete run round a circular track of diameter ${d}m to cover ${num(D)}m? (Take ${m('\\pi = \\frac{22}{7}')}.)`,
        answer: String(laps),
        wrong: [String(Math.round(D / d)), String(Math.round(exact * 2)), String(laps + 1), String(Math.max(1, laps - 1))],
        explanation: `One lap is the circumference: ${m(`\\pi d = \\frac{22}{7} \\times ${d} = ${num((22 / 7) * d, 2)}\\text{ m}`)}.\nLaps = ${m(`\\frac{${num(D)}}{${num((22 / 7) * d, 2)}} \\approx ${num(exact, 2)}`)}, so about ${laps}.`,
      };
    },
  },

  // ── Coordinate geometry ─────────────────────────────────────
  {
    key: 'jamb-maths/distance-midpoint',
    topic: [COORD, 'Distance between points and midpoints'],
    difficulty: 2,
    make: (r) => {
      const [x1, y1] = [r.int(-6, 8), r.int(-6, 8)];
      if (r.chance(0.55)) {
        const [p, q, hyp] = r.pick(TRIPLES.slice(0, 5));
        const [dx, dy] = [p * (r.chance(0.5) ? 1 : -1), q * (r.chance(0.5) ? 1 : -1)];
        const [x2, y2] = [x1 + dx, y1 + dy];
        return {
          stem: `Find the distance between the points ${m(`P(${x1}, ${y1})`)} and ${m(`Q(${x2}, ${y2})`)}.`,
          answer: m(`${hyp}\\text{ units}`),
          wrong: [p + q, p * p + q * q, Math.abs(p - q) || hyp + 2, hyp * 2].map((x) => m(`${x}\\text{ units}`)),
          explanation: `${m(`PQ = \\sqrt{(${x2} - ${x1 < 0 ? `(${x1})` : x1})^2 + (${y2} - ${y1 < 0 ? `(${y1})` : y1})^2} = \\sqrt{${dx * dx} + ${dy * dy}} = ${hyp}`)}.`,
        };
      }
      const [x2, y2] = [r.int(-8, 10), r.int(-8, 10)];
      if (x1 === x2 && y1 === y2) return null;
      const mid = (a: number, b: number) => new Frac(a + b, 2).tex();
      const pt = (a: string, b: string) => m(`(${a}, ${b})`);
      return {
        stem: `Find the midpoint of the line joining ${m(`A(${x1}, ${y1})`)} and ${m(`B(${x2}, ${y2})`)}.`,
        answer: pt(mid(x1, x2), mid(y1, y2)),
        wrong: [pt(new Frac(x2 - x1, 2).tex(), new Frac(y2 - y1, 2).tex()), pt(String(x1 + x2), String(y1 + y2)), pt(mid(y1, y2), mid(x1, x2)), pt(new Frac(-(x1 + x2), 2).tex(), mid(y1, y2))],
        explanation: `Midpoint = ${m(`\\left(\\frac{x_1 + x_2}{2}, \\frac{y_1 + y_2}{2}\\right) = \\left(\\frac{${x1 + x2}}{2}, \\frac{${y1 + y2}}{2}\\right)`)} = ${pt(mid(x1, x2), mid(y1, y2))}.`,
        difficulty: 1,
      };
    },
  },
  {
    key: 'jamb-maths/gradient',
    topic: [COORD, 'Gradient and equation of lines'],
    difficulty: 1,
    make: (r) => {
      const [x1, y1, x2, y2] = [r.int(-6, 8), r.int(-6, 8), r.int(-6, 8), r.int(-6, 8)];
      if (x1 === x2 || y1 === y2) return null;
      const g = new Frac(y2 - y1, x2 - x1);
      return {
        stem: `Find the gradient of the line joining the points ${m(`(${x1}, ${y1})`)} and ${m(`(${x2}, ${y2})`)}.`,
        answer: m(g.tex()),
        wrong: [m(new Frac(x2 - x1, y2 - y1).tex()), m(g.neg().tex()), m(new Frac(x2 - x1, y2 - y1).neg().tex()), m(new Frac(y2 + y1, x2 + x1 || 1).tex())],
        explanation: `Gradient = ${m(`\\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${y2} - ${y1 < 0 ? `(${y1})` : y1}}{${x2} - ${x1 < 0 ? `(${x1})` : x1}} = \\frac{${y2 - y1}}{${x2 - x1}} = ${g.tex()}`)}.`,
      };
    },
  },
  {
    key: 'jamb-maths/parallel-perpendicular-lines',
    topic: [COORD, 'Parallel and perpendicular lines'],
    difficulty: 3,
    make: (r) => {
      const a = r.int(1, 7);
      const b = r.int(-7, 7);
      if (b === 0 || gcd(a, Math.abs(b)) !== 1) return null;
      const c = r.int(-12, 12);
      const [x0, y0] = [r.int(-5, 6), r.int(-5, 6)];
      const parallel = r.chance(0.5);
      const ans = parallel ? line(a, b, a * x0 + b * y0) : line(b, -a, b * x0 - a * y0);
      const other = parallel ? line(b, -a, b * x0 - a * y0) : line(a, b, a * x0 + b * y0);
      return {
        stem: `Find the equation of the line through ${m(`(${x0}, ${y0})`)} that is ${parallel ? 'parallel' : 'perpendicular'} to the line ${line(a, b, c)}.`,
        answer: ans,
        wrong: [other, parallel ? line(a, b, -(a * x0 + b * y0)) : line(b, -a, -(b * x0 - a * y0)), parallel ? line(a, -b, a * x0 - b * y0) : line(b, a, b * x0 + a * y0)],
        explanation: `The line ${line(a, b, c)} has gradient ${m(new Frac(-a, b).tex())}.\n${parallel ? `A parallel line has the same gradient, so it has the form ${m(`${a}x ${signed(b)}y = k`)}.` : `A perpendicular line has gradient ${m(new Frac(b, a).tex())} (negative reciprocal), so it has the form ${m(b < 0 ? `${-b}x ${signed(a)}y = k` : `${b}x ${signed(-a)}y = k`)}.`}\nSubstitute ${m(`(${x0}, ${y0})`)} to find ${m('k')}: ${ans}.`.replace(/1x/g, 'x').replace(/([+-] )1y/g, '$1y'),
      };
    },
  },
];
