import { factPairs, itemSet, naira, type Template } from '../engine.js';

/** BECE Business Studies, Pre-Vocational Studies, Cultural and Creative Arts, and French. */

export const business: Template[] = [
  factPairs(
    'business/aids-to-trade',
    ['Commerce', 'Aids to trade'],
    1,
    [
      ['banking', 'keeps money safe and lends money to traders'],
      ['insurance', 'protects traders against losses from risks'],
      ['transport', 'moves goods from producers to consumers'],
      ['warehousing', 'stores goods until they are needed'],
      ['advertising', 'tells buyers about goods and persuades them to buy'],
      ['communication', 'passes information between buyers and sellers'],
    ],
    { forward: (a) => `How does ${a} help trade?`, backward: (b) => `Which aid to trade ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} ${b}.` },
  ),
  itemSet('business/trade', ['Commerce', 'Trade'], 1, [
    { stem: 'Buying goods from another country is called', answer: 'import trade', wrong: ['export trade', 'entrepôt trade', 'home trade'], explanation: 'Imports come in from other countries; exports go out.' },
    { stem: 'Selling goods to another country is called', answer: 'export trade', wrong: ['import trade', 'retail trade', 'home trade'], explanation: 'Exports are goods sold abroad.' },
    { stem: 'Importing goods in order to export them again is called', answer: 'entrepôt trade', wrong: ['home trade', 'barter', 'retail trade'], explanation: 'Entrepôt (re-export) trade passes goods on to another country.' },
    { stem: 'Who buys goods in large quantities from manufacturers and sells them to retailers?', answer: 'the wholesaler', wrong: ['the consumer', 'the retailer', 'the hawker'], explanation: 'The wholesaler is the link between manufacturer and retailer.' },
    { stem: 'Exchanging goods for goods without using money is called', answer: 'barter', wrong: ['credit', 'hire purchase', 'retail'], explanation: 'Barter was the earliest form of trade.' },
  ]),
  factPairs(
    'business/office-equipment',
    ['Office Practice', 'Office equipment'],
    1,
    [
      ['stapler', 'fastens sheets of paper together'],
      ['photocopier', 'makes copies of documents'],
      ['shredder', 'cuts unwanted documents into tiny strips'],
      ['perforator (hole punch)', 'punches holes in paper for filing'],
      ['franking machine', 'prints the postage on letters'],
      ['filing cabinet', 'stores files safely'],
    ],
    { forward: (a) => `What does a ${a} do?`, backward: (b) => `Which office machine ${b}?`, why: (a, b) => `A ${a} ${b}.` },
  ),
  factPairs(
    'business/documents',
    ['Book-keeping', 'Source documents'],
    2,
    [
      ['invoice', 'shows the goods sold and the amount the buyer owes'],
      ['receipt', 'shows that money has been paid'],
      ['credit note', 'reduces what a buyer owes, for example after goods are returned'],
      ['debit note', 'increases what a buyer owes, for example after an undercharge'],
      ['cheque', 'orders a bank to pay money to someone'],
    ],
    { forward: (a) => `What is a ${a} used for?`, backward: (b) => `Which business document ${b}?`, why: (a, b) => `A ${a} ${b}.` },
  ),
  factPairs(
    'business/books',
    ['Book-keeping', 'Books of original entry'],
    2,
    [
      ['credit purchases', 'purchases journal'],
      ['credit sales', 'sales journal'],
      ['cash and bank transactions', 'cash book'],
      ['small everyday expenses', 'petty cash book'],
      ['goods returned by customers', 'returns inwards journal'],
    ],
    { forward: (a) => `In which book are ${a} first recorded?`, backward: (b) => `What is first recorded in the ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} are first recorded in the ${b}.` },
  ),
  {
    key: 'business/trading-sums',
    topic: ['Book-keeping', 'Trading account'],
    difficulty: 3,
    make: (r) => {
      const kind = r.pick(['discount', 'gross-profit', 'cost-of-sales'] as const);
      if (kind === 'discount') {
        const list = r.pick([2000, 4000, 5000, 8000, 10_000, 20_000, 25_000]);
        const p = r.pick([5, 10, 15, 20, 25]);
        const net = list - (list * p) / 100;
        return {
          stem: `Goods with a list price of ${naira(list)} are sold at a trade discount of ${p}%. How much does the buyer pay?`,
          answer: naira(net),
          wrong: [(list * p) / 100, list, list + (list * p) / 100, list - p * 100].filter((x) => x > 0 && x !== net).map(naira),
          explanation: `Discount = ${p}% of ${naira(list)} = ${naira((list * p) / 100)}. The buyer pays ${naira(list)} − ${naira((list * p) / 100)} = ${naira(net)}.`,
        };
      }
      const opening = r.pick([5000, 8000, 10_000, 12_000]);
      const purchases = r.pick([40_000, 50_000, 60_000, 75_000]);
      const closing = r.pick([4000, 6000, 9000, 15_000]);
      const cos = opening + purchases - closing;
      if (kind === 'cost-of-sales') {
        return {
          stem: `A trader’s opening stock was ${naira(opening)}, purchases were ${naira(purchases)} and closing stock was ${naira(closing)}. What is the cost of goods sold?`,
          answer: naira(cos),
          wrong: [opening + purchases + closing, purchases - closing, opening + purchases].filter((x) => x !== cos).map(naira),
          explanation: `Cost of goods sold = opening stock + purchases − closing stock = ${naira(opening)} + ${naira(purchases)} − ${naira(closing)} = ${naira(cos)}.`,
        };
      }
      const sales = cos + r.pick([5000, 10_000, 15_000, 20_000]);
      return {
        stem: `A trader’s sales were ${naira(sales)}. Opening stock was ${naira(opening)}, purchases ${naira(purchases)} and closing stock ${naira(closing)}. What is the gross profit?`,
        answer: naira(sales - cos),
        wrong: [sales - purchases, sales - (opening + purchases + closing), sales - opening - purchases].filter((x) => x > 0 && x !== sales - cos).map(naira),
        explanation: `Cost of goods sold = ${naira(opening)} + ${naira(purchases)} − ${naira(closing)} = ${naira(cos)}.\nGross profit = sales − cost of goods sold = ${naira(sales)} − ${naira(cos)} = ${naira(sales - cos)}.`,
      };
    },
  },
  itemSet('business/consumers', ['Consumer Education', 'Consumer rights and protection'], 1, [
    { stem: 'Which agency controls the quality of food and drugs in Nigeria?', answer: 'NAFDAC', wrong: ['SON', 'NDLEA', 'FRSC'], explanation: 'The National Agency for Food and Drug Administration and Control (NAFDAC).' },
    { stem: 'Which agency sets standards for products made or sold in Nigeria?', answer: 'SON (Standards Organisation of Nigeria)', wrong: ['NAFDAC', 'INEC', 'NIPOST'], explanation: 'SON sets and checks product standards.' },
    { stem: 'A consumer who is sold a fake product has the right to', answer: 'redress (a refund, replacement or repair)', wrong: ['keep quiet', 'sell it to someone else', 'nothing at all'], explanation: 'Consumers have the right to safety, information, choice, to be heard and to redress.' },
    { stem: 'Which of these is a consumer right?', answer: 'the right to information about a product', wrong: ['the right to free goods', 'the right to set prices', 'the right to unlimited credit'], explanation: 'Consumers have a right to accurate information so they can choose well.' },
  ]),
  itemSet('business/keyboarding', ['Office Practice', 'Keyboarding'], 1, [
    { stem: 'What are the home keys for the left hand on a keyboard?', answer: 'A S D F', wrong: ['J K L ;', 'Q W E R', 'Z X C V'], explanation: 'The left fingers rest on A S D F; the right on J K L ;.' },
    { stem: 'What are the home keys for the right hand on a keyboard?', answer: 'J K L ;', wrong: ['A S D F', 'U I O P', 'N M , .'], explanation: 'The right fingers rest on J K L ;.' },
    { stem: 'Which key is pressed with either thumb?', answer: 'the space bar', wrong: ['the Enter key', 'the Shift key', 'the Tab key'], explanation: 'Thumbs rest on the space bar.' },
  ]),
];

export const prevocational: Template[] = [
  factPairs(
    'pvs/farm-tools',
    ['Agriculture', 'Farm tools'],
    1,
    [
      ['cutlass', 'clearing bush and cutting'],
      ['hoe', 'tilling the soil and weeding'],
      ['rake', 'gathering rubbish and levelling the soil'],
      ['wheelbarrow', 'carrying loads around the farm'],
      ['sickle', 'cutting grass and harvesting grain'],
      ['spade', 'digging and moving soil'],
      ['watering can', 'watering young plants'],
    ],
    { forward: (a) => `What is a ${a} mainly used for?`, backward: (b) => `Which farm tool is used for ${b}?`, why: (a, b) => `A ${a} is used for ${b}.` },
  ),
  itemSet('pvs/crops-soil', ['Agriculture', 'Crops'], 1, [
    { stem: 'Which of these is a cash crop?', answer: 'cocoa', wrong: ['yam', 'cassava', 'maize'], explanation: 'Cash crops are grown mainly for sale; cocoa is a major Nigerian export.' },
    { stem: 'Which of these crops adds nitrogen to the soil?', answer: 'groundnut', wrong: ['maize', 'yam', 'cassava'], explanation: 'Legumes such as groundnut and beans have root nodules with nitrogen-fixing bacteria.' },
    { stem: 'Which type of soil is best for growing most crops?', answer: 'loamy soil', wrong: ['sandy soil', 'clay soil', 'gravel'], explanation: 'Loam drains well, holds enough water and is rich in nutrients.' },
    { stem: 'Which soil drains water fastest?', answer: 'sandy soil', wrong: ['clay soil', 'loamy soil', 'silty soil'], explanation: 'Sandy soil has large particles and big air spaces.' },
    { stem: 'Which soil holds the most water?', answer: 'clay soil', wrong: ['sandy soil', 'loamy soil', 'gravel'], explanation: 'Clay has tiny particles that hold water tightly.' },
    { stem: 'Which farm animal is reared mainly for eggs and meat?', answer: 'poultry (chickens)', wrong: ['cattle', 'goats', 'pigs'], explanation: 'Poultry are kept for eggs and meat.' },
  ]),
  itemSet('pvs/cooking', ['Home Economics', 'Food and cooking'], 1, [
    { stem: 'Moi-moi is usually cooked by', answer: 'steaming', wrong: ['frying', 'roasting', 'grilling'], explanation: 'Moi-moi is wrapped in leaves or tins and steamed.' },
    { stem: 'Bread and cakes are cooked by', answer: 'baking', wrong: ['boiling', 'frying', 'steaming'], explanation: 'Baking uses the dry heat of an oven.' },
    { stem: 'Suya is cooked by', answer: 'grilling over an open fire', wrong: ['boiling', 'steaming', 'baking'], explanation: 'Suya is grilled on sticks over hot coals.' },
    { stem: 'Puff-puff and akara are cooked by', answer: 'deep frying', wrong: ['steaming', 'baking', 'boiling'], explanation: 'They are cooked in plenty of hot oil.' },
    { stem: 'Why should hands be washed before cooking?', answer: 'to stop germs getting into the food', wrong: ['to make the food tastier', 'to cook faster', 'to save gas'], explanation: 'Clean hands keep germs out of food and prevent illness.' },
  ]),
];

export const creativeArts: Template[] = [
  itemSet('cca/colour', ['Visual Arts', 'Colour'], 1, [
    { stem: 'Which are the three primary colours?', answer: 'red, yellow and blue', wrong: ['red, green and blue', 'orange, green and purple', 'black, white and red'], explanation: 'In painting, red, yellow and blue cannot be made by mixing other colours.' },
    { stem: 'Mixing red and yellow gives', answer: 'orange', wrong: ['green', 'purple', 'brown'], explanation: 'Red + yellow = orange, a secondary colour.' },
    { stem: 'Mixing blue and yellow gives', answer: 'green', wrong: ['orange', 'purple', 'grey'], explanation: 'Blue + yellow = green.' },
    { stem: 'Mixing red and blue gives', answer: 'purple', wrong: ['green', 'orange', 'pink'], explanation: 'Red + blue = purple (violet).' },
    { stem: 'Adding white to a colour makes a', answer: 'tint', wrong: ['shade', 'hue', 'tone of black'], explanation: 'A tint is lighter (white added); a shade is darker (black added).' },
  ]),
  itemSet('cca/tools-crafts', ['Visual Arts', 'Art tools and crafts'], 1, [
    { stem: 'What is a palette used for?', answer: 'mixing paints', wrong: ['holding a canvas upright', 'cutting paper', 'shaping clay'], explanation: 'Artists mix colours on a palette.' },
    { stem: 'What is an easel used for?', answer: 'holding a canvas or drawing board upright', wrong: ['mixing paints', 'cleaning brushes', 'weaving cloth'], explanation: 'An easel supports the work while the artist paints.' },
    { stem: 'Adire is a Nigerian craft of', answer: 'tie-dye and resist-dyeing cloth', wrong: ['carving wood', 'making pots', 'weaving baskets'], explanation: 'Adire is the Yoruba craft of dyeing cloth, traditionally with indigo.' },
    { stem: 'Pottery is the craft of making objects from', answer: 'clay', wrong: ['wood', 'metal', 'cloth'], explanation: 'Potters shape clay and fire it to harden it.' },
  ]),
  factPairs(
    'cca/note-values',
    ['Music', 'Note values'],
    2,
    [
      ['semibreve', '4 beats'],
      ['minim', '2 beats'],
      ['crotchet', '1 beat'],
      ['quaver', 'half a beat'],
      ['semiquaver', 'a quarter of a beat'],
    ],
    { forward: (a) => `In common time, how long is a ${a}?`, backward: (b) => `Which note lasts ${b} in common time?`, why: (a, b) => `A ${a} lasts ${b}.` },
  ),
  factPairs(
    'cca/instruments',
    ['Music', 'Musical instruments'],
    2,
    [
      ['talking drum (gangan)', 'membranophone'],
      ['gong (ogene)', 'idiophone'],
      ['flute (oja)', 'aerophone'],
      ['goje (one-string fiddle)', 'chordophone'],
    ],
    { forward: (a) => `To which class of instruments does the ${a} belong?`, backward: (b) => `Which of these is a ${b}?`, why: (a, b) => `The ${a} is a ${b}: ${{ membranophone: 'its sound comes from a stretched skin', idiophone: 'the body of the instrument itself vibrates', aerophone: 'a column of air vibrates', chordophone: 'a string vibrates' }[b]}.` },
  ),
  itemSet('cca/drama', ['Drama', 'Elements of drama'], 1, [
    { stem: 'The main character in a play is called the', answer: 'protagonist', wrong: ['antagonist', 'narrator', 'playwright'], explanation: 'The protagonist is the hero or central character.' },
    { stem: 'The character who opposes the main character is the', answer: 'antagonist', wrong: ['protagonist', 'director', 'chorus'], explanation: 'The antagonist works against the protagonist.' },
    { stem: 'A person who writes plays is called a', answer: 'playwright', wrong: ['director', 'producer', 'actor'], explanation: 'A playwright writes the script.' },
    { stem: 'Objects actors use on stage, such as a cup or a stick, are called', answer: 'props', wrong: ['costumes', 'scenery', 'scripts'], explanation: 'Props (properties) are objects handled on stage.' },
  ]),
];

export const french: Template[] = [
  factPairs(
    'french/greetings',
    ['Vocabulary', 'Greetings'],
    1,
    [
      ['Bonjour', 'Good morning / Hello'],
      ['Bonsoir', 'Good evening'],
      ['Au revoir', 'Goodbye'],
      ['Merci', 'Thank you'],
      ['S’il vous plaît', 'Please'],
      ['Comment tu t’appelles ?', 'What is your name?'],
      ['Comment ça va ?', 'How are you?'],
    ],
    { forward: (a) => `What does “${a}” mean in English?`, backward: (b) => `How do you say “${b}” in French?`, why: (a, b) => `“${a}” means “${b}”.` },
  ),
  factPairs(
    'french/numbers',
    ['Vocabulary', 'Numbers'],
    1,
    [
      ['un', '1'],
      ['deux', '2'],
      ['trois', '3'],
      ['quatre', '4'],
      ['cinq', '5'],
      ['six', '6'],
      ['sept', '7'],
      ['huit', '8'],
      ['neuf', '9'],
      ['dix', '10'],
      ['vingt', '20'],
      ['cent', '100'],
    ],
    { forward: (a) => `What number is “${a}”?`, backward: (b) => `How do you write ${b} in French?`, why: (a, b) => `“${a}” is ${b}.` },
  ),
  factPairs(
    'french/days',
    ['Vocabulary', 'Days and months'],
    1,
    [
      ['lundi', 'Monday'],
      ['mardi', 'Tuesday'],
      ['mercredi', 'Wednesday'],
      ['jeudi', 'Thursday'],
      ['vendredi', 'Friday'],
      ['samedi', 'Saturday'],
      ['dimanche', 'Sunday'],
    ],
    { forward: (a) => `What day is “${a}”?`, backward: (b) => `What is “${b}” in French?`, why: (a, b) => `“${a}” is ${b}.` },
  ),
  factPairs(
    'french/colours',
    ['Vocabulary', 'Colours'],
    1,
    [
      ['rouge', 'red'],
      ['bleu', 'blue'],
      ['vert', 'green'],
      ['jaune', 'yellow'],
      ['noir', 'black'],
      ['blanc', 'white'],
    ],
    { forward: (a) => `What colour is “${a}”?`, backward: (b) => `What is “${b}” in French?`, why: (a, b) => `“${a}” means ${b}.` },
  ),
  factPairs(
    'french/family-body',
    ['Vocabulary', 'Family'],
    1,
    [
      ['le père', 'father'],
      ['la mère', 'mother'],
      ['le frère', 'brother'],
      ['la sœur', 'sister'],
      ['la tête', 'head'],
      ['la main', 'hand'],
      ['le pied', 'foot'],
      ['la bouche', 'mouth'],
    ],
    { forward: (a) => `What does “${a}” mean?`, backward: (b) => `What is “${b}” in French?`, why: (a, b) => `“${a}” means ${b}.` },
  ),
  factPairs(
    'french/etre-avoir',
    ['Grammar', 'The verbs être and avoir'],
    2,
    [
      ['je ___ (être)', 'suis'],
      ['tu ___ (être)', 'es'],
      ['nous ___ (être)', 'sommes'],
      ['vous ___ (être)', 'êtes'],
      ['ils ___ (être)', 'sont'],
      ['j’___ (avoir)', 'ai'],
      ['nous ___ (avoir)', 'avons'],
      ['vous ___ (avoir)', 'avez'],
      ['ils ___ (avoir)', 'ont'],
    ],
    { forward: (a) => `Fill in the correct form of the verb: ${a}`, why: (a, b) => `The correct form is “${a.replace(/___ \(.+\)/, b)}”.` },
  ),
];
