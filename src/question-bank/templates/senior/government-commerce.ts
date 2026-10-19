import { factPairs, itemSet, naira, num, type Template } from '../engine.js';

/** Government and Commerce for JAMB, WAEC and NECO. */

export const government: Template[] = [
  factPairs(
    'government/concepts',
    ['Elements of Government', 'Basic concepts'],
    2,
    [
      ['sovereignty', 'supreme power of a state over its affairs, free from outside control'],
      ['legitimacy', 'the people’s acceptance of a government’s right to rule'],
      ['democracy', 'government of the people, by the people and for the people'],
      ['federalism', 'sharing power between a central government and component units'],
      ['separation of powers', 'giving law-making, executing and interpreting to different organs'],
      ['checks and balances', 'each arm of government limiting the others'],
      ['franchise', 'the right to vote in elections'],
    ],
    { forward: (a) => `What is meant by ${a}?`, backward: (b) => `Which concept refers to ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} is ${b}.` },
  ),
  factPairs(
    'government/thinkers',
    ['Elements of Government', 'Political thinkers'],
    2,
    [
      ['the theory of separation of powers', 'Baron de Montesquieu'],
      ['the concept of the rule of law', 'A. V. Dicey'],
      ['the “social contract” and the general will', 'Jean-Jacques Rousseau'],
      ['the idea of a classless communist society', 'Karl Marx'],
    ],
    { forward: (a) => `Who is best known for ${a}?`, why: (a, b) => `${b} is best known for ${a}.` },
  ),
  itemSet('government/constitutions', ['Elements of Government', 'Constitutions'], 2, [
    { stem: 'A constitution that can be amended by the same process as an ordinary law is', answer: 'flexible', wrong: ['rigid', 'federal', 'written'], explanation: 'A flexible constitution needs no special procedure to change; a rigid one does.' },
    { stem: 'Which country is best known for having an unwritten constitution?', answer: 'Britain', wrong: ['Nigeria', 'the United States', 'Ghana'], explanation: 'Britain’s constitution is not contained in a single document.' },
    { stem: 'In a parliamentary system, the head of government is the', answer: 'Prime Minister', wrong: ['President', 'Chief Justice', 'Speaker'], explanation: 'The Prime Minister leads the government; the head of state is a monarch or ceremonial president.' },
    { stem: 'In a presidential system like Nigeria’s, the President is', answer: 'both head of state and head of government', wrong: ['only head of state', 'only head of government', 'a member of the legislature'], explanation: 'Nigeria’s President is head of state, head of government and commander-in-chief.' },
    { stem: 'Delegated legislation means laws made by', answer: 'bodies other than the legislature, using powers given to them', wrong: ['the legislature alone', 'the courts', 'foreign governments'], explanation: 'Ministries and local governments make rules (bye-laws, regulations) under powers delegated by the legislature.' },
  ]),
  itemSet('government/nigeria-history', ['Nigerian Government and Politics', 'Constitutional development'], 3, [
    { stem: 'Which constitution first introduced the elective principle in Nigeria?', answer: 'the Clifford Constitution of 1922', wrong: ['the Richards Constitution of 1946', 'the Macpherson Constitution of 1951', 'the Lyttleton Constitution of 1954'], explanation: 'The 1922 Clifford Constitution allowed elected members from Lagos and Calabar.' },
    { stem: 'Which constitution introduced regionalism in Nigeria?', answer: 'the Richards Constitution of 1946', wrong: ['the Clifford Constitution of 1922', 'the Lyttleton Constitution of 1954', 'the Independence Constitution of 1960'], explanation: 'Richards created the Northern, Western and Eastern regions.' },
    { stem: 'Which constitution made Nigeria a true federation?', answer: 'the Lyttleton Constitution of 1954', wrong: ['the Richards Constitution of 1946', 'the Macpherson Constitution of 1951', 'the 1979 Constitution'], explanation: 'The 1954 Lyttleton Constitution set up a federal system.' },
    { stem: 'Nigeria first adopted the presidential system of government in', answer: '1979', wrong: ['1960', '1963', '1999'], explanation: 'The 1979 Constitution introduced the presidential system for the Second Republic.' },
    { stem: 'Who founded the Action Group (AG) in 1951?', answer: 'Obafemi Awolowo', wrong: ['Nnamdi Azikiwe', 'Ahmadu Bello', 'Herbert Macaulay'], explanation: 'Chief Obafemi Awolowo founded the Action Group.' },
    { stem: 'Who led the Northern People’s Congress (NPC)?', answer: 'Ahmadu Bello', wrong: ['Obafemi Awolowo', 'Nnamdi Azikiwe', 'Aminu Kano'], explanation: 'Sir Ahmadu Bello, the Sardauna of Sokoto, led the NPC.' },
    { stem: 'The NCNC was formed in 1944 by Herbert Macaulay and', answer: 'Nnamdi Azikiwe', wrong: ['Obafemi Awolowo', 'Tafawa Balewa', 'Anthony Enahoro'], explanation: 'Macaulay was its first president and Azikiwe its secretary-general.' },
    { stem: 'Who moved the motion for Nigeria’s self-government in 1953?', answer: 'Anthony Enahoro', wrong: ['Ahmadu Bello', 'Herbert Macaulay', 'Tafawa Balewa'], explanation: 'Anthony Enahoro moved the self-government motion in 1953.' },
  ]),
  factPairs(
    'government/international',
    ['International Relations', 'International organisations'],
    2,
    [
      ['the United Nations (UN)', '1945'],
      ['the Organisation of African Unity (OAU)', '1963'],
      ['ECOWAS', '1975'],
      ['OPEC', '1960'],
    ],
    { forward: (a) => `In which year was ${a} founded?`, backward: (b) => `Which organisation was founded in ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} was founded in ${b}.` },
  ),
  itemSet('government/elections', ['Elements of Government', 'Elections and political parties'], 2, [
    { stem: 'Which body conducts federal elections in Nigeria?', answer: 'INEC', wrong: ['the National Assembly', 'the Supreme Court', 'the Police'], explanation: 'The Independent National Electoral Commission conducts federal and state elections.' },
    { stem: 'The main aim of a political party is to', answer: 'win power and form a government', wrong: ['protect the interests of one trade', 'run businesses for profit', 'settle disputes in court'], explanation: 'Unlike pressure groups, parties seek to control government.' },
    { stem: 'A pressure group differs from a political party because it', answer: 'tries to influence government without seeking to take power', wrong: ['contests elections', 'forms the government', 'must be registered by INEC'], explanation: 'Pressure groups such as the NLC influence policy but do not contest elections.' },
    { stem: 'An election held to fill a vacant seat between general elections is a', answer: 'by-election', wrong: ['referendum', 'primary election', 'run-off'], explanation: 'A by-election fills a seat left empty by death or resignation.' },
    { stem: 'A vote by the whole electorate on a single question is a', answer: 'referendum', wrong: ['by-election', 'recall', 'primary election'], explanation: 'In a referendum, citizens vote directly on an issue.' },
  ]),
];

export const commerce: Template[] = [
  itemSet('commerce/business-units', ['Business Units', 'Types of business organisation'], 2, [
    { stem: 'A sole proprietor has unlimited liability. This means', answer: 'the owner’s personal property can be used to pay business debts', wrong: ['the business can never fail', 'the owner pays no tax', 'the business has many owners'], explanation: 'With unlimited liability, the owner is personally responsible for all the debts.' },
    { stem: 'An ordinary partnership usually has between', answer: '2 and 20 partners', wrong: ['1 and 5 partners', '7 and 50 partners', 'any number of partners'], explanation: 'Most partnerships are limited to 20 partners (banking partnerships to 10).' },
    { stem: 'A public limited company raises capital by', answer: 'selling shares to the public', wrong: ['borrowing only from its owners', 'collecting taxes', 'selling only to its members'], explanation: 'A plc can offer its shares to the public, for example on the stock exchange.' },
    { stem: 'In a cooperative society, profits are shared according to', answer: 'how much each member bought from or sold to the society', wrong: ['the number of shares held', 'the age of each member', 'equal amounts regardless of trade'], explanation: 'Cooperatives pay dividends on purchases or contributions.' },
    { stem: 'Which document sets out the internal rules of a limited company?', answer: 'Articles of Association', wrong: ['Memorandum of Association', 'Certificate of Incorporation', 'Prospectus'], explanation: 'The Articles govern internal management; the Memorandum covers the company’s relations with outsiders.' },
  ]),
  factPairs(
    'commerce/insurance',
    ['Aids to Trade', 'Insurance'],
    3,
    [
      ['utmost good faith (uberrimae fidei)', 'both parties must disclose all important facts truthfully'],
      ['insurable interest', 'the insured must suffer a loss if the thing insured is damaged'],
      ['indemnity', 'the insured is restored to the position before the loss, no better'],
      ['subrogation', 'after paying a claim, the insurer takes over the insured’s rights against others'],
      ['contribution', 'insurers covering the same risk share the claim between them'],
      ['proximate cause', 'the loss must be directly caused by the risk insured against'],
    ],
    { forward: (a) => `What does the principle of ${a} mean?`, backward: (b) => `Which principle of insurance says that ${b}?`, why: (a, b) => `The principle of ${a} means ${b}.` },
  ),
  factPairs(
    'commerce/foreign-trade-documents',
    ['Trade', 'Foreign trade'],
    3,
    [
      ['bill of lading', 'a receipt and document of title for goods carried by sea'],
      ['indent', 'an order placed by an importer with an overseas supplier'],
      ['certificate of origin', 'shows the country where the goods were produced'],
      ['consular invoice', 'is signed by the importing country’s consul to confirm the value of goods'],
      ['air waybill', 'a receipt for goods sent by air'],
    ],
    { forward: (a) => `What is a ${a}?`, backward: (b) => `Which document ${b.startsWith('a ') ? 'is ' + b : b}?`, why: (a, b) => `A ${a} ${b.startsWith('a ') ? 'is ' + b : b}.` },
  ),
  itemSet('commerce/stock-exchange', ['Aids to Trade', 'Banking and the stock exchange'], 2, [
    { stem: 'On the stock exchange, a speculator who buys shares expecting their price to rise is a', answer: 'bull', wrong: ['bear', 'stag', 'broker'], explanation: 'Bulls expect rising prices; bears expect falling prices.' },
    { stem: 'A speculator who sells shares expecting their price to fall is a', answer: 'bear', wrong: ['bull', 'stag', 'jobber'], explanation: 'A bear sells hoping to buy back more cheaply.' },
    { stem: 'A speculator who applies for new shares hoping to sell them quickly at a profit is a', answer: 'stag', wrong: ['bull', 'bear', 'broker'], explanation: 'Stags buy new issues and sell soon after for a quick gain.' },
    { stem: 'A cheque with two parallel lines across its face is', answer: 'a crossed cheque', wrong: ['an open cheque', 'a stale cheque', 'a bearer cheque'], explanation: 'A crossed cheque must be paid into a bank account, not cashed over the counter.' },
    { stem: 'A cheque presented more than six months after its date is', answer: 'stale', wrong: ['crossed', 'post-dated', 'dishonoured on arrival'], explanation: 'Banks treat a cheque as stale after six months.' },
  ]),
  {
    key: 'commerce/discounts-turnover',
    topic: ['Trade', 'Home trade'],
    difficulty: 3,
    make: (r) => {
      const kind = r.pick(['both', 'turnover', 'markup'] as const);
      if (kind === 'both') {
        const list = r.pick([10_000, 20_000, 40_000, 50_000]);
        const td = r.pick([10, 20, 25]);
        const cd = r.pick([2, 5, 10]);
        const afterTrade = list * (1 - td / 100);
        const pay = afterTrade * (1 - cd / 100);
        return {
          stem: `Goods listed at ${naira(list)} are sold with a trade discount of ${td}% and a cash discount of ${cd}% for prompt payment. How much does a buyer who pays promptly pay?`,
          answer: naira(pay),
          wrong: [list * (1 - (td + cd) / 100), afterTrade, list * (1 - cd / 100)].filter((x) => x !== pay).map(naira),
          explanation: `Trade discount first: ${naira(list)} − ${td}% = ${naira(afterTrade)}.\nThen cash discount on that: ${naira(afterTrade)} − ${cd}% = ${naira(pay)}. (The discounts are not simply added.)`,
        };
      }
      const open = r.pick([4000, 6000, 8000, 10_000]);
      const close = r.pick([2000, 4000, 6000, 12_000]);
      const avg = (open + close) / 2;
      const times = r.pick([4, 5, 6, 8, 10]);
      const cos = avg * times;
      if (kind === 'turnover') {
        return {
          stem: `A trader’s opening stock was ${naira(open)}, closing stock ${naira(close)} and cost of goods sold ${naira(cos)}. What is the rate of turnover?`,
          answer: `${num(times)} times`,
          wrong: [cos / open, cos / close, cos / (open + close)].filter((x) => x !== times).map((x) => `${num(Math.round(x * 100) / 100)} times`),
          explanation: `Average stock = ${m2(open, close)} = ${naira(avg)}.\nRate of turnover = cost of goods sold ÷ average stock = ${naira(cos)} ÷ ${naira(avg)} = ${times} times.`,
        };
      }
      const cost = r.pick([400, 500, 800, 1000, 2000]);
      const mu = r.pick([20, 25, 40, 50]);
      const sell = cost * (1 + mu / 100);
      return {
        stem: `A trader buys an item for ${naira(cost)} and sells it for ${naira(sell)}. What is the mark-up?`,
        answer: `${mu}%`,
        wrong: [Math.round(((sell - cost) / sell) * 10000) / 100, sell - cost, mu * 2].map((x) => `${num(x)}%`),
        explanation: `Profit = ${naira(sell - cost)}. Mark-up is profit as a percentage of cost: ${naira(sell - cost)} ÷ ${naira(cost)} × 100 = ${mu}%. (As a percentage of the selling price it would be the margin.)`,
      };
    },
  },
];

const m2 = (a: number, b: number) => `(${naira(a)} + ${naira(b)}) ÷ 2`;
