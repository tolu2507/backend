import { m, NAMES, num, type Template } from '../engine.js';
import { asinD, choices, qty, sci, sig, sinD, U } from './kit.js';

const WAVE = 'Waves and Wave Motion';
const LIGHT = 'Light Waves and Optical Instruments';
const C = 3e8;

export const wavesLight: Template[] = [
  // ── Waves ──────────────────────────────────────────────
  {
    key: 'jamb-physics/v-f-lambda',
    topic: [WAVE, 'Types and properties of waves'],
    difficulty: 1,
    make: (r) => {
      const f = r.pick([50, 100, 150, 200, 250, 256, 312, 320, 400, 512]);
      const lambda = r.pick([0.5, 0.8, 1, 1.1, 1.25, 1.5, 2, 2.5]);
      const v = f * lambda;
      const ask = r.pick(['v', 'f', 'lambda', 'T'] as const);
      if (ask === 'v') {
        return {
          stem: `A tuning fork of frequency ${qty(f, U.Hz)} produces a sound wave of wavelength ${qty(lambda, U.m)}. What is the speed of the sound?`,
          ...choices(U.ms, v, [f / lambda, lambda / f, v / 2, f + lambda]),
          explanation: `${m(`v = f\\lambda = ${f} \\times ${num(lambda)} = ${sci(v)}`)} m/s.`,
        };
      }
      if (ask === 'f') {
        return {
          stem: `A wave travels at ${qty(v, U.ms)} and has a wavelength of ${qty(lambda, U.m)}. What is its frequency?`,
          ...choices(U.Hz, f, [v * lambda, lambda / v, f * 2, v - lambda]),
          explanation: `${m(`f = \\frac{v}{\\lambda} = \\frac{${sci(v)}}{${num(lambda)}} = ${f}`)} Hz.`,
        };
      }
      if (ask === 'lambda') {
        return {
          stem: `A source of frequency ${qty(f, U.Hz)} sends waves through a medium at ${qty(v, U.ms)}. What is the wavelength?`,
          ...choices(U.m, lambda, [f / v, v * f, lambda * 2, 1 / lambda]),
          explanation: `${m(`\\lambda = \\frac{v}{f} = \\frac{${sci(v)}}{${f}} = ${num(lambda)}`)} m.`,
        };
      }
      const T = lambda / v;
      return {
        stem: `A sound wave in air has a wavelength of ${qty(lambda, U.m)}. If sound travels at ${qty(v, U.ms)}, what is the period of the wave?`,
        ...choices(U.s, T, [v / lambda, v * lambda, T * 2, T / 2]),
        explanation: `${m(`f = \\frac{v}{\\lambda} = ${f}`)} Hz, and the period is ${m(`T = \\frac{1}{f} = \\frac{1}{${f}} = ${sci(T)}`)} s.`,
        difficulty: 2,
      };
    },
  },
  {
    key: 'jamb-physics/wave-equation',
    topic: [WAVE, 'Types and properties of waves'],
    difficulty: 3,
    make: (r) => {
      const A = r.pick([0.02, 0.05, 0.1, 0.25, 0.5, 2, 5]);
      const w = r.pick([20, 40, 50, 60, 100, 200, 300, 500]);
      const k = r.pick([0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 4]);
      const ask = r.pick(['speed', 'omega', 'k', 'f'] as const);
      const eq = m(`y = ${num(A)}\\sin(${w}t - ${num(k)}x)`);
      const lead = `A wave travelling along the x-direction is described by ${eq}, with x in metres and t in seconds.`;
      if (ask === 'speed') {
        return {
          stem: `${lead} What is the speed of the wave?`,
          ...choices(U.ms, w / k, [w * k, k / w, A * w, w / (2 * Math.PI)]),
          explanation: `Compare with ${m('y = A\\sin(\\omega t - kx)')}: ${m(`\\omega = ${w}`)} and ${m(`k = ${num(k)}`)}.\n${m(`v = \\frac{\\omega}{k} = \\frac{${w}}{${num(k)}} = ${sci(w / k)}`)} m/s.`,
        };
      }
      if (ask === 'omega') {
        return {
          stem: `${lead} What is the angular frequency?`,
          ...choices(U.rads, w, [k, w / (2 * Math.PI), 2 * Math.PI * w, w / k]),
          explanation: `Compare with ${m('y = A\\sin(\\omega t - kx)')}: the number multiplying t is ${m(`\\omega = ${w}`)} rad/s.`,
          difficulty: 2,
        };
      }
      if (ask === 'k') {
        const lambda = (2 * Math.PI) / k;
        return {
          stem: `${lead} What is its wavelength?`,
          ...choices(U.m, lambda, [k, 1 / k, (2 * Math.PI) / w, (2 * Math.PI * w) / k]),
          explanation: `The wave number is ${m(`k = ${num(k)}`)} m⁻¹, and ${m('k = \\frac{2\\pi}{\\lambda}')}.\n${m(`\\lambda = \\frac{2\\pi}{${num(k)}} = ${sci(lambda)}`)} m.`,
        };
      }
      const f = w / (2 * Math.PI);
      return {
        stem: `${lead} What is its frequency?`,
        ...choices(U.Hz, f, [w, 2 * Math.PI * w, w / k, k / (2 * Math.PI)]),
        explanation: `${m(`\\omega = ${w}`)} rad/s and ${m('\\omega = 2\\pi f')}.\n${m(`f = \\frac{${w}}{2\\pi} = ${sci(f)}`)} Hz.`,
      };
    },
  },
  {
    key: 'jamb-physics/echo',
    topic: [WAVE, 'Sound waves and acoustics'],
    difficulty: 2,
    make: (r) => {
      const v = r.pick([320, 330, 340, 350]);
      const who = r.pick(NAMES);
      if (r.chance(0.3)) {
        const t1 = r.pick([1, 1.5, 2, 2.5]);
        const t2 = t1 + r.pick([0.5, 1, 1.5, 2]);
        const D = (v * (t1 + t2)) / 2;
        return {
          stem: `${who} stands between two cliffs and claps once. The first echo comes back after ${qty(t1, U.s)} and the second after ${qty(t2, U.s)}. If sound travels at ${qty(v, U.ms)}, how far apart are the cliffs?`,
          ...choices(U.m, D, [v * (t1 + t2), (v * (t2 - t1)) / 2, (v * t2) / 2, v * t1]),
          explanation: `Each echo travels to a cliff and back, so the cliffs are ${m(`\\frac{${v} \\times ${num(t1)}}{2}`)} m and ${m(`\\frac{${v} \\times ${num(t2)}}{2}`)} m away.\nTotal = ${m(`\\frac{${v}(${num(t1)} + ${num(t2)})}{2} = ${sci(D)}`)} m.`,
          difficulty: 3,
        };
      }
      const t = r.pick([0.5, 0.8, 1, 1.2, 1.5, 2, 3, 4]);
      const d = (v * t) / 2;
      if (r.chance(0.5)) {
        return {
          stem: `${who} claps in front of a tall wall and hears the echo ${qty(t, U.s)} later. If sound travels at ${qty(v, U.ms)}, how far is the wall?`,
          ...choices(U.m, d, [v * t, v / t, (v * t) / 4, 2 * v * t]),
          explanation: `The sound goes to the wall and back, so it covers twice the distance: ${m(`2d = vt`)}.\n${m(`d = \\frac{${v} \\times ${num(t)}}{2} = ${sci(d)}`)} m.`,
        };
      }
      return {
        stem: `A person standing ${qty(d, U.m)} from a cliff hears the echo of a shout ${qty(t, U.s)} after shouting. What is the speed of sound?`,
        ...choices(U.ms, v, [d / t, d * t, (d * t) / 2, (4 * d) / t]),
        explanation: `The sound travels ${m(`2 \\times ${sci(d)} = ${sci(2 * d)}`)} m in ${num(t)} s.\n${m(`v = \\frac{${sci(2 * d)}}{${num(t)}} = ${v}`)} m/s.`,
      };
    },
  },
  {
    key: 'jamb-physics/string-frequency',
    topic: [WAVE, 'Sound waves and acoustics'],
    difficulty: 4,
    make: (r) => {
      if (r.chance(0.4)) {
        const f0 = r.pick([100, 200, 250, 256, 300]);
        const k = r.pick([2, 3, 4]);
        const what = r.pick(['tension', 'length'] as const);
        const f1 = what === 'tension' ? f0 * k : f0 / k;
        return {
          stem:
            what === 'tension'
              ? `A stretched string gives a note of ${qty(f0, U.Hz)}. If the tension is made ${k * k} times as large, keeping the length the same, what note does it give?`
              : `A stretched string gives a note of ${qty(f0, U.Hz)}. If its vibrating length is made ${k} times as long, keeping the tension the same, what note does it give?`,
          ...choices(U.Hz, f1, what === 'tension' ? [f0 * k * k, f0 / k, f0 * 2 * k] : [f0 * k, f0 / (k * k), f0]),
          explanation:
            what === 'tension'
              ? `${m('f = \\frac{1}{2L}\\sqrt{\\frac{T}{\\mu}}')}: frequency goes with the square root of tension.\nTension ×${k * k} → frequency ×${k}: ${f0} × ${k} = ${f1} Hz.`
              : `${m('f = \\frac{1}{2L}\\sqrt{\\frac{T}{\\mu}}')}: frequency is inversely proportional to length.\nLength ×${k} → frequency ÷${k}: ${m(`\\frac{${f0}}{${k}} = ${sci(f1)}`)} Hz.`,
          difficulty: 3,
        };
      }
      const L = r.pick([0.4, 0.5, 0.6, 0.8, 1]);
      const massG = r.pick([2, 4, 5, 8, 10]);
      const mu = massG / 1000 / L;
      const v = r.pick([100, 120, 150, 200, 250, 300, 400]);
      const T = v * v * mu;
      if (!Number.isInteger(T)) return null;
      const f0 = v / (2 * L);
      const n = r.pick([0, 1, 2, 3]);
      const f = (n + 1) * f0;
      const nth = ['fundamental note', 'first overtone', 'second overtone', 'third overtone'][n];
      return {
        stem: `A wire ${qty(L, U.m)} long has a mass of ${qty(massG, U.g)} and is stretched by a tension of ${qty(T, U.N)}. What is the frequency of its ${nth}?`,
        ...choices(U.Hz, f, [f0 * (n + 2), n ? f0 : 3 * f0, v / (4 * L), f * 2, v * L]),
        explanation: `Mass per unit length: ${m(`\\mu = \\frac{${num(massG / 1000)}}{${num(L)}} = ${sci(mu)}`)} kg/m.\nWave speed: ${m(`v = \\sqrt{\\frac{T}{\\mu}} = \\sqrt{\\frac{${num(T)}}{${sci(mu)}}} = ${v}`)} m/s.\nFundamental: ${m(`f_0 = \\frac{v}{2L} = \\frac{${v}}{${num(2 * L)}} = ${sci(f0)}`)} Hz.${n ? `\nThe ${nth} is harmonic number ${n + 1}: ${n + 1} × ${sci(f0)} = ${sci(f)} Hz.` : ''}`,
      };
    },
  },
  {
    key: 'jamb-physics/pipe-resonance',
    topic: [WAVE, 'Sound waves and acoustics'],
    difficulty: 3,
    make: (r) => {
      const v = r.pick([320, 330, 340]);
      if (r.chance(0.4)) {
        const lambda = r.pick([0.4, 0.5, 0.6, 0.64, 0.8, 1]);
        const L1 = lambda / 4;
        const L2 = (3 * lambda) / 4;
        const f = v / lambda;
        return {
          stem: `In a resonance tube experiment, the first resonance is at ${qty(L1 * 100, U.cm)} and the second at ${qty(L2 * 100, U.cm)}. If sound travels at ${qty(v, U.ms)}, what is the frequency of the tuning fork?`,
          ...choices(U.Hz, f, [v / (L2 - L1), v / (4 * L1) / 2, v / (L1 + L2), v / L2]),
          explanation: `The two resonances are half a wavelength apart: ${m(`\\frac{\\lambda}{2} = ${sci(L2 * 100)} - ${sci(L1 * 100)} = ${sci((L2 - L1) * 100)}`)} cm, so ${m(`\\lambda = ${num(lambda)}`)} m.\n${m(`f = \\frac{v}{\\lambda} = \\frac{${v}}{${num(lambda)}} = ${sci(f)}`)} Hz. (This way the end correction cancels out.)`,
          difficulty: 4,
        };
      }
      const L = r.pick([0.2, 0.25, 0.4, 0.5, 0.8, 1]);
      const closed = r.chance(0.5);
      const f = closed ? v / (4 * L) : v / (2 * L);
      return {
        stem: `What is the fundamental frequency of a pipe ${qty(L * 100, U.cm)} long that is ${closed ? 'closed at one end' : 'open at both ends'}? (Speed of sound = ${qty(v, U.ms)}; ignore end corrections.)`,
        ...choices(U.Hz, f, closed ? [v / (2 * L), v / L, v / (4 * L * 100)] : [v / (4 * L), v / L, v / (2 * L * 100)]),
        explanation: closed
          ? `A closed pipe's fundamental fits a quarter of a wavelength: ${m(`\\lambda = 4L = ${num(4 * L)}`)} m.\n${m(`f = \\frac{v}{4L} = \\frac{${v}}{${num(4 * L)}} = ${sci(f)}`)} Hz.`
          : `An open pipe's fundamental fits half a wavelength: ${m(`\\lambda = 2L = ${num(2 * L)}`)} m.\n${m(`f = \\frac{v}{2L} = \\frac{${v}}{${num(2 * L)}} = ${sci(f)}`)} Hz.`,
      };
    },
  },
  {
    key: 'jamb-physics/em-wavelength',
    topic: [WAVE, 'Electromagnetic waves'],
    difficulty: 2,
    make: (r) => {
      const fm = r.chance(0.5);
      const f = fm ? r.pick([88, 90, 92.3, 96, 100, 101.5, 105]) * 1e6 : r.pick([500, 600, 750, 900, 1000, 1200]) * 1e3;
      const lambda = C / f;
      return {
        stem: `A ${fm ? 'radio station broadcasts on' : 'medium-wave station broadcasts at'} ${fm ? m(`${num(f / 1e6)}\\,\\text{MHz}`) : m(`${num(f / 1e3)}\\,\\text{kHz}`)}. What is the wavelength of its waves? (Speed of light = ${qty(C, U.ms)}.)`,
        ...choices(U.m, lambda, [f / C, lambda * 1000, lambda / 1000, (C / f) * 2]),
        explanation: `Change the frequency to hertz: ${m(`${sci(f)}`)} Hz.\n${m(`\\lambda = \\frac{c}{f} = \\frac{3 \\times 10^{8}}{${sci(f)}} = ${sci(lambda)}`)} m.`,
      };
    },
  },

  // ── Light ──────────────────────────────────────────────
  {
    key: 'jamb-physics/plane-mirror',
    topic: [LIGHT, 'Reflection at plane surfaces'],
    difficulty: 2,
    variety: 20,
    make: (r) => {
      const kind = r.pick(['moves', 'rotate', 'images'] as const);
      if (kind === 'images') {
        const th = r.pick([20, 30, 36, 40, 45, 60, 72, 90, 120]);
        const n = 360 / th - 1;
        return {
          stem: `Two plane mirrors are inclined at ${m(`${th}^\\circ`)} to each other. How many images of an object between them can be seen?`,
          answer: String(n),
          wrong: [String(n + 1), String(n - 1), String(360 / th + 1), String(180 / th)],
          explanation: `${m(`n = \\frac{360}{\\theta} - 1 = \\frac{360}{${th}} - 1 = ${n}`)}.`,
        };
      }
      if (kind === 'rotate') {
        const th = r.pick([5, 10, 12, 15, 20, 25, 30, 35]);
        return {
          stem: `A ray of light strikes a plane mirror. If the mirror is turned through ${m(`${th}^\\circ`)} while the ray stays fixed, through what angle does the reflected ray turn?`,
          ...choices(U.deg, 2 * th, [th, th / 2, 90 - th, 180 - 2 * th]),
          explanation: `Turning the mirror by θ changes both the angle of incidence and the angle of reflection by θ, so the reflected ray turns through ${m('2\\theta')}: ${m(`2 \\times ${th} = ${2 * th}^\\circ`)}.`,
        };
      }
      const x = r.pick([2, 3, 4, 5, 6, 8, 10]);
      const y = r.pick([0.5, 1, 1.5, 2]);
      if (y >= x) return null;
      const who = r.pick(NAMES);
      if (r.chance(0.5)) {
        return {
          stem: `${who} stands ${qty(x, U.m)} in front of a plane mirror. If the mirror is moved ${qty(y, U.m)} towards ${who}, what is the new distance between ${who} and the image?`,
          ...choices(U.m, 2 * (x - y), [2 * x, x - y, 2 * x - y, 2 * (x + y)]),
          explanation: `The image is as far behind the mirror as the object is in front.\nNew distance to the mirror = ${num(x)} − ${num(y)} = ${num(x - y)} m, so the image is ${m(`2 \\times ${num(x - y)} = ${num(2 * (x - y))}`)} m away.`,
        };
      }
      return {
        stem: `${who} stands ${qty(x, U.m)} in front of a plane mirror and walks ${qty(y, U.m)} towards it. By how much does the distance between ${who} and the image change?`,
        ...choices(U.m, 2 * y, [y, 2 * (x - y), x - y, 4 * y]),
        explanation: `${who} gets ${num(y)} m closer to the mirror, and the image also gets ${num(y)} m closer to it.\nThe gap between them shrinks by ${m(`2 \\times ${num(y)} = ${num(2 * y)}`)} m.`,
      };
    },
  },
  {
    key: 'jamb-physics/curved-mirror',
    topic: [LIGHT, 'Reflection at curved mirrors'],
    difficulty: 3,
    make: (r) => {
      const f = r.pick([5, 10, 12, 15, 20]);
      if (r.chance(0.35)) {
        // Convex: always a virtual image behind the mirror. Real-is-positive: f is negative.
        const u = r.pick([10, 15, 20, 30, 35, 40, 60]);
        const vAbs = (u * f) / (u + f);
        return {
          stem: `An object is placed ${qty(u, U.cm)} in front of a convex mirror of focal length ${qty(f, U.cm)}. Where is the image?`,
          answer: `${qty(vAbs, U.cm)} behind the mirror`,
          wrong: [
            `${qty(vAbs, U.cm)} in front of the mirror`,
            `${qty(u === f ? u * 2 : (u * f) / Math.abs(u - f), U.cm)} behind the mirror`,
            `${qty(u === f ? u * 2 : (u * f) / Math.abs(u - f), U.cm)} in front of the mirror`,
            `${qty(u, U.cm)} behind the mirror`,
          ],
          explanation: `Using real-is-positive, a convex mirror has a negative focal length: ${m(`f = -${f}`)} cm.\n${m(`\\frac{1}{v} = \\frac{1}{f} - \\frac{1}{u} = -\\frac{1}{${f}} - \\frac{1}{${u}}`)}, so ${m(`v = -${sci(vAbs)}`)} cm.\nNegative means virtual: the image is ${sci(vAbs)} cm behind the mirror.`,
          difficulty: 4,
        };
      }
      const u = (r.pick([2, 3, 4, 6]) * f) / r.pick([1, 1, 2]);
      if (u <= f) return null;
      const v = (u * f) / (u - f);
      const mag = v / u;
      if (r.chance(0.5)) {
        return {
          stem: `An object is placed ${qty(u, U.cm)} in front of a concave mirror of focal length ${qty(f, U.cm)}. How far from the mirror is the image?`,
          ...choices(U.cm, v, [(u * f) / (u + f), u - f, u + f, (1 / (1 / f + 1 / u)) * 2]),
          explanation: `${m('\\frac{1}{f} = \\frac{1}{u} + \\frac{1}{v}')}: ${m(`\\frac{1}{v} = \\frac{1}{${f}} - \\frac{1}{${num(u)}}`)}, so ${m(`v = \\frac{uf}{u - f} = \\frac{${num(u)} \\times ${f}}{${num(u - f)}} = ${sci(v)}`)} cm (real, in front of the mirror).`,
        };
      }
      return {
        stem: `An object is placed ${qty(u, U.cm)} in front of a concave mirror of focal length ${qty(f, U.cm)}. What is the magnification of the image?`,
        ...choices(U.none, mag, [u / v, f / u, v / f, mag * 2]),
        explanation: `First the image distance: ${m(`v = \\frac{uf}{u - f} = ${sci(v)}`)} cm.\nMagnification = ${m(`\\frac{v}{u} = \\frac{${sci(v)}}{${num(u)}} = ${sci(mag)}`)}.`,
      };
    },
  },
  {
    key: 'jamb-physics/lens-formula',
    topic: [LIGHT, 'Optical instruments'],
    difficulty: 3,
    make: (r) => {
      if (r.chance(0.4)) {
        // Object–image distance and magnification given (a JAMB favourite).
        const M = r.pick([2, 3, 4, 5]);
        const D = r.pick([20, 30, 40, 45, 48, 50, 60, 80, 90, 100]);
        const u = D / (M + 1);
        const v = M * u;
        const f = (u * v) / (u + v);
        return {
          stem: `A convex lens forms a real image ${M} times the size of the object. The distance between the object and the image is ${qty(D, U.cm)}. What is the focal length of the lens?`,
          ...choices(U.cm, f, [D / M, D / (M + 1), (u + v) / 2, (v - u) / 2]),
          explanation: `Real image, magnification ${M}: ${m(`v = ${M}u`)}, and ${m(`u + v = ${D}`)}, so ${m(`u = ${sci(u)}`)} cm and ${m(`v = ${sci(v)}`)} cm.\n${m(`f = \\frac{uv}{u + v} = \\frac{${sci(u)} \\times ${sci(v)}}{${D}} = ${sci(f)}`)} cm.`,
          difficulty: 4,
        };
      }
      const f = r.pick([5, 10, 12, 15, 20, 25]);
      const u = f * r.pick([1.5, 2, 3, 4, 5]);
      const v = (u * f) / (u - f);
      return {
        stem: `An object is placed ${qty(u, U.cm)} from a converging lens of focal length ${qty(f, U.cm)}. How far from the lens is the image?`,
        ...choices(U.cm, v, [(u * f) / (u + f), u - f, u + f, u]),
        explanation: `${m('\\frac{1}{f} = \\frac{1}{u} + \\frac{1}{v}')}, so ${m(`v = \\frac{uf}{u - f} = \\frac{${num(u)} \\times ${f}}{${num(u - f)}} = ${sci(v)}`)} cm.`,
      };
    },
  },
  {
    key: 'jamb-physics/lens-power',
    topic: [LIGHT, 'Optical instruments'],
    difficulty: 3,
    make: (r) => {
      const kind = r.pick(['power', 'combined', 'near-point', 'telescope'] as const);
      if (kind === 'telescope') {
        const fo = r.pick([50, 60, 80, 100, 120, 150]);
        const fe = r.pick([2, 4, 5, 6, 10]);
        if (r.chance(0.5)) {
          return {
            stem: `An astronomical telescope in normal adjustment has an objective of focal length ${qty(fo, U.cm)} and an eyepiece of focal length ${qty(fe, U.cm)}. What is its magnifying power?`,
            ...choices(U.none, fo / fe, [fe / fo, fo + fe, fo * fe, fo - fe]),
            explanation: `In normal adjustment, ${m(`M = \\frac{f_o}{f_e} = \\frac{${fo}}{${fe}} = ${sci(fo / fe)}`)}.`,
            difficulty: 2,
          };
        }
        return {
          stem: `An astronomical telescope has an objective of focal length ${qty(fo, U.cm)} and an eyepiece of focal length ${qty(fe, U.cm)}. How far apart are the lenses in normal adjustment?`,
          ...choices(U.cm, fo + fe, [fo - fe, fo / fe, fo * fe, fo]),
          explanation: `In normal adjustment the focal points meet, so the separation is ${m(`f_o + f_e = ${fo} + ${fe} = ${fo + fe}`)} cm.`,
          difficulty: 2,
        };
      }
      if (kind === 'near-point') {
        const N = r.pick([50, 75, 100, 125, 150, 200]);
        const P = 1 / 0.25 - 1 / (N / 100);
        return {
          stem: `The near point of a long-sighted person's eye is ${qty(N, U.cm)}. What is the power of the lens that lets them read a book held ${qty(25, U.cm)} away?`,
          ...choices(U.D, P, [1 / 0.25 + 1 / (N / 100), -P, 1 / (N / 100), 100 / N + 25 / 100]),
          explanation: `The lens must form a virtual image of the book (u = 0.25 m) at the near point (v = −${num(N / 100)} m).\n${m(`P = \\frac{1}{f} = \\frac{1}{0.25} - \\frac{1}{${num(N / 100)}} = ${sci(P)}`)} D (a converging lens).`,
          difficulty: 4,
        };
      }
      const f1 = r.pick([10, 20, 25, 40, 50]);
      if (kind === 'combined') {
        const f2 = r.pick([20, 25, 40, 50, 100]);
        const P = 100 / f1 - 100 / f2;
        if (P === 0) return null;
        return {
          stem: `A converging lens of focal length ${qty(f1, U.cm)} is placed in contact with a diverging lens of focal length ${qty(f2, U.cm)}. What is the power of the combination?`,
          ...choices(U.D, P, [100 / f1 + 100 / f2, 1 / f1 - 1 / f2, -P, 100 / (f1 + f2)]),
          explanation: `Powers add, with a diverging lens counted as negative. In dioptres, ${m('P = \\frac{1}{f}')} with f in metres.\n${m(`P = \\frac{1}{${num(f1 / 100)}} - \\frac{1}{${num(f2 / 100)}} = ${sci(100 / f1)} - ${sci(100 / f2)} = ${sci(P)}`)} D.`,
        };
      }
      const diverging = r.chance(0.4);
      const P = (diverging ? -100 : 100) / f1;
      return {
        stem: `What is the power of a ${diverging ? 'diverging' : 'converging'} lens of focal length ${qty(f1, U.cm)}?`,
        ...choices(U.D, P, [-P, (diverging ? -1 : 1) / f1, f1 / 100, (diverging ? -1 : 1) * f1]),
        explanation: `${m('P = \\frac{1}{f}')} with f in metres (${num(f1 / 100)} m)${diverging ? ', and a diverging lens has a negative focal length' : ''}: ${m(`P = ${sci(P)}`)} D.`,
        difficulty: 2,
      };
    },
  },
  {
    key: 'jamb-physics/refractive-index',
    topic: [LIGHT, 'Refraction of light'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['speed', 'depth', 'wavelength'] as const);
      const n = r.pick([1.25, 1.33, 1.4, 1.5, 1.6, 2, 2.4]);
      if (kind === 'speed') {
        return {
          stem: `The refractive index of a material is ${num(n)}. If light travels at ${qty(C, U.ms)} in a vacuum, how fast does it travel in the material?`,
          ...choices(U.ms, C / n, [C * n, C, n / C, C / (n * n)]),
          explanation: `${m(`n = \\frac{c}{v}`)}, so ${m(`v = \\frac{3 \\times 10^{8}}{${num(n)}} = ${sci(C / n)}`)} m/s.`,
        };
      }
      if (kind === 'depth') {
        const real = r.pick([20, 30, 40, 60, 80, 120]);
        const nn = r.pick([1.33, 1.5, 1.6, 1.25]);
        const app = real / nn;
        if (r.chance(0.5)) {
          return {
            stem: `A coin lies at the bottom of a pool of liquid ${qty(real, U.cm)} deep. The liquid's refractive index is ${num(nn)}. How deep does the coin appear when viewed from directly above?`,
            ...choices(U.cm, app, [real * nn, real - nn, real - app, real / (2 * nn)]),
            explanation: `${m('n = \\frac{\\text{real depth}}{\\text{apparent depth}}')}, so apparent depth = ${m(`\\frac{${real}}{${num(nn)}} = ${sci(app)}`)} cm.`,
          };
        }
        return {
          stem: `A coin at the bottom of a pool of liquid ${qty(real, U.cm)} deep appears to be ${qty(app, U.cm)} below the surface when viewed from directly above. What is the refractive index of the liquid?`,
          ...choices(U.none, nn, [app / real, real - app, (real - app) / real, real / (real - app)]),
          explanation: `${m(`n = \\frac{\\text{real depth}}{\\text{apparent depth}} = \\frac{${real}}{${sci(app)}} = ${sci(nn)}`)}.`,
        };
      }
      const lambda = r.pick([450, 500, 589, 600, 650]);
      const nl = r.pick([1.33, 1.5, 1.458, 1.6]);
      if (r.chance(0.5)) {
        return {
          stem: `Light of wavelength ${m(`${lambda}\\,\\text{nm}`)} in a vacuum enters glass of refractive index ${num(nl)}. What is its wavelength in the glass?`,
          answer: m(`${sci(lambda / nl)}\\,\\text{nm}`),
          wrong: [lambda * nl, lambda, lambda / (nl * nl), lambda - nl * 100].map((x) => m(`${sci(x)}\\,\\text{nm}`)),
          explanation: `The frequency doesn't change, but the speed drops by a factor of n, so the wavelength does too: ${m(`\\frac{${lambda}}{${num(nl)}} = ${sci(lambda / nl)}`)} nm.`,
          difficulty: 3,
        };
      }
      const f = C / (lambda * 1e-9);
      return {
        stem: `Light of wavelength ${m(`${lambda}\\,\\text{nm}`)} in a vacuum passes into glass of refractive index ${num(nl)}. What is its frequency in the glass? (Speed of light = ${qty(C, U.ms)}.)`,
        ...choices(U.Hz, f, [f / nl, f * nl, C / lambda, f / 1000]),
        explanation: `Frequency is set by the source and doesn't change from one medium to another.\n${m(`f = \\frac{c}{\\lambda} = \\frac{3 \\times 10^{8}}{${lambda} \\times 10^{-9}} = ${sci(f)}`)} Hz.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'jamb-physics/snell',
    topic: [LIGHT, 'Refraction of light'],
    difficulty: 3,
    make: (r) => {
      if (r.chance(0.5)) {
        const n = r.pick([1.33, 1.5, 1.6, 2, 2.42]);
        const c = asinD(1 / n);
        if (r.chance(0.5)) {
          return {
            stem: `What is the critical angle for light going from a material of refractive index ${num(n)} into air?`,
            ...choices(U.deg, c, [90 - c, asinD(1 / (n * n)) || 10, (1 / n) * 90, c / 2], 3),
            explanation: `${m(`\\sin c = \\frac{1}{n} = \\frac{1}{${num(n)}} = ${sig(1 / n, 3)}`)}, so ${m(`c = ${sci(c)}^\\circ`)}.`,
            difficulty: 2,
          };
        }
        const cc = r.pick([30, 45, 60, 40, 50]);
        const nn = 1 / sinD(cc);
        return {
          stem: `The critical angle of a glass is ${m(`${cc}^\\circ`)}. What is its refractive index?`,
          ...choices(U.none, nn, [sinD(cc), 1 / Math.cos((cc * Math.PI) / 180), cc / 30, nn * nn]),
          explanation: `${m(`n = \\frac{1}{\\sin c} = \\frac{1}{\\sin ${cc}^\\circ} = \\frac{1}{${sig(sinD(cc), 3)}} = ${sci(nn)}`)}.`,
          difficulty: 2,
        };
      }
      const i = r.pick([30, 40, 45, 50, 60]);
      const n = r.pick([1.33, 1.5, 1.6]);
      const sr = sinD(i) / n;
      const rr = asinD(sr);
      return {
        stem: `A ray of light in air strikes a glass block at an angle of incidence of ${m(`${i}^\\circ`)}. The refractive index of the glass is ${num(n)}. What is the angle of refraction?`,
        ...choices(U.deg, rr, [i / n, asinD(Math.min(1, sinD(i) * n * 0.9)), 90 - rr, i - rr]),
        explanation: `Snell's law: ${m('n = \\frac{\\sin i}{\\sin r}')}.\n${m(`\\sin r = \\frac{\\sin ${i}^\\circ}{${num(n)}} = \\frac{${sig(sinD(i), 3)}}{${num(n)}} = ${sig(sr, 3)}`)}, so ${m(`r = ${sci(rr)}^\\circ`)}.`,
      };
    },
  },
  {
    key: 'jamb-physics/pinhole',
    topic: [LIGHT, 'Reflection at plane surfaces'],
    difficulty: 1,
    make: (r) => {
      const h = r.pick([2, 4, 5, 10, 20, 40]);
      const u = r.pick([10, 20, 25, 30, 40, 50, 100]);
      const v = r.pick([5, 8, 10, 12, 15, 20]);
      const img = (h * v) / u;
      if (r.chance(0.5)) {
        return {
          stem: `An object ${qty(h, U.m)} tall stands ${qty(u, U.m)} from a pinhole camera. The screen is ${qty(v, U.cm)} behind the pinhole. How tall is the image?`,
          ...choices(U.cm, img, [(h * u) / v, img / 100, (h * v) / u / 10, h * v]),
          explanation: `Magnification = ${m('\\frac{\\text{image distance}}{\\text{object distance}}')}. Work in centimetres: object distance = ${u * 100} cm, height = ${h * 100} cm.\nImage height = ${m(`${h * 100} \\times \\frac{${v}}{${u * 100}} = ${sci(img)}`)} cm.`,
          difficulty: 2,
        };
      }
      const H = r.pick([20, 30, 40, 50, 60]);
      const U2 = r.pick([20, 30, 40, 60, 80]);
      const I = r.pick([5, 10, 15, 20]);
      const V = (I * U2) / H;
      return {
        stem: `An object ${qty(H, U.cm)} high is ${qty(U2, U.cm)} from a pinhole camera. If the image is ${qty(I, U.cm)} high, how far is the screen from the pinhole?`,
        ...choices(U.cm, V, [(H * U2) / I, (H * I) / U2, U2 - I, U2 / 2]),
        explanation: `${m('\\frac{\\text{image height}}{\\text{object height}} = \\frac{\\text{image distance}}{\\text{object distance}}')}.\n${m(`v = ${U2} \\times \\frac{${I}}{${H}} = ${sci(V)}`)} cm.`,
      };
    },
  },
];
