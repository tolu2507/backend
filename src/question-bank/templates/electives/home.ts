import { factPairs, groupPick, itemSet, type Template } from '../engine.js';

/** Home Economics, Foods and Nutrition, Catering Craft Practice, and Clothing and Textiles. */

const FOOD = 'Food and Nutrition';
const COOK = 'Food Preparation';

/** Shared by Home Economics, Foods and Nutrition and Catering. */
export const foodCore: Template[] = [
  itemSet('home/digestion-products', [FOOD, 'Nutrients'], 2, [
    { stem: 'Proteins are broken down during digestion into', answer: 'amino acids', wrong: ['glucose', 'fatty acids and glycerol', 'vitamins'], explanation: 'Proteins are digested into amino acids, which build and repair the body.' },
    { stem: 'Carbohydrates are broken down during digestion into', answer: 'simple sugars such as glucose', wrong: ['amino acids', 'fatty acids and glycerol', 'minerals'], explanation: 'Starch and sugars end up as glucose, the body’s main fuel.' },
    { stem: 'Fats and oils are broken down during digestion into', answer: 'fatty acids and glycerol', wrong: ['amino acids', 'glucose', 'starch'], explanation: 'Lipase digests fats into fatty acids and glycerol.' },
    { stem: 'Which nutrient is mainly needed for growth and the repair of body tissues?', answer: 'protein', wrong: ['carbohydrate', 'fat', 'water'], explanation: 'Proteins are body-building foods.' },
    { stem: 'Which mineral is needed to make haemoglobin in red blood cells?', answer: 'iron', wrong: ['calcium', 'iodine', 'sodium'], explanation: 'Too little iron causes anaemia.' },
  ]),
  groupPick(
    'home/food-sources',
    [FOOD, 'Nutrients'],
    1,
    {
      'good source of protein': ['beans', 'fish', 'eggs', 'meat', 'milk'],
      'good source of carbohydrate': ['yam', 'rice', 'garri', 'bread', 'plantain'],
      'good source of vitamin C': ['oranges', 'guava', 'pawpaw', 'tomatoes'],
    },
    { stem: (g) => `Which of these foods is a ${g}?`, why: (a, g) => `${a[0].toUpperCase() + a.slice(1)} is a ${g}.` },
  ),
  groupPick(
    'home/cooking-methods',
    [COOK, 'Methods of cooking'],
    2,
    { 'moist-heat': ['boiling', 'steaming', 'stewing', 'poaching'], 'dry-heat': ['baking', 'roasting', 'grilling', 'frying'] },
    { stem: (g) => `Which of these is a ${g} method of cooking?`, why: (a, g) => `${a[0].toUpperCase() + a.slice(1)} is a ${g} method: ${g === 'moist-heat' ? 'food is cooked in water, steam or liquid' : 'food is cooked by hot air, radiant heat or hot fat, without water'}.` },
  ),
  factPairs(
    'home/kitchen-tools',
    [COOK, 'Kitchen equipment'],
    1,
    [
      ['whisk', 'beating air into eggs or cream'],
      ['colander', 'draining water from cooked food'],
      ['grater', 'shredding foods such as coconut or cheese'],
      ['rolling pin', 'rolling out dough'],
      ['sieve', 'sifting flour'],
      ['ladle', 'serving soups and stews'],
    ],
    { forward: (a) => `What is a ${a} used for?`, backward: (b) => `Which kitchen tool is used for ${b}?`, why: (a, b) => `A ${a} is used for ${b}.` },
  ),
  factPairs(
    'home/preservation',
    [COOK, 'Food preservation'],
    2,
    [
      ['drying', 'removes the water germs need to grow'],
      ['freezing', 'keeps food too cold for germs to multiply'],
      ['salting', 'draws water out of food so germs cannot grow'],
      ['canning', 'heats food in a sealed tin to kill germs and keep new ones out'],
      ['pickling', 'stores food in vinegar, which is too acidic for most germs'],
    ],
    { forward: (a) => `How does ${a} preserve food?`, backward: (b) => `Which method of preservation ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} ${b}.` },
  ),
  itemSet('home/hygiene', [COOK, 'Kitchen hygiene and safety'], 1, [
    { stem: 'Why should raw meat be kept away from cooked food?', answer: 'to stop germs from the raw meat getting into ready-to-eat food', wrong: ['to keep the meat fresh longer', 'to save space in the fridge', 'to make the meat cook faster'], explanation: 'This prevents cross-contamination, a common cause of food poisoning.' },
    { stem: 'What should you use to put out a fire caused by hot oil in a pan?', answer: 'cover the pan with a lid or a damp cloth', wrong: ['pour water on it', 'fan it', 'carry the pan outside quickly'], explanation: 'Water makes burning oil spatter and spread. Cutting off the air puts it out.' },
    { stem: 'A balanced diet is one that', answer: 'contains all the nutrients in the right amounts', wrong: ['is eaten only once a day', 'has plenty of fat and sugar', 'contains only fruits and vegetables'], explanation: 'A balanced diet has carbohydrates, proteins, fats, vitamins, minerals and water in the right proportions.' },
  ]),
];

export const catering: Template[] = [
  itemSet('catering/menus-kitchen', ['Catering Operations', 'Menus and the kitchen brigade'], 2, [
    { stem: 'A menu on which each dish is priced separately is called', answer: 'à la carte', wrong: ['table d’hôte', 'buffet', 'cyclical'], explanation: 'À la carte prices each dish; table d’hôte is a set meal at a fixed price.' },
    { stem: 'A set meal of several courses at a fixed price is a', answer: 'table d’hôte menu', wrong: ['à la carte menu', 'snack menu', 'room-service menu'], explanation: 'Table d’hôte offers fixed courses at one price.' },
    { stem: 'The head of a large kitchen is the', answer: 'chef de cuisine (head chef)', wrong: ['sous chef', 'commis chef', 'chef de partie'], explanation: 'The head chef runs the kitchen; the sous chef is the deputy.' },
    { stem: 'The deputy to the head chef is the', answer: 'sous chef', wrong: ['commis chef', 'chef de partie', 'maître d’hôtel'], explanation: 'The sous chef takes charge when the head chef is away.' },
    { stem: 'A junior cook who assists a section chef is a', answer: 'commis chef', wrong: ['sous chef', 'head chef', 'pastry chef'], explanation: 'Commis chefs are trainees or junior cooks.' },
    { stem: 'In table service, the person in charge of the restaurant and its waiters is the', answer: 'head waiter (maître d’hôtel)', wrong: ['commis chef', 'cashier', 'storekeeper'], explanation: 'The maître d’hôtel manages the dining room.' },
  ]),
];

const TEX = 'Textiles';
const SEW = 'Sewing';

export const clothing: Template[] = [
  groupPick(
    'clothing/fibres',
    [TEX, 'Fibres and fabrics'],
    2,
    { 'plant (cellulose) fibre': ['cotton', 'linen (flax)', 'jute'], 'animal (protein) fibre': ['wool', 'silk', 'mohair'], 'synthetic fibre': ['nylon', 'polyester', 'acrylic'] },
    { stem: (g) => `Which of these is a ${g}?`, why: (a, g) => `${a[0].toUpperCase() + a.slice(1)} is a ${g}.` },
  ),
  factPairs(
    'clothing/sewing-tools',
    [SEW, 'Sewing equipment'],
    1,
    [
      ['a thimble', 'protecting the finger when hand sewing'],
      ['tailor’s chalk', 'marking lines on fabric'],
      ['pinking shears', 'cutting a zig-zag edge that stops fabric fraying'],
      ['a seam ripper (unpicker)', 'removing unwanted stitches'],
      ['a tape measure', 'taking body measurements'],
    ],
    { forward: (a) => `What is ${a} used for?`, backward: (b) => `Which sewing tool is used for ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} is used for ${b}.` },
  ),
  itemSet('clothing/fabric-facts', [TEX, 'Fibres and fabrics'], 2, [
    { stem: 'Silk is produced by the', answer: 'silkworm', wrong: ['sheep', 'cotton plant', 'flax plant'], explanation: 'Silk comes from the cocoon of the silkworm.' },
    { stem: 'Which weave has a diagonal pattern, as in denim?', answer: 'twill weave', wrong: ['plain weave', 'satin weave', 'pile weave'], explanation: 'Twill weave produces diagonal ridges; denim is a twill.' },
    { stem: 'Which weave is the simplest, with each thread passing over one and under one?', answer: 'plain weave', wrong: ['twill weave', 'satin weave', 'leno weave'], explanation: 'Plain weave is over-one, under-one.' },
    { stem: 'Which fibre burns with a smell like burning hair?', answer: 'wool', wrong: ['cotton', 'linen', 'rayon'], explanation: 'Protein fibres such as wool and silk smell like burning hair; cellulose fibres smell like burning paper.' },
    { stem: 'A temporary stitch used to hold fabric in place before final sewing is', answer: 'tacking', wrong: ['back stitch', 'hemming', 'blanket stitch'], explanation: 'Tacking is removed once the permanent stitches are in.' },
  ]),
];
