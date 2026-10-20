import type { EducationLevel, ExamBody } from '@prisma/client';

/**
 * The exams BrainBox prepares students for, each with its subjects and the rules for choosing them.
 * Subject slugs match the past-paper sources so analysis can join on them. Synced into
 * ExamSubject when the API starts (ExamsService.onApplicationBootstrap).
 */
export type ExamRules = {
  label: string;
  fullName: string;
  level: EducationLevel;
  compulsory: string[]; // slugs everyone sits
  pick: { min: number; max: number }; // how many subjects in total, compulsory ones included
  fridayMock: boolean;
  mockMinutes: number;
  subjects: { slug: string; name: string; mockQuestions?: number }[];
  /** Common course combinations (JAMB only). Students should still check their university's brochure. */
  courses?: { course: string; subjects: string[] }[];
};

const s = (slug: string, name: string, mockQuestions?: number) => ({ slug, name, mockQuestions });

const SENIOR_CORE = [
  s('english-language', 'English Language'),
  s('mathematics', 'Mathematics'),
  s('physics', 'Physics'),
  s('chemistry', 'Chemistry'),
  s('biology', 'Biology'),
  s('economics', 'Economics'),
  s('government', 'Government'),
  s('literature-in-english', 'Literature in English'),
  s('geography', 'Geography'),
  s('commerce', 'Commerce'),
  s('accounts-principles-of-accounts', 'Financial Accounting'),
  s('agricultural-science', 'Agricultural Science'),
  s('christian-religious-studies-crs', 'Christian Religious Studies'),
  s('islamic-religious-studies-irs', 'Islamic Religious Studies'),
  s('history', 'History'),
  s('computer-studies', 'Computer Studies'),
  s('further-mathematics', 'Further Mathematics'),
  s('civic-education', 'Civic Education'),
  s('yoruba', 'Yoruba'),
  s('igbo', 'Igbo'),
  s('hausa', 'Hausa'),
  s('french', 'French'),
  s('arabic', 'Arabic'),
  s('home-economics', 'Home Economics'),
  s('music', 'Music'),
  s('technical-drawing', 'Technical Drawing'),
  s('visual-art', 'Visual Art'),
  s('physical-education', 'Physical Education'),
  s('data-processing', 'Data Processing'),
  s('marketing', 'Marketing'),
  s('office-practice', 'Office Practice'),
  s('insurance', 'Insurance'),
  s('bookkeeping', 'Book Keeping'),
  s('foods-and-nutrition', 'Foods and Nutrition'),
  s('animal-husbandry', 'Animal Husbandry'),
  s('fisheries', 'Fisheries'),
  s('catering-craft-practice', 'Catering Craft Practice'),
  s('clothing-and-textiles', 'Clothing and Textiles'),
];

const pickFrom = (slugs: string[]) => SENIOR_CORE.filter((x) => slugs.includes(x.slug));

export const EXAM_CATALOG: Record<ExamBody, ExamRules> = {
  JAMB: {
    label: 'JAMB',
    fullName: 'JAMB UTME',
    level: 'SENIOR_SECONDARY',
    compulsory: ['english-language'],
    pick: { min: 4, max: 4 }, // Use of English + 3
    fridayMock: true,
    mockMinutes: 120,
    subjects: [
      s('english-language', 'Use of English', 60),
      ...pickFrom([
        'mathematics', 'physics', 'chemistry', 'biology', 'economics', 'government', 'literature-in-english', 'geography', 'commerce',
        'accounts-principles-of-accounts', 'agricultural-science', 'christian-religious-studies-crs', 'islamic-religious-studies-irs', 'history',
        'computer-studies', 'yoruba', 'igbo', 'hausa', 'french', 'arabic', 'home-economics', 'music',
      ]).map((x) => ({ ...x, mockQuestions: 40 })),
      s('art', 'Fine Art', 40),
      s('physical-health-education', 'Physical and Health Education', 40),
    ],
    courses: [
      { course: 'Medicine, Nursing, Pharmacy', subjects: ['biology', 'chemistry', 'physics'] },
      { course: 'Engineering', subjects: ['mathematics', 'physics', 'chemistry'] },
      { course: 'Computer Science', subjects: ['mathematics', 'physics', 'chemistry'] },
      { course: 'Law', subjects: ['literature-in-english', 'government', 'history'] },
      { course: 'Accounting, Banking & Finance', subjects: ['mathematics', 'economics', 'accounts-principles-of-accounts'] },
      { course: 'Economics', subjects: ['mathematics', 'economics', 'government'] },
      { course: 'Mass Communication', subjects: ['literature-in-english', 'government', 'economics'] },
    ],
  },
  WAEC: {
    label: 'WAEC',
    fullName: 'WAEC WASSCE (and GCE)',
    level: 'SENIOR_SECONDARY',
    compulsory: ['english-language', 'mathematics'],
    pick: { min: 2, max: 9 },
    fridayMock: false,
    mockMinutes: 180,
    subjects: SENIOR_CORE,
  },
  NECO: {
    label: 'NECO',
    fullName: 'NECO SSCE',
    level: 'SENIOR_SECONDARY',
    compulsory: ['english-language', 'mathematics'],
    pick: { min: 2, max: 9 },
    fridayMock: false,
    mockMinutes: 180,
    subjects: SENIOR_CORE.filter((x) => !['fisheries', 'clothing-and-textiles', 'insurance', 'bookkeeping', 'office-practice', 'marketing'].includes(x.slug)),
  },
  BECE: {
    label: 'BECE',
    fullName: 'BECE (Junior WAEC / NECO)',
    level: 'JUNIOR_SECONDARY',
    compulsory: ['english-language', 'mathematics'],
    pick: { min: 2, max: 11 },
    fridayMock: true,
    mockMinutes: 90,
    subjects: [
      s('english-language', 'English Language', 30),
      s('mathematics', 'Mathematics', 30),
      s('basic-science-and-technology', 'Basic Science and Technology', 30),
      s('national-value-education', 'National Values Education', 30),
      s('pre-vocational-studies', 'Pre-Vocational Studies', 30),
      s('business-studies', 'Business Studies', 30),
      s('cultural-and-creative-arts', 'Cultural and Creative Arts', 30),
      s('christian-religious-studies', 'Christian Religious Studies', 30),
      s('islamic-religion-studies', 'Islamic Religious Studies', 30),
      s('history', 'History', 30),
      s('french', 'French', 30),
    ],
  },
  COMMON_ENTRANCE: {
    label: 'Common Entrance',
    fullName: 'Common Entrance (NCEE and school entrance exams)',
    level: 'PRIMARY',
    compulsory: ['english-language', 'mathematics'],
    pick: { min: 2, max: 6 },
    fridayMock: true,
    mockMinutes: 60, // shorter sitting for 10–11 year olds
    subjects: [
      s('mathematics', 'Mathematics', 20),
      s('english-language', 'English Language', 20),
      s('quantitative-reasoning', 'Quantitative Reasoning', 15),
      s('verbal-reasoning', 'Verbal Reasoning', 15),
      s('basic-science', 'Basic Science', 15),
      s('social-studies', 'Social Studies', 15),
    ],
  },
  PRIMARY: {
    label: 'Class',
    fullName: 'Class practice (Primary 1–5)',
    level: 'PRIMARY',
    compulsory: [],
    pick: { min: 1, max: 3 }, // the child's own class: Mathematics, English, Basic Science
    fridayMock: false,
    mockMinutes: 30,
    subjects: ([1, 2, 3, 4, 5] as const).flatMap((n) => [
      s(`primary-${n}-mathematics`, `Mathematics (Primary ${n})`),
      s(`primary-${n}-english-language`, `English (Primary ${n})`),
      s(`primary-${n}-basic-science`, `Basic Science (Primary ${n})`),
    ]),
  },
  NURSERY: {
    label: 'Class',
    fullName: 'Class practice (Nursery 1–2)',
    level: 'NURSERY',
    compulsory: [],
    pick: { min: 1, max: 3 }, // the child's own class: Numbers, Letters and Sounds, My World
    fridayMock: false,
    mockMinutes: 15,
    subjects: ([1, 2] as const).flatMap((n) => [
      s(`nursery-${n}-numbers`, `Numbers (Nursery ${n})`),
      s(`nursery-${n}-letters-and-sounds`, `Letters and Sounds (Nursery ${n})`),
      s(`nursery-${n}-my-world`, `My World (Nursery ${n})`),
    ]),
  },
};

export const EXAM_BODIES = Object.keys(EXAM_CATALOG) as ExamBody[];
