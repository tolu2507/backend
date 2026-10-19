import { factPairs, itemSet, m, naira, num, type Template } from '../engine.js';

/** Economics for JAMB, WAEC and NECO: sums worked out by code, and checked facts. */

const BASIC = 'Basic Concepts';
const PRICE = 'Demand, Supply and Price';
const PROD = 'Production and Costs';
const MKT = 'Market Structures';
const NAT = 'National Income and Public Finance';
const MONEY = 'Money, Banking and Inflation';
const INTL = 'International Trade and Organisations';

const pct = (x: number) => `${num(Math.round(x * 100) / 100)}%`;

export const economics: Template[] = [
  {
    key: 'economics/equilibrium',
    topic: [PRICE, 'Market equilibrium'],
    difficulty: 3,
    make: (r) => {
      // Qd = a − bP, Qs = c + dP; pick the answer first so it comes out whole.
      const P = r.int(2, 20);
      const b = r.int(2, 6);
      const d = r.int(1, 5);
      const c = r.int(-10, 20);
      const Q = c + d * P;
      if (Q <= 0) return null;
      const a = Q + b * P;
      if (r.chance(0.5)) {
        return {
          stem: `The demand and supply functions for a good are ${m(`Q_d = ${a} - ${b}P`)} and ${m(`Q_s = ${c < 0 ? `${d}P - ${-c}` : `${c} + ${d}P`}`)}. What is the equilibrium price?`,
          answer: naira(P),
          wrong: [Math.round((a + c) / (b + d)), Math.round(a / b), Q, P + 1].filter((x) => x > 0 && x !== P).map(naira),
          explanation: `At equilibrium ${m('Q_d = Q_s')}: ${m(`${a} - ${b}P = ${c < 0 ? `${d}P - ${-c}` : `${c} + ${d}P`}`)}, so ${m(`${a - c} = ${b + d}P`)} and ${m(`P = ${P}`)}.`,
        };
      }
      return {
        stem: `The demand and supply functions for a good are ${m(`Q_d = ${a} - ${b}P`)} and ${m(`Q_s = ${c < 0 ? `${d}P - ${-c}` : `${c} + ${d}P`}`)}. What quantity is bought and sold at equilibrium?`,
        answer: `${Q} units`,
        wrong: [P, a, a - b, Q + d].filter((x) => x > 0 && x !== Q).map((x) => `${x} units`),
        explanation: `Equate them: ${m(`${a} - ${b}P = ${c < 0 ? `${d}P - ${-c}` : `${c} + ${d}P`}`)} gives ${m(`P = ${P}`)}.\nThen ${m(`Q = ${a} - ${b} \\times ${P} = ${Q}`)} units.`,
        difficulty: 4,
      };
    },
  },
  {
    key: 'economics/elasticity',
    topic: [PRICE, 'Elasticity'],
    difficulty: 3,
    make: (r) => {
      const P1 = r.pick([10, 20, 40, 50, 100, 200]);
      const pChange = r.pick([10, 20, 25, 50]);
      const P2 = P1 * (1 + (r.chance(0.5) ? 1 : -1) * (pChange / 100));
      const Q1 = r.pick([100, 200, 400, 500, 1000]);
      const e = r.pick([0.5, 0.8, 1, 1.5, 2, 2.5]);
      const qChange = (e * pChange) / 100;
      const Q2 = Math.round(P2 > P1 ? Q1 * (1 - qChange) : Q1 * (1 + qChange));
      if (Q2 <= 0 || Math.abs(Math.abs((Q2 - Q1) / Q1) - qChange) > 1e-9) return null;
      const kind = e > 1 ? 'elastic' : e < 1 ? 'inelastic' : 'unitary';
      return {
        stem: `When the price of a good changes from ${naira(P1)} to ${naira(P2)}, the quantity demanded changes from ${Q1} to ${Q2} units. What is the price elasticity of demand, and how is demand described?`,
        answer: `${num(e)}; ${kind === 'unitary' ? 'unitary elastic' : kind}`,
        wrong: [`${num(e)}; ${kind === 'elastic' ? 'inelastic' : 'elastic'}`, `${num(Math.round((1 / e) * 100) / 100)}; ${kind === 'elastic' ? 'inelastic' : kind === 'inelastic' ? 'elastic' : 'perfectly inelastic'}`, `${num(Math.round(e * pChange * 100) / 100)}; perfectly elastic`, `${num(e)}; perfectly inelastic`],
        explanation: `% change in quantity = ${m(`\\frac{${Math.abs(Q2 - Q1)}}{${Q1}} \\times 100 = ${num(qChange * 100)}\\%`)}; % change in price = ${pChange}%.\nElasticity = ${m(`\\frac{${num(qChange * 100)}}{${pChange}} = ${num(e)}`)}. ${kind === 'elastic' ? 'More than 1, so demand is elastic.' : kind === 'inelastic' ? 'Less than 1, so demand is inelastic.' : 'Exactly 1: unitary elasticity.'}`,
      };
    },
  },
  {
    key: 'economics/costs-revenue',
    topic: [PROD, 'Costs and revenue'],
    difficulty: 2,
    make: (r) => {
      const kind = r.pick(['tr', 'ac', 'mc', 'profit'] as const);
      const Q = r.pick([10, 20, 25, 40, 50, 100]);
      if (kind === 'tr') {
        const P = r.pick([50, 80, 120, 150, 200]);
        return {
          stem: `A firm sells ${Q} units of a good at ${naira(P)} each. What is its total revenue?`,
          answer: naira(P * Q),
          wrong: [P + Q, P * Q * 2, P, (P * Q) / 2].map(naira),
          explanation: `Total revenue = price × quantity = ${naira(P)} × ${Q} = ${naira(P * Q)}.`,
          difficulty: 1,
        };
      }
      const FC = r.pick([1000, 2000, 5000, 10_000]);
      const vc = r.pick([20, 30, 40, 50]);
      const TC = FC + vc * Q;
      if (kind === 'ac') {
        return {
          stem: `A firm’s fixed cost is ${naira(FC)} and its variable cost is ${naira(vc)} per unit. What is the average total cost of producing ${Q} units?`,
          answer: naira(TC / Q),
          wrong: [TC, vc, FC / Q, TC / (Q + 1)].map((x) => naira(Math.round(x * 100) / 100)),
          explanation: `Total cost = ${naira(FC)} + ${naira(vc)} × ${Q} = ${naira(TC)}.\nAverage cost = ${naira(TC)} ÷ ${Q} = ${naira(TC / Q)}.`,
        };
      }
      if (kind === 'mc') {
        const TC2 = TC + vc + r.pick([0, 5, 10]);
        return {
          stem: `The total cost of producing ${Q} units is ${naira(TC)} and of producing ${Q + 1} units is ${naira(TC2)}. What is the marginal cost of the ${Q + 1}th unit?`,
          answer: naira(TC2 - TC),
          wrong: [TC2, TC2 / (Q + 1), TC / Q].map((x) => naira(Math.round(x * 100) / 100)),
          explanation: `Marginal cost is the extra cost of one more unit: ${naira(TC2)} − ${naira(TC)} = ${naira(TC2 - TC)}.`,
        };
      }
      const P = vc + r.pick([20, 40, 60, 100]);
      const profit = P * Q - TC;
      return {
        stem: `A firm sells ${Q} units at ${naira(P)} each. Its fixed cost is ${naira(FC)} and its variable cost is ${naira(vc)} per unit. What is its profit or loss?`,
        answer: profit >= 0 ? `Profit of ${naira(profit)}` : `Loss of ${naira(-profit)}`,
        wrong: [P * Q - vc * Q, P * Q, -profit + FC].map((x) => (x >= 0 ? `Profit of ${naira(x)}` : `Loss of ${naira(-x)}`)).concat([profit >= 0 ? `Loss of ${naira(profit)}` : `Profit of ${naira(-profit)}`]),
        explanation: `Revenue = ${naira(P)} × ${Q} = ${naira(P * Q)}. Total cost = ${naira(FC)} + ${naira(vc)} × ${Q} = ${naira(TC)}.\n${profit >= 0 ? 'Profit' : 'Loss'} = ${naira(Math.abs(profit))}.`,
        difficulty: 3,
      };
    },
  },
  {
    key: 'economics/utility',
    topic: [BASIC, 'Utility'],
    difficulty: 2,
    make: (r) => {
      const mus = [r.int(20, 30)];
      for (let i = 1; i < 5; i++) mus.push(mus[i - 1] - r.int(2, 6));
      const tus = mus.map((_, i) => mus.slice(0, i + 1).reduce((s, x) => s + x, 0));
      const n = r.int(2, 5);
      return {
        stem: `The total utility from consuming 1 to 5 oranges is ${tus.join(', ')} units. What is the marginal utility of the ${['', 'first', 'second', 'third', 'fourth', 'fifth'][n]} orange?`,
        answer: `${mus[n - 1]} units`,
        wrong: [tus[n - 1], Math.round(tus[n - 1] / n), mus[n - 1] + 2, n > 1 ? mus[n - 2] : mus[n]].filter((x) => x !== mus[n - 1]).map((x) => `${x} units`),
        explanation: `Marginal utility = change in total utility: ${tus[n - 1]} − ${tus[n - 2] ?? 0} = ${mus[n - 1]} units. It falls as more are eaten: the law of diminishing marginal utility.`,
      };
    },
  },
  {
    key: 'economics/national-income',
    topic: [NAT, 'National income'],
    difficulty: 3,
    make: (r) => {
      if (r.chance(0.5)) {
        const C = r.pick([200, 300, 400, 500]);
        const I = r.pick([50, 80, 100, 150]);
        const G = r.pick([60, 80, 120, 150]);
        const X = r.pick([40, 70, 90, 110]);
        const M = r.pick([30, 50, 80, 100]);
        const Y = C + I + G + X - M;
        return {
          stem: `In an economy (₦ billion), consumption is ${C}, investment ${I}, government spending ${G}, exports ${X} and imports ${M}. Using the expenditure approach, what is GDP?`,
          answer: `₦${Y} billion`,
          wrong: [C + I + G + X + M, C + I + G, C + I + G + X].filter((x) => x !== Y).map((x) => `₦${x} billion`),
          explanation: `${m('Y = C + I + G + (X - M)')} = ${C} + ${I} + ${G} + (${X} − ${M}) = ₦${Y} billion.`,
        };
      }
      const gdp = r.pick([200, 300, 450, 500, 600]) * 1e9;
      const pop = r.pick([100, 150, 200, 250]) * 1e6;
      const pc = gdp / pop;
      if (!Number.isInteger(pc)) return null;
      return {
        stem: `A country’s GDP is ₦${num(gdp / 1e9)} billion and its population is ${num(pop / 1e6)} million. What is its income per head?`,
        answer: naira(pc),
        wrong: [pc * 10, pc / 10, (pop / gdp) * 1e6, pc * 2].map((x) => naira(Math.round(x))),
        explanation: `Income per head = GDP ÷ population = ${num(gdp / 1e9)} billion ÷ ${num(pop / 1e6)} million = ${naira(pc)}.`,
      };
    },
  },
  {
    key: 'economics/indices',
    topic: [MONEY, 'Inflation and price indices'],
    difficulty: 3,
    make: (r) => {
      const kind = r.pick(['inflation', 'tot', 'unemployment'] as const);
      if (kind === 'inflation') {
        const a = r.pick([100, 120, 150, 200, 250]);
        const rate = r.pick([5, 8, 10, 12, 15, 20, 25]);
        const b = a * (1 + rate / 100);
        if (!Number.isInteger(b * 10)) return null;
        return {
          stem: `The consumer price index rose from ${a} last year to ${num(b)} this year. What is the rate of inflation?`,
          answer: pct(rate),
          wrong: [b - a, ((b - a) / b) * 100, (b / a) * 100].filter((x) => Math.abs(x - rate) > 0.01).map(pct),
          explanation: `Inflation = ${m(`\\frac{${num(b)} - ${a}}{${a}} \\times 100 = ${num(rate)}\\%`)}.`,
        };
      }
      if (kind === 'tot') {
        const px = r.pick([110, 120, 125, 150, 90, 80]);
        const pm = r.pick([100, 125, 150, 80]);
        const tot = (px / pm) * 100;
        if (!Number.isInteger(tot * 10) || px === pm) return null;
        return {
          stem: `A country’s export price index is ${px} and its import price index is ${pm}. What are its terms of trade, and are they favourable?`,
          answer: `${num(tot)}; ${tot > 100 ? 'favourable' : 'unfavourable'}`,
          wrong: [`${num(tot)}; ${tot > 100 ? 'unfavourable' : 'favourable'}`, `${num(Math.round((pm / px) * 1000) / 10)}; ${tot > 100 ? 'unfavourable' : 'favourable'}`, `${px - pm}; favourable`],
          explanation: `Terms of trade = ${m(`\\frac{\\text{export price index}}{\\text{import price index}} \\times 100 = \\frac{${px}}{${pm}} \\times 100 = ${num(tot)}`)}. ${tot > 100 ? 'Above 100 is favourable: exports buy more imports.' : 'Below 100 is unfavourable.'}`,
        };
      }
      const lf = r.pick([200, 400, 500, 800, 1000]);
      const unemployed = lf * r.pick([0.05, 0.08, 0.1, 0.12, 0.2, 0.25]);
      return {
        stem: `A town has a labour force of ${num(lf)} people, of whom ${num(unemployed)} are unemployed. What is the unemployment rate?`,
        answer: pct((unemployed / lf) * 100),
        wrong: [(unemployed / (lf - unemployed)) * 100, unemployed, 100 - (unemployed / lf) * 100].map(pct),
        explanation: `Unemployment rate = ${m(`\\frac{${num(unemployed)}}{${num(lf)}} \\times 100 = ${num((unemployed / lf) * 100)}\\%`)} (out of the labour force, not the whole population).`,
      };
    },
  },
  factPairs('economics/factor-rewards', [PROD, 'Factors of production'], 1, [['land', 'rent'], ['labour', 'wages'], ['capital', 'interest'], ['entrepreneurship', 'profit']], {
    forward: (a) => `What is the reward for ${a} as a factor of production?`,
    backward: (b) => `Which factor of production earns ${b}?`,
    why: (a, b) => `The reward for ${a} is ${b}.`,
  }),
  factPairs(
    'economics/terms',
    [BASIC, 'Basic economic concepts'],
    2,
    [
      ['opportunity cost', 'the alternative given up when a choice is made'],
      ['scarcity', 'resources being limited compared with human wants'],
      ['scale of preference', 'a list of wants arranged in order of importance'],
      ['division of labour', 'breaking production into tasks done by different workers'],
      ['economies of scale', 'the fall in average cost as a firm grows larger'],
      ['inflation', 'a persistent rise in the general price level'],
      ['deflation', 'a persistent fall in the general price level'],
    ],
    { forward: (a) => `What is meant by ${a}?`, backward: (b) => `Which term means ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} is ${b}.` },
  ),
  factPairs(
    'economics/market-structures',
    [MKT, 'Types of market'],
    3,
    [
      ['perfect competition', 'many sellers of an identical product, so each is a price taker'],
      ['monopoly', 'a single seller of a product with no close substitutes'],
      ['oligopoly', 'a few large sellers who watch each other’s prices'],
      ['monopolistic competition', 'many sellers of slightly different (branded) products'],
    ],
    { forward: (a) => `Which describes ${a}?`, backward: (b) => `A market with ${b} is called`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)}: ${b}.` },
  ),
  {
    key: 'economics/taxes',
    topic: [NAT, 'Public finance and taxation'],
    difficulty: 2,
    variety: 16,
    make: (r) => {
      const TAX = { direct: ['personal income tax (PAYE)', 'company income tax', 'capital gains tax', 'property tax'], indirect: ['Value Added Tax (VAT)', 'import duty', 'excise duty', 'export duty'] };
      const kind = r.pick(['direct', 'indirect'] as const);
      const other = kind === 'direct' ? 'indirect' : 'direct';
      const ans = r.pick(TAX[kind]);
      return {
        stem: `Which of these is ${kind === 'indirect' ? 'an indirect' : 'a direct'} tax?`,
        answer: ans,
        wrong: r.shuffle(TAX[other]).slice(0, 3),
        explanation: kind === 'direct' ? `${ans[0].toUpperCase() + ans.slice(1)} is direct: it is paid straight to the government by the person or firm taxed. The others are indirect taxes on goods.` : `${ans[0].toUpperCase() + ans.slice(1)} is indirect: it is added to the price of goods and passed on to buyers. The others are direct taxes on income or property.`,
      };
    },
  },
  factPairs(
    'economics/organisations',
    [INTL, 'International economic organisations'],
    2,
    [
      ['ECOWAS', 'promoting trade and integration among West African countries'],
      ['OPEC', 'coordinating oil policies of oil-exporting countries'],
      ['IMF', 'helping countries with balance-of-payments problems'],
      ['World Bank', 'lending for long-term development projects'],
      ['WTO', 'setting and enforcing rules for world trade'],
    ],
    { forward: (a) => `What is the main role of ${a}?`, backward: (b) => `Which organisation is mainly concerned with ${b}?`, why: (a, b) => `${a} is concerned with ${b}.` },
  ),
  itemSet('economics/banking', [MONEY, 'Money and banking'], 2, [
    { stem: 'Which of these is a function of the Central Bank of Nigeria?', answer: 'issuing the national currency', wrong: ['accepting deposits from the public', 'giving loans to traders', 'selling shares to the public'], explanation: 'The CBN issues the naira, is banker to the government and to banks, and controls the money supply.' },
    { stem: 'The Central Bank is described as the “lender of last resort” because it', answer: 'lends to commercial banks when they are short of cash', wrong: ['lends to individuals with no collateral', 'is the last bank to open each day', 'lends only to foreign governments'], explanation: 'Commercial banks in difficulty can borrow from the Central Bank.' },
    { stem: 'Money serving as a “store of value” means it can be', answer: 'kept and used to buy things later', wrong: ['used to measure prices', 'exchanged for goods now', 'used to settle debts in future'], explanation: 'A store of value holds purchasing power over time.' },
    { stem: 'Which of these is a quality of good money?', answer: 'durability', wrong: ['scarcity of supply', 'heaviness', 'perishability'], explanation: 'Good money is durable, portable, divisible, acceptable and homogeneous.' },
  ]),
];

