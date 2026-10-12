import type { EducationLevel } from '@prisma/client';

/** Canonical subject names. Tutors, parents and content all use these, so matching is exact. */
export const SUBJECTS: Record<Exclude<EducationLevel, 'NURSERY'>, string[]> = {
  PRIMARY: ['Mathematics', 'English Language', 'Basic Science', 'Verbal Reasoning', 'Quantitative Reasoning'],
  JUNIOR_SECONDARY: ['Mathematics', 'English Language', 'Basic Science', 'Basic Technology', 'Business Studies'],
  SENIOR_SECONDARY: ['Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Further Mathematics', 'Literature in English'],
};

export const LEVEL_LABEL: Record<EducationLevel, string> = {
  NURSERY: 'Nursery',
  PRIMARY: 'Primary',
  JUNIOR_SECONDARY: 'Junior Secondary',
  SENIOR_SECONDARY: 'Senior Secondary',
};

export const GRADES: Record<EducationLevel, string[]> = {
  NURSERY: ['Nursery 1', 'Nursery 2'],
  PRIMARY: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
  JUNIOR_SECONDARY: ['JSS1', 'JSS2', 'JSS3'],
  SENIOR_SECONDARY: ['SS1', 'SS2', 'SS3'],
};

export const EXAMS = ['Common Entrance', 'BECE', 'WAEC', 'NECO', 'JAMB'];

export type QuestIcon = 'math' | 'science' | 'book' | 'globe' | 'art' | 'words';
export type QuestTone = 'violet' | 'mint' | 'coral' | 'sky' | 'sun';

/** How each subject looks in the student app. */
export function subjectStyle(subject: string): { icon: QuestIcon; tone: QuestTone } {
  const s = subject.toLowerCase();
  if (s.includes('math') || s.includes('quantitative')) return { icon: 'math', tone: 'violet' };
  if (s.includes('chem') || s.includes('physics') || s.includes('science') || s.includes('tech')) return { icon: 'science', tone: 'mint' };
  if (s.includes('biology')) return { icon: 'globe', tone: 'sky' };
  if (s.includes('literature')) return { icon: 'book', tone: 'coral' };
  if (s.includes('english') || s.includes('verbal')) return { icon: 'words', tone: 'coral' };
  return { icon: 'art', tone: 'sun' };
}

export const isSubject = (subject: string, level: EducationLevel) =>
  level !== 'NURSERY' && SUBJECTS[level].includes(subject);
