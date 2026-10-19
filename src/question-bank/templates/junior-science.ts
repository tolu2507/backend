import { forExam, num, otherValues, type Template } from './engine.js';

/** Basic Science for BECE (Basic Science and Technology) and Common Entrance: checked fact tables, plus BECE sums. */

const LIVING = 'Living Things';
const MATTER = 'Matter and Materials';
const ENERGY = 'Energy and Forces';
const EARTH = 'Earth and Space';
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const FOOD: [food: string, cls: string][] = [
  ['yam', 'carbohydrates'],
  ['rice', 'carbohydrates'],
  ['garri', 'carbohydrates'],
  ['beans', 'proteins'],
  ['fish', 'proteins'],
  ['eggs', 'proteins'],
  ['palm oil', 'fats and oils'],
  ['groundnut oil', 'fats and oils'],
  ['butter', 'fats and oils'],
  ['oranges', 'vitamins'],
];
const FOOD_JOB: [cls: string, job: string][] = [
  ['carbohydrates', 'give the body energy'],
  ['proteins', 'build and repair the body'],
  ['fats and oils', 'give energy and keep the body warm'],
  ['vitamins', 'help protect the body from diseases'],
  ['minerals such as calcium', 'build strong bones and teeth'],
  ['water', 'carries food substances round the body and cools it'],
];
const ORGANS: [organ: string, job: string][] = [
  ['heart', 'pumps blood round the body'],
  ['lungs', 'take in oxygen and give out carbon dioxide'],
  ['kidneys', 'remove waste from the blood as urine'],
  ['stomach', 'digests food'],
  ['brain', 'controls all the parts of the body'],
  ['skin', 'covers and protects the body'],
  ['small intestine', 'absorbs digested food into the blood'],
];
const LIFE: [description: string, name: string][] = [
  ['taking in oxygen to release energy from food', 'respiration'],
  ['getting rid of waste from the body', 'excretion'],
  ['producing young ones', 'reproduction'],
  ['a permanent increase in size', 'growth'],
  ['responding to changes around it', 'irritability (sensitivity)'],
  ['moving from one place to another', 'locomotion'],
  ['taking in food', 'nutrition'],
];
const DISEASES: [disease: string, spread: string][] = [
  ['malaria', 'the bite of an infected mosquito'],
  ['cholera', 'drinking dirty water or eating contaminated food'],
  ['tuberculosis', 'breathing in germs coughed out by a sick person'],
  ['ringworm', 'touching infected skin or sharing combs and towels'],
  ['sleeping sickness', 'the bite of a tsetse fly'],
];
const STATES: [change: string, name: string][] = [
  ['solid to liquid', 'melting'],
  ['liquid to solid', 'freezing'],
  ['liquid to gas', 'evaporation'],
  ['gas to liquid', 'condensation'],
  ['solid straight to gas', 'sublimation'],
];
const SEPARATION: [mixture: string, method: string][] = [
  ['sand from water', 'filtration'],
  ['salt from salt solution', 'evaporation'],
  ['iron filings from sulphur powder', 'using a magnet'],
  ['pure water from sea water', 'distillation'],
  ['the coloured dyes in ink', 'chromatography'],
  ['chaff from grains of rice', 'winnowing'],
  ['stones from garri', 'sieving'],
  ['oil from water', 'using a separating funnel'],
];
const MACHINES: [example: string, machine: string][] = [
  ['a see-saw', 'lever'],
  ['a crowbar', 'lever'],
  ['the rope and wheel used to raise a flag', 'pulley'],
  ['a ramp for loading a lorry', 'inclined plane'],
  ['an axe', 'wedge'],
  ['a steering wheel', 'wheel and axle'],
  ['a screw jack', 'screw'],
];
const ENERGY_CHANGES: [device: string, change: string][] = [
  ['a battery in use', 'chemical energy to electrical energy'],
  ['an electric bulb', 'electrical energy to light energy'],
  ['an electric fan', 'electrical energy to kinetic (movement) energy'],
  ['a solar panel', 'light energy to electrical energy'],
  ['a generator', 'kinetic (movement) energy to electrical energy'],
  ['a loudspeaker', 'electrical energy to sound energy'],
  ['an electric iron', 'electrical energy to heat energy'],
  ['a microphone', 'sound energy to electrical energy'],
];
const CONDUCTORS = ['copper', 'iron', 'aluminium', 'silver', 'graphite (pencil lead)'];
const INSULATORS = ['rubber', 'plastic', 'dry wood', 'glass', 'cloth', 'paper'];
const MAGNETIC = ['iron', 'steel', 'nickel', 'cobalt'];
const NON_MAGNETIC = ['copper', 'aluminium', 'wood', 'plastic', 'glass', 'paper', 'gold'];
const PLANETS: [fact: string, planet: string][] = [
  ['is closest to the Sun', 'Mercury'],
  ['is the largest planet', 'Jupiter'],
  ['is famous for its bright rings', 'Saturn'],
  ['is called the red planet', 'Mars'],
  ['is the planet we live on', 'Earth'],
  ['is the hottest planet', 'Venus'],
  ['is farthest from the Sun', 'Neptune'],
];
const WEATHER: [instrument: string, measures: string][] = [
  ['rain gauge', 'the amount of rainfall'],
  ['thermometer', 'temperature'],
  ['wind vane', 'the direction of the wind'],
  ['anemometer', 'the speed of the wind'],
  ['barometer', 'air pressure'],
  ['hygrometer', 'humidity (water vapour in the air)'],
];
const UNITS: [quantity: string, unit: string][] = [
  ['length', 'metre'],
  ['mass', 'kilogram'],
  ['time', 'second'],
  ['temperature', 'kelvin'],
  ['electric current', 'ampere'],
  ['force', 'newton'],
  ['energy', 'joule'],
];

/** A two-column fact table asked in both directions; only values that belong to one row are asked backwards. */
function table<T extends [string, string]>(rows: T[], forward: (a: string) => string, backward: (b: string) => string, why: (a: string, b: string) => string): Template['make'] {
  return (r) => {
    const row = r.pick(rows);
    const [a, b] = row;
    if (r.chance(0.5) && rows.filter((x) => x[1] === b).length === 1) {
      return { stem: backward(b), answer: a, wrong: otherValues(r, rows, row, (x) => x[0]), explanation: why(a, b) };
    }
    return { stem: forward(a), answer: b, wrong: otherValues(r, rows, row, (x) => x[1]), explanation: why(a, b) };
  };
}

const science: Template[] = [
  {
    key: 'sci/classes-of-food',
    topic: [LIVING, 'Food and nutrition'],
    difficulty: 1,
    variety: 16,
    make: (r) => {
      if (r.chance(0.5)) {
        const row = r.pick(FOOD_JOB);
        return { stem: `What is the main job of ${row[0]} in the body?`, answer: cap(row[1]), wrong: otherValues(r, FOOD_JOB, row, (x) => cap(x[1])), explanation: `${cap(row[0])} ${row[1]}.` };
      }
      const row = r.pick(FOOD);
      return { stem: `${cap(row[0])} is mainly a source of which class of food?`, answer: row[1], wrong: ['carbohydrates', 'proteins', 'fats and oils', 'vitamins', 'minerals'].filter((x) => x !== row[1]), explanation: `${cap(row[0])} is rich in ${row[1]}.` };
    },
  },
  { key: 'sci/body-organs', topic: [LIVING, 'The human body'], difficulty: 1, variety: 14, make: table(ORGANS, (a) => `What is the main job of the ${a}?`, (b) => `Which organ ${b}?`, (a, b) => `The ${a} ${b}.`) },
  { key: 'sci/living-things', topic: [LIVING, 'Characteristics of living things'], difficulty: 1, variety: 14, make: table(LIFE, (a) => `Which characteristic of living things is ${a}?`, (b) => `What does ${b.replace(/ \(.*\)/, '')} mean?`, (a, b) => `${cap(b)} is ${a}.`) },
  { key: 'sci/diseases', topic: [LIVING, 'Health and diseases'], difficulty: 1, variety: 10, make: table(DISEASES, (a) => `How is ${a} usually spread?`, (b) => `Which disease is spread by ${b}?`, (a, b) => `${cap(a)} is spread by ${b}.`) },
  { key: 'sci/changes-of-state', topic: [MATTER, 'States of matter'], difficulty: 1, variety: 10, make: table(STATES, (a) => `What is the change from ${a} called?`, (b) => `${cap(b)} is the change from`, (a, b) => `${cap(b)} is the change from ${a}.`) },
  { key: 'sci/separation', topic: [MATTER, 'Mixtures and separation'], difficulty: 2, variety: 16, make: table(SEPARATION, (a) => `Which method is best for separating ${a}?`, (b) => `Which of these mixtures is best separated by ${b}?`, (a, b) => `The best way to separate ${a} is ${b}.`) },
  { key: 'sci/simple-machines', topic: [ENERGY, 'Simple machines'], difficulty: 1, variety: 12, make: table(MACHINES, (a) => `What type of simple machine is ${a}?`, (b) => `Which of these is an example of a ${b}?`, (a, b) => `${cap(a)} is a ${b}.`) },
  { key: 'sci/energy-changes', topic: [ENERGY, 'Forms of energy'], difficulty: 2, variety: 16, make: table(ENERGY_CHANGES, (a) => `What energy change happens in ${a}?`, (b) => `Which device changes ${b}?`, (a, b) => `${cap(a)} changes ${b}.`) },
  {
    key: 'sci/conductors-magnets',
    topic: [MATTER, 'Conductors, insulators and magnets'],
    difficulty: 1,
    make: (r) => {
      if (r.chance(0.5)) {
        const ans = r.pick(CONDUCTORS);
        return { stem: 'Which of these materials conducts electricity?', answer: ans, wrong: r.shuffle(INSULATORS).slice(0, 3), explanation: `${cap(ans)} is a conductor. The others (${INSULATORS.slice(0, 4).join(', ')} and so on) are insulators: electricity cannot flow through them.` };
      }
      const ans = r.pick(MAGNETIC);
      return { stem: 'Which of these materials is attracted by a magnet?', answer: ans, wrong: r.shuffle(NON_MAGNETIC).slice(0, 3), explanation: `Magnets attract iron, steel, nickel and cobalt. Most other materials, even metals like copper, aluminium and gold, are not attracted.` };
    },
  },
  { key: 'sci/solar-system', topic: [EARTH, 'The solar system'], difficulty: 1, variety: 14, make: table(PLANETS, (a) => `Which planet ${a}?`, (b) => `Which of these is true of ${b}?`, (a, b) => `${b} ${a}.`) },
  { key: 'sci/weather-instruments', topic: [EARTH, 'Weather and the environment'], difficulty: 1, variety: 12, make: table(WEATHER, (a) => `What does a ${a} measure?`, (b) => `Which instrument measures ${b}?`, (a, b) => `A ${a} measures ${b}.`) },
];

const beceOnly: Template[] = [
  { key: 'sci/si-units', topic: [ENERGY, 'Motion and measurement'], difficulty: 1, variety: 14, make: table(UNITS, (a) => `What is the S.I. unit of ${a}?`, (b) => `The ${b} is the S.I. unit of`, (a, b) => `The S.I. unit of ${a} is the ${b}.`) },
  {
    key: 'sci/speed-density',
    topic: [ENERGY, 'Motion and measurement'],
    difficulty: 2,
    make: (r) => {
      if (r.chance(0.5)) {
        const v = r.pick([2, 3, 4, 5, 6, 8, 10]); // a person walking or cycling
        const t = r.pick([4, 5, 10, 20, 30, 60]);
        const d = v * t;
        return {
          stem: `A cyclist travels ${num(d)} m in ${t} seconds. What is the average speed?`,
          answer: `${num(v)} m/s`,
          wrong: [d * t, t / d, d + t, v * 2].filter((x) => x !== v).map((x) => `${num(Math.round(x * 1000) / 1000)} m/s`),
          explanation: `Speed = distance ÷ time = ${num(d)} ÷ ${t} = ${num(v)} m/s.`,
        };
      }
      const dens = r.pick([0.8, 1, 2.5, 2.7, 7.8, 11.3, 0.5]);
      const V = r.pick([2, 4, 5, 10, 20]);
      const mass = Math.round(dens * V * 100) / 100;
      return {
        stem: `A block has a mass of ${num(mass)} g and a volume of ${V} cm³. What is its density?`,
        answer: `${num(dens)} g/cm³`,
        wrong: [mass * V, V / mass, mass + V, dens * 10].map((x) => `${num(Math.round(x * 1000) / 1000)} g/cm³`),
        explanation: `Density = mass ÷ volume = ${num(mass)} ÷ ${V} = ${num(dens)} g/cm³.`,
      };
    },
  },
];

export const beceScience = () => forExam('bece', [...science, ...beceOnly]);
export const ceScience = () => forExam('ce', science);
