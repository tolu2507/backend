import { factPairs, groupPick, itemSet, type Template } from '../engine.js';

/** Music, Fine/Visual Art, senior French, and Physical and Health Education. */

const THEORY = 'Rudiments of Music';
const HIST = 'History of Music';

export const musicSenior: Template[] = [
  factPairs(
    'music/key-signatures',
    [THEORY, 'Keys and scales'],
    3,
    [
      ['C major', 'no sharps or flats'],
      ['G major', 'one sharp (F♯)'],
      ['D major', 'two sharps (F♯, C♯)'],
      ['F major', 'one flat (B♭)'],
      ['B♭ major', 'two flats (B♭, E♭)'],
    ],
    { forward: (a) => `What is the key signature of ${a}?`, backward: (b) => `Which major key has ${b}?`, why: (a, b) => `${a} has ${b}.` },
  ),
  factPairs(
    'music/intervals',
    [THEORY, 'Intervals'],
    3,
    [
      ['C up to E', 'major 3rd'],
      ['C up to F', 'perfect 4th'],
      ['C up to G', 'perfect 5th'],
      ['C up to A', 'major 6th'],
      ['C up to the next C', 'perfect octave'],
    ],
    { forward: (a) => `What is the interval from ${a}?`, backward: (b) => `Which of these is a ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} is a ${b}.` },
  ),
  factPairs(
    'music/terms',
    [THEORY, 'Musical terms'],
    2,
    [
      ['allegro', 'fast and lively'],
      ['adagio', 'slow'],
      ['andante', 'at a walking pace'],
      ['presto', 'very fast'],
      ['forte', 'loud'],
      ['piano', 'soft'],
      ['crescendo', 'gradually getting louder'],
      ['diminuendo', 'gradually getting softer'],
    ],
    { forward: (a) => `What does the musical term “${a}” mean?`, backward: (b) => `Which term means “${b}”?`, why: (a, b) => `“${a[0].toUpperCase() + a.slice(1)}” means ${b}.` },
  ),
  factPairs(
    'music/composers',
    [HIST, 'Composers and musicians'],
    2,
    [
      ['Messiah (oratorio)', 'George Frideric Handel'],
      ['the Ninth (“Choral”) Symphony', 'Ludwig van Beethoven'],
      ['The Magic Flute (opera)', 'Wolfgang Amadeus Mozart'],
      ['the Brandenburg Concertos', 'Johann Sebastian Bach'],
      ['Afrobeat', 'Fela Anikulapo-Kuti'],
      ['jùjú music', 'King Sunny Adé'],
    ],
    { forward: (a) => `Who is best known for ${a}?`, why: (a, b) => `${b} is best known for ${a}.` },
  ),
];

const ART = 'Elements and Principles of Art';
const ARTHIST = 'Art History';

export const artSenior: Template[] = [
  factPairs(
    'art/elements',
    [ART, 'Elements of art'],
    2,
    [
      ['line', 'a mark made by a moving point'],
      ['texture', 'how a surface feels or looks as if it feels'],
      ['form', 'a three-dimensional shape with height, width and depth'],
      ['space', 'the area around and between objects'],
      ['value (tone)', 'how light or dark a colour is'],
    ],
    { forward: (a) => `In art, what is ${a}?`, backward: (b) => `Which element of art is ${b}?`, why: (a, b) => `${a[0].toUpperCase() + a.slice(1)} is ${b}.` },
  ),
  factPairs(
    'art/nigerian-artists',
    [ARTHIST, 'Nigerian artists'],
    3,
    [
      ['Aina Onabolu', 'a pioneer of modern Nigerian painting in the realist style'],
      ['Ben Enwonwu', 'the sculpture “Anyanwu” and the painting “Tutu”'],
      ['Bruce Onobrakpeya', 'printmaking, including the plastocast technique'],
      ['Uche Okeke', 'reviving uli designs and the Nsukka school'],
      ['Lamidi Fakeye', 'Yoruba woodcarving'],
    ],
    { forward: (a) => `${a} is best known for`, backward: (b) => `Which Nigerian artist is best known for ${b}?`, why: (a, b) => `${a} is known for ${b}.` },
  ),
  itemSet('art/traditional', [ARTHIST, 'Traditional Nigerian art'], 2, [
    { stem: 'Which ancient Nigerian culture is known for terracotta (baked clay) heads?', answer: 'Nok', wrong: ['Benin', 'Igbo-Ukwu', 'Esie'], explanation: 'Nok terracottas are over 2,000 years old.' },
    { stem: 'Which Nigerian art tradition is famous for very lifelike bronze and terracotta heads of rulers?', answer: 'Ife', wrong: ['Nok', 'Igbo-Ukwu', 'Tada'], explanation: 'Ife heads are known for their naturalism.' },
    { stem: 'Which site produced finely decorated bronzes dated to about the 9th–10th century?', answer: 'Igbo-Ukwu', wrong: ['Benin', 'Ife', 'Oyo'], explanation: 'Igbo-Ukwu bronzes are among the oldest in West Africa.' },
    { stem: 'A picture made by sticking pieces of paper, cloth or other materials onto a surface is a', answer: 'collage', wrong: ['mosaic', 'mural', 'still life'], explanation: 'A collage is built from pasted materials; a mosaic uses small pieces such as tiles or stones.' },
    { stem: 'A painting or drawing of objects such as fruit, pots and flowers arranged on a table is a', answer: 'still life', wrong: ['landscape', 'portrait', 'abstract'], explanation: 'Still life shows non-moving objects.' },
  ]),
];

export const frenchSenior: Template[] = [
  factPairs(
    'french/parler',
    ['Grammar', 'Regular -er verbs'],
    2,
    [
      ['je ___ (parler)', 'parle'],
      ['tu ___ (parler)', 'parles'],
      ['nous ___ (parler)', 'parlons'],
      ['vous ___ (parler)', 'parlez'],
      ['ils ___ (parler)', 'parlent'],
    ],
    { forward: (a) => `Fill in the correct form of the verb: ${a}`, why: (a, b) => `The correct form is “${a.replace(/___ \(.+\)/, b)}”.` },
  ),
  factPairs(
    'french/aller',
    ['Grammar', 'Irregular verbs'],
    2,
    [
      ['je ___ (aller)', 'vais'],
      ['tu ___ (aller)', 'vas'],
      ['il ___ (aller)', 'va'],
      ['nous ___ (aller)', 'allons'],
      ['vous ___ (aller)', 'allez'],
      ['ils ___ (aller)', 'vont'],
    ],
    { forward: (a) => `Fill in the correct form of the verb: ${a}`, why: (a, b) => `The correct form is “${a.replace(/___ \(.+\)/, b)}”.` },
  ),
  factPairs(
    'french/questions',
    ['Vocabulary', 'Question words'],
    1,
    [
      ['Où', 'Where'],
      ['Quand', 'When'],
      ['Pourquoi', 'Why'],
      ['Comment', 'How'],
      ['Qui', 'Who'],
      ['Combien', 'How much / How many'],
    ],
    { forward: (a) => `What does “${a} ?” mean?`, backward: (b) => `How do you say “${b}?” in French?`, why: (a, b) => `“${a}” means “${b}”.` },
  ),
  itemSet('french/grammar', ['Grammar', 'Sentence structure'], 3, [
    { stem: 'Choose the correct negative of “Je mange du riz.”', answer: 'Je ne mange pas de riz.', wrong: ['Je mange pas du riz.', 'Je ne pas mange du riz.', 'Ne je mange pas de riz.'], explanation: '“ne … pas” goes round the verb, and “du” becomes “de” after a negative.' },
    { stem: 'Which helping verb is used to form the passé composé of “aller”?', answer: 'être', wrong: ['avoir', 'faire', 'aller'], explanation: 'Verbs of movement such as aller, venir and partir use être: “je suis allé”.' },
    { stem: 'Complete: “Hier, nous ___ mangé au restaurant.”', answer: 'avons', wrong: ['sommes', 'allons', 'avez'], explanation: '“Manger” takes avoir in the passé composé: nous avons mangé.' },
    { stem: 'Which article goes with “maison” (a feminine noun)?', answer: 'la', wrong: ['le', 'les', 'un'], explanation: '“La maison” (the house); “une maison” (a house).' },
  ]),
];

const PE = 'Games and Sports';
const HEALTH = 'Health Education';

export const physicalEducation: Template[] = [
  factPairs(
    'pe/players',
    [PE, 'Rules of games'],
    1,
    [
      ['football', '11'],
      ['basketball', '5'],
      ['volleyball', '6'],
      ['handball', '7'],
    ],
    { forward: (a) => `How many players does each team have on the field or court in ${a}?`, backward: (b) => `In which game does each team have ${b} players on court at a time?`, why: (a, b) => `In ${a}, each team has ${b} players at a time.` },
  ),
  itemSet('pe/sports-facts', [PE, 'Rules of games'], 2, [
    { stem: 'How long is a normal football match, not counting extra time?', answer: '90 minutes', wrong: ['60 minutes', '80 minutes', '120 minutes'], explanation: 'Two halves of 45 minutes each.' },
    { stem: 'How many runners are in a relay team?', answer: '4', wrong: ['2', '3', '6'], explanation: 'Each of the four runners covers one leg, passing the baton.' },
    { stem: 'How long is a marathon?', answer: '42.195 km', wrong: ['10 km', '21.1 km', '50 km'], explanation: 'A marathon is 42.195 km; a half-marathon is about 21.1 km.' },
    { stem: 'How often are the Summer Olympic Games held?', answer: 'every 4 years', wrong: ['every year', 'every 2 years', 'every 5 years'], explanation: 'The Olympic Games are held every four years.' },
    { stem: 'Who revived the modern Olympic Games, first held in Athens in 1896?', answer: 'Pierre de Coubertin', wrong: ['Jesse Owens', 'Avery Brundage', 'Juan Antonio Samaranch'], explanation: 'Baron Pierre de Coubertin founded the modern Olympics.' },
    { stem: 'Who won Nigeria’s first Olympic gold medal, in the long jump at Atlanta 1996?', answer: 'Chioma Ajunwa', wrong: ['Mary Onyali', 'Blessing Okagbare', 'Falilat Ogunkoya'], explanation: 'Chioma Ajunwa won the women’s long jump in 1996.' },
  ]),
  itemSet('pe/first-aid', [HEALTH, 'First aid and safety'], 2, [
    { stem: 'In first aid for a sprained ankle, RICE stands for', answer: 'Rest, Ice, Compression, Elevation', wrong: ['Run, Ice, Cover, Exercise', 'Rest, Inspect, Cool, Exercise', 'Raise, Ice, Cover, Ease'], explanation: 'RICE reduces pain and swelling.' },
    { stem: 'A sprain is an injury to a', answer: 'ligament', wrong: ['muscle', 'bone', 'tendon only'], explanation: 'A sprain damages a ligament (joining bone to bone); a strain damages a muscle or tendon.' },
    { stem: 'How many bones are in the adult human skeleton?', answer: '206', wrong: ['106', '300', '212'], explanation: 'Adults have 206 bones; babies are born with more, which fuse as they grow.' },
    { stem: 'Warming up before exercise mainly helps to', answer: 'prepare the muscles and heart and reduce injury', wrong: ['make you tired faster', 'cool the body down', 'build fat'], explanation: 'A warm-up raises heart rate and loosens muscles.' },
    { stem: 'Which of these is a communicable disease?', answer: 'tuberculosis', wrong: ['diabetes', 'high blood pressure', 'asthma'], explanation: 'Tuberculosis spreads from person to person; the others are not infectious.' },
  ]),
  groupPick(
    'pe/fitness',
    [HEALTH, 'Physical fitness'],
    2,
    { 'test of muscular strength or endurance': ['press-ups', 'sit-ups', 'pull-ups'], 'test of cardiovascular endurance': ['a 1.5 km run', 'the shuttle (bleep) test', 'step-ups for three minutes'], 'test of flexibility': ['the sit-and-reach test', 'trunk rotation', 'touching your toes'] },
    { stem: (g) => `Which of these is a ${g}?`, why: (a, g) => `${a[0].toUpperCase() + a.slice(1)} is a ${g}.` },
  ),
];
