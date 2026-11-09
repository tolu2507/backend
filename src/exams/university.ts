/**
 * University departments and the courses each level and semester registers.
 * Each course is an ExamSubject under the UNIVERSITY exam (slug "psy-316"); its units are SyllabusTopics,
 * written by scripts/university/build.ts from the course manual.
 *
 * To add a department or a semester: add it here, drop the course manuals (PDF) in
 * backend/data/university/pdfs/<slug>.pdf and run the build script.
 */
export type UniCourse = { slug: string; title: string };
export type UniSemester = { level: number; semester: 1 | 2; courses: string[] };
export type UniDepartment = { slug: string; name: string; faculty: string; semesters: UniSemester[] };

export const UNI_COURSES: UniCourse[] = [
  { slug: 'pos-314', title: 'Introduction to International Relations Theory' },
  { slug: 'psy-310', title: 'Physiological Psychology II' },
  { slug: 'psy-316', title: 'Human Memory' },
  { slug: 'psy-318', title: 'Child Psychopathology' },
  { slug: 'psy-387', title: 'Social Psychology of Race and Ethnic Group Relations' },
  { slug: 'soc-314', title: 'Contemporary Social Problems' },
];

export const UNI_DEPARTMENTS: UniDepartment[] = [
  {
    slug: 'psychology',
    name: 'Psychology',
    faculty: 'Social Sciences',
    semesters: [{ level: 300, semester: 2, courses: ['pos-314', 'psy-310', 'psy-316', 'psy-318', 'psy-387', 'soc-314'] }],
  },
];

/** "psy-316" → "PSY 316" */
export const courseCode = (slug: string) => slug.replace('-', ' ').toUpperCase();

export const uniDepartment = (slug: string | null | undefined) => UNI_DEPARTMENTS.find((d) => d.slug === slug) ?? null;
