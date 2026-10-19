import { factPairs, itemSet, m, naira, num, type Template } from '../engine.js';

/** Financial Accounting and Geography for JAMB, WAEC and NECO. */

const FIN = 'Final Accounts';
const BASICS = 'Accounting Basics';

export const accounting: Template[] = [
  {
    key: 'accounts/depreciation',
    topic: ['Fixed Assets', 'Depreciation'],
    difficulty: 3,
    make: (r) => {
      const cost = r.pick([100_000, 200_000, 250_000, 400_000, 500_000]);
      if (r.chance(0.5)) {
        const residual = r.pick([0, 10_000, 20_000, 50_000]);
        const years = r.pick([4, 5, 8, 10]);
        const dep = (cost - residual) / years;
        if (!Number.isInteger(dep)) return null;
        return {
          stem: `A machine costs ${naira(cost)}. It is expected to last ${years} years and have a scrap value of ${naira(residual)}. What is the yearly depreciation by the straight-line method?`,
          answer: naira(dep),
          wrong: [cost / years, (cost + residual) / years, cost - residual, dep * 2].filter((x) => x !== dep && Number.isInteger(x)).map(naira),
          explanation: `Straight line: ${m('\\frac{\\text{cost} - \\text{scrap value}}{\\text{years}}')} = (${naira(cost)} − ${naira(residual)}) ÷ ${years} = ${naira(dep)} a year.`,
        };
      }
      const rate = r.pick([10, 20, 25]);
      const n = r.pick([2, 3]);
      let nbv = cost;
      const steps: string[] = [];
      for (let i = 1; i <= n; i++) {
        const d = (nbv * rate) / 100;
        steps.push(`Year ${i}: ${rate}% of ${naira(nbv)} = ${naira(d)}, leaving ${naira(nbv - d)}`);
        nbv -= d;
      }
      if (!Number.isInteger(nbv)) return null;
      return {
        stem: `A vehicle bought for ${naira(cost)} is depreciated at ${rate}% a year on the reducing balance. What is its book value after ${n} years?`,
        answer: naira(nbv),
        wrong: [cost - (cost * rate * n) / 100, (cost * rate) / 100, cost * (1 - rate / 100)].filter((x) => x !== nbv).map((x) => naira(Math.round(x))),
        explanation: `Each year the rate applies to what is left:\n${steps.join('.\n')}.`,
      };
    },
  },
  {
    key: 'accounts/equation',
    topic: [BASICS, 'The accounting equation'],
    difficulty: 2,
    make: (r) => {
      const capital = r.pick([50_000, 80_000, 120_000, 200_000]);
      const liab = r.pick([20_000, 30_000, 45_000, 60_000]);
      const assets = capital + liab;
      const ask = r.pick(['capital', 'assets', 'liabilities'] as const);
      const given = { capital: `assets of ${naira(assets)} and liabilities of ${naira(liab)}`, assets: `capital of ${naira(capital)} and liabilities of ${naira(liab)}`, liabilities: `assets of ${naira(assets)} and capital of ${naira(capital)}` }[ask];
      const ans = { capital, assets, liabilities: liab }[ask];
      return {
        stem: `A business has ${given}. What is its ${ask === 'liabilities' ? 'total liabilities' : ask === 'assets' ? 'total assets' : 'capital'}?`,
        answer: naira(ans),
        wrong: [assets + liab, capital + assets, Math.abs(capital - liab), ans * 2].filter((x) => x !== ans).map(naira),
        explanation: `${m('\\text{Assets} = \\text{Capital} + \\text{Liabilities}')}: ${naira(assets)} = ${naira(capital)} + ${naira(liab)}, so the ${ask} ${ask === 'capital' ? 'is' : 'are'} ${naira(ans)}.`,
      };
    },
  },
  {
    key: 'accounts/final-accounts',
    topic: [FIN, 'Trading, profit and loss account'],
    difficulty: 3,
    make: (r) => {
      const sales = r.pick([200_000, 250_000, 300_000, 400_000]);
      const cos = sales * r.pick([0.5, 0.6, 0.7, 0.75]);
      const gp = sales - cos;
      const exp = r.pick([20_000, 30_000, 40_000, 50_000]);
      const np = gp - exp;
      if (r.chance(0.5)) {
        return {
          stem: `A business had sales of ${naira(sales)}, cost of goods sold of ${naira(cos)} and expenses of ${naira(exp)}. What is its net profit?`,
          answer: naira(np),
          wrong: [gp, sales - exp, np + exp * 2, sales - cos - 2 * exp].filter((x) => x > 0 && x !== np).map(naira),
          explanation: `Gross profit = ${naira(sales)} − ${naira(cos)} = ${naira(gp)}.\nNet profit = gross profit − expenses = ${naira(gp)} − ${naira(exp)} = ${naira(np)}.`,
        };
      }
      const margin = (gp / sales) * 100;
      return {
        stem: `Sales were ${naira(sales)} and cost of goods sold was ${naira(cos)}. What is the gross profit margin?`,
        answer: `${num(margin)}%`,
        wrong: [(gp / cos) * 100, (cos / sales) * 100, (np / sales) * 100].map((x) => `${num(Math.round(x * 100) / 100)}%`),
        explanation: `Gross profit = ${naira(gp)}. Margin = gross profit ÷ sales × 100 = ${num(margin)}%. (Gross profit ÷ cost would be the mark-up.)`,
      };
    },
  },
  {
    key: 'accounts/ratios',
    topic: [FIN, 'Interpretation of accounts'],
    difficulty: 3,
    make: (r) => {
      const cl = r.pick([20_000, 40_000, 50_000, 80_000]);
      const ratio = r.pick([1.5, 2, 2.5, 3, 0.8]);
      const ca = cl * ratio;
      const stock = r.pick([0.25, 0.4, 0.5]) * ca;
      if (r.chance(0.5)) {
        return {
          stem: `A business has current assets of ${naira(ca)} and current liabilities of ${naira(cl)}. What is its current ratio?`,
          answer: `${num(ratio)} : 1`,
          wrong: [cl / ca, ratio + 1, (ca - cl) / cl, ratio * 2].filter((x) => x > 0 && Math.abs(x - ratio) > 1e-9).map((x) => `${num(Math.round(x * 100) / 100)} : 1`),
          explanation: `Current ratio = current assets ÷ current liabilities = ${naira(ca)} ÷ ${naira(cl)} = ${num(ratio)} : 1.`,
        };
      }
      const quick = (ca - stock) / cl;
      return {
        stem: `Current assets are ${naira(ca)}, including stock of ${naira(stock)}. Current liabilities are ${naira(cl)}. What is the acid-test (quick) ratio?`,
        answer: `${num(Math.round(quick * 100) / 100)} : 1`,
        wrong: [ratio, (ca + stock) / cl, stock / cl].filter((x) => Math.abs(x - quick) > 0.005).map((x) => `${num(Math.round(x * 100) / 100)} : 1`),
        explanation: `The acid test leaves out stock: (${naira(ca)} − ${naira(stock)}) ÷ ${naira(cl)} = ${num(Math.round(quick * 100) / 100)} : 1.`,
      };
    },
  },
  itemSet('accounts/double-entry', [BASICS, 'Double entry'], 2, [
    { stem: 'A business buys furniture for cash. Which account is debited?', answer: 'furniture account', wrong: ['cash account', 'capital account', 'sales account'], explanation: 'The asset received (furniture) is debited; the asset given up (cash) is credited.' },
    { stem: 'The owner brings ₦50,000 cash into the business as capital. Which account is credited?', answer: 'capital account', wrong: ['cash account', 'drawings account', 'bank charges account'], explanation: 'Cash (an asset) is debited and capital is credited.' },
    { stem: 'Goods are bought on credit from Ade. Which account is credited?', answer: 'Ade’s account', wrong: ['purchases account', 'cash account', 'sales account'], explanation: 'Purchases is debited; the creditor, Ade, is credited.' },
    { stem: 'Rent is paid by cheque. Which account is debited?', answer: 'rent account', wrong: ['bank account', 'capital account', 'rent received account'], explanation: 'The expense (rent) is debited and the bank account is credited.' },
    { stem: 'Goods are sold on credit to Ngozi. Which account is debited?', answer: 'Ngozi’s account', wrong: ['sales account', 'cash account', 'purchases account'], explanation: 'The debtor, Ngozi, is debited and sales is credited.' },
    { stem: 'Which of these increases on the credit side of its account?', answer: 'a liability', wrong: ['an asset', 'an expense', 'drawings'], explanation: 'Liabilities, capital and income increase on the credit side; assets, expenses and drawings on the debit side.' },
  ]),
  factPairs(
    'accounts/concepts',
    [BASICS, 'Accounting concepts'],
    2,
    [
      ['going concern', 'assumes the business will continue to operate in the foreseeable future'],
      ['prudence', 'records losses when expected but profits only when earned'],
      ['consistency', 'uses the same methods from one period to the next'],
      ['accruals (matching)', 'matches income and expenses to the period they belong to'],
      ['business entity', 'treats the business as separate from its owner'],
      ['money measurement', 'records only items that can be measured in money'],
    ],
    { forward: (a) => `The ${a} concept`, backward: (b) => `Which accounting concept ${b}?`, why: (a, b) => `The ${a} concept ${b}.` },
  ),
  itemSet('accounts/books', [BASICS, 'Books of original entry'], 2, [
    { stem: 'Which book is both a book of original entry and part of the ledger?', answer: 'the cash book', wrong: ['the sales journal', 'the purchases journal', 'the journal proper'], explanation: 'The cash book records cash and bank items first and also acts as the cash and bank accounts.' },
    { stem: 'The trial balance is prepared to', answer: 'check the arithmetical accuracy of the ledger', wrong: ['find the net profit', 'show the financial position', 'record credit sales'], explanation: 'If total debits equal total credits, the double entry is arithmetically correct.' },
    { stem: 'Which error is NOT revealed by a trial balance?', answer: 'error of omission', wrong: ['a single-sided entry', 'adding a column wrongly', 'entering a debit as a credit in one account only'], explanation: 'If a transaction is left out entirely, both sides are still equal.' },
    { stem: 'A statement showing assets, liabilities and capital on a given date is a', answer: 'balance sheet', wrong: ['trading account', 'profit and loss account', 'cash book'], explanation: 'The balance sheet (statement of financial position) shows the position on one date.' },
  ]),
];

const GEO = 'Physical Geography';
const MAP = 'Practical Geography';
const NG = 'Geography of Nigeria';

export const geography: Template[] = [
  {
    key: 'geography/map-scale',
    topic: [MAP, 'Map reading and scale'],
    difficulty: 2,
    make: (r) => {
      const scale = r.pick([25_000, 50_000, 100_000, 250_000, 500_000]);
      const cm = r.pick([2, 3, 4, 5, 6, 8, 10, 12]);
      const km = (cm * scale) / 100_000;
      if (r.chance(0.6)) {
        return {
          stem: `On a map with a scale of 1 : ${num(scale, undefined, 4)}, two towns are ${cm} cm apart. What is the actual distance between them?`,
          answer: `${num(km)} km`,
          wrong: [km * 10, km / 10, (cm * scale) / 1000, km * 100].map((x) => `${num(x)} km`),
          explanation: `1 cm on the map is ${num(scale, undefined, 4)} cm on the ground = ${num(scale / 100_000)} km.\n${cm} cm × ${num(scale / 100_000)} = ${num(km)} km.`,
        };
      }
      return {
        stem: `Two places ${num(km)} km apart are shown on a map with a scale of 1 : ${num(scale, undefined, 4)}. How far apart are they on the map?`,
        answer: `${cm} cm`,
        wrong: [cm * 10, cm / 10, cm * 2].map((x) => `${num(x)} cm`),
        explanation: `1 cm stands for ${num(scale / 100_000)} km, so ${num(km)} ÷ ${num(scale / 100_000)} = ${cm} cm.`,
      };
    },
  },
  {
    key: 'geography/longitude-time',
    topic: [GEO, 'The earth and its movements'],
    difficulty: 3,
    make: (r) => {
      const deg = r.pick([15, 30, 45, 60, 75, 90, 105, 120, 22.5, 37.5]);
      const minutes = deg * 4;
      const dir = r.pick(['east', 'west'] as const);
      const baseH = r.int(6, 16);
      const local = baseH * 60 + (dir === 'east' ? minutes : -minutes);
      const fmt = (t: number) => {
        const tt = ((t % 1440) + 1440) % 1440;
        const h = Math.floor(tt / 60);
        return `${h % 12 || 12}:${String(tt % 60).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
      };
      return {
        stem: `When it is ${fmt(baseH * 60)} at Greenwich (0°), what is the local time at a place ${num(deg)}° ${dir}?`,
        answer: fmt(local),
        wrong: [fmt(baseH * 60 + (dir === 'east' ? -minutes : minutes)), fmt(baseH * 60 + (dir === 'east' ? deg : -deg)), fmt(local + 60)],
        explanation: `The earth turns 360° in 24 hours, so 1° = 4 minutes. ${num(deg)}° = ${num(minutes)} minutes.\nPlaces east are ahead of Greenwich; places west are behind. So ${fmt(baseH * 60)} ${dir === 'east' ? '+' : '−'} ${num(minutes)} min = ${fmt(local)}`,
      };
    },
  },
  {
    key: 'geography/lapse-rate',
    topic: [GEO, 'Weather and climate'],
    difficulty: 3,
    make: (r) => {
      const base = r.pick([24, 26, 28, 30, 32]);
      const h = r.pick([1000, 1500, 2000, 3000, 4000]);
      const t = base - (6.5 * h) / 1000;
      return {
        stem: `The temperature at sea level is ${base}°C. Using a lapse rate of 6.5°C per 1,000 m, what is the temperature at the top of a mountain ${num(h, undefined, 4)} m high?`,
        answer: `${num(t)}°C`,
        wrong: [base + (6.5 * h) / 1000, base - (6.5 * h) / 100, base - 6.5].filter((x) => x !== t).map((x) => `${num(x)}°C`),
        explanation: `Temperature falls 6.5°C for every 1,000 m: ${num(h / 1000)} × 6.5 = ${num((6.5 * h) / 1000)}°C.\n${base} − ${num((6.5 * h) / 1000)} = ${num(t)}°C.`,
      };
    },
  },
  {
    key: 'geography/rocks',
    topic: [GEO, 'Rocks'],
    difficulty: 2,
    variety: 18,
    make: (r) => {
      const ROCKS: Record<string, string[]> = { igneous: ['granite', 'basalt', 'gabbro'], sedimentary: ['sandstone', 'limestone', 'shale', 'coal'], metamorphic: ['marble', 'slate', 'quartzite', 'gneiss'] };
      const why = { igneous: 'formed when magma or lava cools', sedimentary: 'formed from layers of deposited material', metamorphic: 'formed when other rocks are changed by heat and pressure' } as const;
      const type = r.pick(Object.keys(ROCKS) as (keyof typeof why)[]);
      const ans = r.pick(ROCKS[type]);
      const wrong = r.shuffle(Object.entries(ROCKS).filter(([k]) => k !== type).flatMap(([, v]) => v)).slice(0, 3);
      return { stem: `Which of these is ${type === 'igneous' ? 'an' : 'a'} ${type} rock?`, answer: ans, wrong, explanation: `${ans[0].toUpperCase() + ans.slice(1)} is ${type}: ${why[type]}.` };
    },
  },
  factPairs(
    'geography/vegetation',
    [NG, 'Vegetation and climate of Nigeria'],
    2,
    [
      ['mangrove swamp', 'the coast of the Niger Delta'],
      ['tropical rainforest', 'the wet south, such as Edo and Ondo'],
      ['Guinea savanna', 'the middle belt, such as Kwara and Niger'],
      ['Sudan savanna', 'the far north, such as Kano and Katsina'],
      ['Sahel savanna', 'the extreme north-east near Lake Chad'],
    ],
    { forward: (a) => `Where in Nigeria is ${a} vegetation mainly found?`, backward: (b) => `Which vegetation belt is found in ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} is found in ${b}.` },
  ),
  itemSet('geography/nigeria', [NG, 'Physical features of Nigeria'], 2, [
    { stem: 'At which town do the Rivers Niger and Benue meet?', answer: 'Lokoja', wrong: ['Makurdi', 'Onitsha', 'Jebba'], explanation: 'The confluence is at Lokoja, Kogi State.' },
    { stem: 'What is the highest point in Nigeria?', answer: 'Chappal Waddi', wrong: ['the Jos Plateau', 'the Obudu Plateau', 'Zuma Rock'], explanation: 'Chappal Waddi on the Mambilla Plateau (Taraba) is about 2,419 m high.' },
    { stem: 'The Kainji Dam is built across which river?', answer: 'River Niger', wrong: ['River Benue', 'River Kaduna', 'River Ogun'], explanation: 'Kainji Dam, in Niger State, is on the River Niger.' },
    { stem: 'The dry, dusty wind that blows from the Sahara in the dry season is the', answer: 'harmattan', wrong: ['south-west monsoon', 'land breeze', 'sea breeze'], explanation: 'The north-east trade wind, called the harmattan, brings dry, dusty air.' },
    { stem: 'Which wind brings rain to Nigeria?', answer: 'the south-west monsoon (tropical maritime) wind', wrong: ['the harmattan', 'the north-east trade wind', 'the westerlies'], explanation: 'The moist south-west wind from the Atlantic brings the rainy season.' },
  ]),
  itemSet('geography/earth', [GEO, 'The earth and its movements'], 1, [
    { stem: 'Day and night are caused by the', answer: 'rotation of the earth on its axis', wrong: ['revolution of the earth round the sun', 'movement of the moon', 'tilt of the sun'], explanation: 'The earth rotates once every 24 hours.' },
    { stem: 'How long does the earth take to go round the sun?', answer: 'about 365¼ days', wrong: ['24 hours', '28 days', '100 days'], explanation: 'One revolution takes about 365¼ days, so we add a day every fourth (leap) year.' },
    { stem: 'Which line of latitude is 0°?', answer: 'the Equator', wrong: ['the Tropic of Cancer', 'the Greenwich Meridian', 'the Arctic Circle'], explanation: 'The Equator is 0° latitude; the Greenwich (Prime) Meridian is 0° longitude.' },
    { stem: 'Which line of longitude is 0°?', answer: 'the Greenwich (Prime) Meridian', wrong: ['the Equator', 'the International Date Line', 'the Tropic of Capricorn'], explanation: 'The Prime Meridian passes through Greenwich in London.' },
  ]),
];
