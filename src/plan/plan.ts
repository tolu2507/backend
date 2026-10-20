import { addDays } from '../common/dates.js';

/**
 * Two plans. Free: the Friday mock and a few practice questions a day, no reports, no rewards.
 * Paid: everything, for all the parent's children, with a free trial first. Prices and days are Overwatch settings.
 */
export type PlanDates = { trialEndsAt: Date | null; paidUntil: Date | null };

/** When the parent's access ends: the later of the trial and what they've paid for. */
export function accessUntil(p: PlanDates): Date | null {
  const ends = [p.trialEndsAt, p.paidUntil].filter((d): d is Date => !!d);
  return ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
}

/** A payment adds `days` on top of whatever is left, so paying early never loses trial or paid days. */
export function extendedPaidUntil(p: PlanDates, days: number, now = new Date()): Date {
  const until = accessUntil(p);
  return addDays(until && until > now ? until : now, days);
}
