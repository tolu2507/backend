import { factPairs, groupPick, itemSet, num, type Template } from '../engine.js';

/** Computer Studies, Data Processing and Technical Drawing. */

const CS_HW = 'Computer Hardware';
const CS_SW = 'Computer Software and the Internet';
const CS_DATA = 'Data Representation and Logic';

export const computerStudies: Template[] = [
  groupPick(
    'computer/devices',
    [CS_HW, 'Input, output and storage devices'],
    1,
    {
      'input device': ['keyboard', 'mouse', 'scanner', 'microphone', 'webcam'],
      'output device': ['monitor', 'printer', 'speaker', 'projector'],
      'storage device': ['hard disk', 'flash drive', 'memory card', 'DVD'],
    },
    { stem: (g) => `Which of these is ${g.startsWith('input') || g.startsWith('output') ? 'an' : 'a'} ${g}?`, why: (a, g) => `A ${a} is ${g.startsWith('input') || g.startsWith('output') ? 'an' : 'a'} ${g}.` },
  ),
  groupPick(
    'computer/software',
    [CS_SW, 'Types of software'],
    1,
    { 'operating system': ['Windows', 'Linux', 'macOS', 'Android'], 'application program': ['Microsoft Word', 'Microsoft Excel', 'a web browser', 'CorelDRAW'] },
    { stem: (g) => `Which of these is ${g === 'operating system' ? 'an operating system' : 'an application program'}?`, why: (a, g) => `${a} is ${g === 'operating system' ? 'an operating system: it manages the computer and runs other programs' : 'an application program: it does a particular job for the user'}.` },
  ),
  {
    key: 'computer/data-units',
    topic: [CS_DATA, 'Units of data'],
    difficulty: 2,
    make: (r) => {
      if (r.chance(0.5)) {
        const bytes = r.pick([2, 4, 8, 16, 32, 64]);
        return {
          stem: `How many bits are there in ${bytes} bytes?`,
          answer: String(bytes * 8),
          wrong: [bytes * 4, bytes * 1024, bytes / 8, bytes * 10].filter((x) => Number.isInteger(x)).map(String),
          explanation: `1 byte = 8 bits, so ${bytes} bytes = ${bytes} × 8 = ${bytes * 8} bits.`,
        };
      }
      const [from, to, k] = r.pick([
        ['kilobytes', 'bytes', 1024],
        ['megabytes', 'kilobytes', 1024],
        ['gigabytes', 'megabytes', 1024],
      ] as const);
      const n = r.pick([2, 3, 4, 5, 8]);
      return {
        stem: `How many ${to} are there in ${n} ${from}?`,
        answer: num(n * k, undefined, 4),
        wrong: [n * 1000, n * 8, n * k * 8, n * 100].map((x) => num(x, undefined, 4)),
        explanation: `1 ${from.replace(/s$/, '')} = 1,024 ${to}, so ${n} × 1,024 = ${num(n * k, undefined, 4)}.`,
      };
    },
  },
  {
    key: 'computer/binary',
    topic: [CS_DATA, 'Number systems'],
    difficulty: 2,
    make: (r) => {
      const n = r.int(5, 63);
      const bin = n.toString(2);
      if (r.chance(0.5)) {
        return {
          stem: `Convert the binary number ${bin}₂ to decimal.`,
          answer: String(n),
          wrong: [n + 1, n - 1, parseInt(bin.split('').reverse().join(''), 2), Number(bin) % 100].filter((x) => x !== n && x >= 0).map(String),
          explanation: `Add the place values of the 1s (from the right: 1, 2, 4, 8, 16, 32): ${bin
            .split('')
            .reverse()
            .map((d, i) => (d === '1' ? 2 ** i : 0))
            .filter(Boolean)
            .reverse()
            .join(' + ')} = ${n}.`,
        };
      }
      return {
        stem: `Convert ${n} to binary.`,
        answer: `${bin}₂`,
        wrong: [(n + 1).toString(2), (n - 1).toString(2), bin.split('').reverse().join('') === bin ? (n + 2).toString(2) : bin.split('').reverse().join('')].filter((x) => x !== bin).map((x) => `${x}₂`),
        explanation: `Divide by 2 repeatedly and read the remainders from the bottom up, or write ${n} as a sum of powers of 2: ${bin
          .split('')
          .reverse()
          .map((d, i) => (d === '1' ? 2 ** i : 0))
          .filter(Boolean)
          .reverse()
          .join(' + ')}. So ${n} = ${bin}₂.`,
      };
    },
  },
  {
    key: 'computer/logic-gates',
    topic: [CS_DATA, 'Logic gates'],
    difficulty: 3,
    make: (r) => {
      const gate = r.pick(['AND', 'OR', 'NAND', 'NOR', 'NOT'] as const);
      const a = r.int(0, 1);
      const b = r.int(0, 1);
      const out = { AND: a & b, OR: a | b, NAND: 1 - (a & b), NOR: 1 - (a | b), NOT: 1 - a }[gate];
      const rule = { AND: 'gives 1 only when both inputs are 1', OR: 'gives 1 when at least one input is 1', NAND: 'is NOT-AND: it gives 0 only when both inputs are 1', NOR: 'is NOT-OR: it gives 1 only when both inputs are 0', NOT: 'reverses its input' }[gate];
      return {
        stem: gate === 'NOT' ? `What is the output of a NOT gate when the input is ${a}?` : `What is the output of ${gate === 'AND' || gate === 'OR' ? 'an' : 'a'} ${gate} gate when the inputs are A = ${a} and B = ${b}?`,
        answer: String(out),
        wrong: [String(1 - out), 'It cannot be worked out', '2'],
        explanation: `${gate === 'AND' || gate === 'OR' ? 'An' : 'A'} ${gate} gate ${rule}, so the output is ${out}.`,
      };
    },
  },
  factPairs(
    'computer/flowchart',
    ['Programming', 'Flowcharts and algorithms'],
    2,
    [
      ['oval', 'start or stop'],
      ['parallelogram', 'input or output'],
      ['rectangle', 'a process (calculation or action)'],
      ['diamond', 'a decision (yes or no)'],
    ],
    { forward: (a) => `In a flowchart, what does a ${a} stand for?`, backward: (b) => `Which flowchart symbol stands for ${b}?`, why: (a, b) => `A ${a} stands for ${b}.` },
  ),
  itemSet('computer/facts', [CS_HW, 'History and parts of the computer'], 2, [
    { stem: 'Who is known as the father of the computer?', answer: 'Charles Babbage', wrong: ['Bill Gates', 'Blaise Pascal', 'Alan Turing'], explanation: 'Charles Babbage designed the Analytical Engine in the 1830s.' },
    { stem: 'Which part of the computer carries out instructions and calculations?', answer: 'the CPU (central processing unit)', wrong: ['the monitor', 'the hard disk', 'the keyboard'], explanation: 'The CPU, made of the control unit and the ALU, processes data.' },
    { stem: 'Which memory loses its contents when the computer is switched off?', answer: 'RAM', wrong: ['ROM', 'the hard disk', 'a flash drive'], explanation: 'RAM is volatile; ROM keeps its contents without power.' },
    { stem: 'First-generation computers used', answer: 'vacuum tubes', wrong: ['transistors', 'integrated circuits', 'microprocessors'], explanation: 'Generations: vacuum tubes, transistors, integrated circuits, then microprocessors.' },
    { stem: 'Fourth-generation computers are built around', answer: 'microprocessors', wrong: ['vacuum tubes', 'transistors only', 'punched cards'], explanation: 'The microprocessor puts a whole CPU on a single chip.' },
    { stem: 'What does URL stand for?', answer: 'Uniform Resource Locator', wrong: ['Universal Reading Link', 'Unified Resource Line', 'User Resource Locator'], explanation: 'A URL is the address of a page on the web.' },
    { stem: 'A program that copies itself and can damage files on a computer is a', answer: 'virus', wrong: ['browser', 'compiler', 'firewall'], explanation: 'Antivirus software protects against viruses.' },
  ]),
];

export const dataProcessing: Template[] = [
  factPairs(
    'data/database-terms',
    ['Databases', 'Database concepts'],
    2,
    [
      ['field', 'one item of data, such as a surname, in a record'],
      ['record', 'all the data about one person or thing'],
      ['file (table)', 'a collection of related records'],
      ['primary key', 'a field whose value is different for every record'],
      ['query', 'a request to find data that meets given conditions'],
    ],
    { forward: (a) => `In a database, what is a ${a}?`, backward: (b) => `In a database, what is ${b} called?`, why: (a, b) => `A ${a} is ${b}.` },
  ),
  {
    key: 'data/spreadsheet-functions',
    topic: ['Spreadsheets', 'Spreadsheet formulas'],
    difficulty: 2,
    make: (r) => {
      const vals = Array.from({ length: 4 }, () => r.int(2, 40));
      const fn = r.pick(['SUM', 'AVERAGE', 'MAX', 'MIN', 'COUNT'] as const);
      const res = { SUM: vals.reduce((s, x) => s + x, 0), AVERAGE: vals.reduce((s, x) => s + x, 0) / 4, MAX: Math.max(...vals), MIN: Math.min(...vals), COUNT: 4 }[fn];
      if (!Number.isInteger(res * 4)) return null;
      const alt = [vals.reduce((s, x) => s + x, 0), vals.reduce((s, x) => s + x, 0) / 4, Math.max(...vals), Math.min(...vals), 4];
      return {
        stem: `Cells A1 to A4 contain ${vals.join(', ')}. What does the formula =${fn}(A1:A4) give?`,
        answer: num(res),
        wrong: alt.filter((x) => x !== res).map((x) => num(x)),
        explanation: `${fn} ${{ SUM: 'adds the values', AVERAGE: 'finds the mean', MAX: 'finds the largest value', MIN: 'finds the smallest value', COUNT: 'counts the cells with numbers' }[fn]}: ${num(res)}.`,
      };
    },
  },
  itemSet('data/files', ['Databases', 'File organisation'], 3, [
    { stem: 'In which file organisation are records stored and read one after another, in order?', answer: 'sequential', wrong: ['random (direct)', 'indexed', 'hashed'], explanation: 'Sequential files are read from the start in order, like a tape.' },
    { stem: 'Which file organisation lets any record be reached directly without reading the others?', answer: 'random (direct) access', wrong: ['sequential access', 'serial access', 'tape access'], explanation: 'Direct access goes straight to a record, usually by its key.' },
    { stem: 'Processed data that has meaning is called', answer: 'information', wrong: ['raw data', 'a field', 'a byte'], explanation: 'Data is processed to produce information.' },
    { stem: 'Which of these is a database management system (DBMS)?', answer: 'Microsoft Access', wrong: ['Microsoft Paint', 'Windows Explorer', 'Adobe Reader'], explanation: 'Access, MySQL and Oracle are DBMSs.' },
    { stem: 'Making a copy of data in case the original is lost is called', answer: 'backing up', wrong: ['formatting', 'defragmenting', 'compiling'], explanation: 'A backup lets data be restored after loss or damage.' },
  ]),
];

const TD = 'Drawing Practice';

export const technicalDrawing: Template[] = [
  factPairs(
    'td/instruments',
    [TD, 'Drawing instruments'],
    1,
    [
      ['T-square', 'drawing horizontal lines'],
      ['set square', 'drawing vertical and angled lines (30°, 45°, 60°)'],
      ['compass', 'drawing circles and arcs'],
      ['protractor', 'measuring and setting out angles'],
      ['French curve', 'drawing irregular curves'],
      ['divider', 'transferring and stepping off measurements'],
    ],
    { forward: (a) => `What is a ${a} mainly used for?`, backward: (b) => `Which instrument is used for ${b}?`, why: (a, b) => `A ${a} is used for ${b}.` },
  ),
  factPairs(
    'td/lines',
    [TD, 'Types of line'],
    2,
    [
      ['continuous thick line', 'visible outlines and edges'],
      ['continuous thin line', 'dimension and projection lines'],
      ['short dashed line', 'hidden edges'],
      ['thin chain line', 'centre lines'],
    ],
    { forward: (a) => `In technical drawing, a ${a} shows`, backward: (b) => `Which type of line is used for ${b}?`, why: (a, b) => `A ${a} shows ${b}.` },
  ),
  {
    key: 'td/scale',
    topic: [TD, 'Scales'],
    difficulty: 2,
    make: (r) => {
      const [a, b] = r.pick([
        [1, 2],
        [1, 5],
        [1, 10],
        [1, 20],
        [1, 50],
        [2, 1],
        [5, 1],
      ]);
      const real = b > a ? r.pick([100, 200, 250, 400, 500, 1000]) : r.pick([5, 10, 12, 20, 25]);
      const drawn = (real * a) / b;
      return {
        stem: `An object ${real} mm long is drawn to a scale of ${a} : ${b}. How long is it on the drawing?`,
        answer: `${num(drawn)} mm`,
        wrong: [(real * b) / a, real, real / 10, drawn * 2].filter((x) => x !== drawn).map((x) => `${num(x)} mm`),
        explanation: `${a} : ${b} means ${a} mm on paper for every ${b} mm on the object (${a < b ? 'a reduction' : 'an enlargement'}). ${real} × ${a} ÷ ${b} = ${num(drawn)} mm.`,
      };
    },
  },
  itemSet('td/projection', [TD, 'Projection and pictorial drawing'], 2, [
    { stem: 'In isometric drawing, the receding axes are drawn at what angle to the horizontal?', answer: '30°', wrong: ['45°', '60°', '90°'], explanation: 'Isometric axes are at 30° to the horizontal on each side.' },
    { stem: 'In cabinet oblique drawing, receding lines are usually drawn at 45° and at', answer: 'half their true length', wrong: ['full length', 'twice their length', 'a quarter of their length'], explanation: 'Cabinet oblique halves receding lengths to look more natural; cavalier keeps them full length.' },
    { stem: 'In orthographic projection, the view seen from directly above is the', answer: 'plan', wrong: ['front elevation', 'end elevation', 'section'], explanation: 'The plan is the top view; elevations are side and front views.' },
    { stem: 'What are the dimensions of A4 paper?', answer: '210 mm × 297 mm', wrong: ['297 mm × 420 mm', '148 mm × 210 mm', '250 mm × 350 mm'], explanation: 'A4 is 210 × 297 mm; A3 is twice the size, 297 × 420 mm.' },
    { stem: 'Which projection places the plan below the front elevation?', answer: 'first angle projection', wrong: ['third angle projection', 'isometric projection', 'oblique projection'], explanation: 'In first angle the plan goes below the front view; in third angle it goes above.' },
  ]),
];
