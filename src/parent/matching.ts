import type { TeachingMode, TutorProfile, TutorRequest, TutorSubject, User } from '@prisma/client';

import { applyBp } from '../common/money.js';

type Candidate = TutorProfile & { user: User; subjects: TutorSubject[] };

/** Scores a tutor against a parent's request. Returns null when they can't serve it at all. */
export function scoreMatch(req: TutorRequest, t: Candidate, platformFeeBp: number) {
  const subject = t.subjects.find((s) => s.subject === req.subject && s.level === req.level && s.approvedAt);
  if (!subject) return null;

  const modes: TeachingMode[] = req.mode === 'BOTH' ? ['IN_PERSON', 'ONLINE'] : [req.mode];
  const tutorModes: TeachingMode[] = t.mode === 'BOTH' ? ['IN_PERSON', 'ONLINE'] : [t.mode];
  const shared = modes.filter((m) => tutorModes.includes(m));
  if (!shared.length) return null;
  const inPersonOnly = shared.length === 1 && shared[0] === 'IN_PERSON';
  if (inPersonOnly && req.state && t.state && req.state.toLowerCase() !== t.state.toLowerCase()) return null;

  const reasons: string[] = [];
  const test = subject.testScore ?? 0.7;
  reasons.push(`Scored ${Math.round(test * 100)}% on our ${req.subject} test`);

  let location = 0.7;
  if (shared.includes('ONLINE') && !shared.includes('IN_PERSON')) location = 1;
  else if (req.lga && t.lga && req.lga.toLowerCase() === t.lga.toLowerCase()) {
    location = 1;
    reasons.push(`Teaches in ${t.lga}`);
  } else if (req.state && t.state && req.state.toLowerCase() === t.state.toLowerCase()) location = 0.6;

  const parentPrice = t.rateKobo + applyBp(t.rateKobo, platformFeeBp);
  let budget = 0.7;
  if (req.budgetMaxKobo) {
    budget = parentPrice <= req.budgetMaxKobo ? 1 : Math.max(0, 1 - Number(parentPrice - req.budgetMaxKobo) / Number(req.budgetMaxKobo));
    if (parentPrice <= req.budgetMaxKobo) reasons.push('Within your budget');
  }
  const rating = t.ratingCount ? t.ratingAvg / 5 : 0.6;
  if (t.ratingCount >= 3) reasons.push(`Rated ${t.ratingAvg.toFixed(1)} by parents`);

  const score = 0.35 * test + 0.2 * 1 + 0.2 * location + 0.15 * budget + 0.1 * rating;
  return { score: Math.round(score * 100) / 100, reasons, testScore: test, parentPrice, mode: shared.length === 2 ? 'BOTH' : shared[0] };
}
