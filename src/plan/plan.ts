import { addDays } from '../common/dates.js';

/**
 * Two plans. Free: the Friday mock and 10 practice questions a day, no reports, no rewards.
 * Paid: ₦1,500 for 30 days, everything, for all the parent's children. New parents get 21 days of the paid plan free.
 */
export const PLAN_PRICE_KOBO = 150_000n;
export const PLAN_DAYS = 30;
export const TRIAL_DAYS = 21;
export const FREE_DAILY_QUESTIONS = 10;

/** Earn while you learn: coins add up to ₦1,000 of airtime or data for the parent. Only on the trial or paid plan. */
export const COINS_PER_REWARD = 10_000;
export const REWARD_KOBO = 100_000n; // ₦1,000
export const COINS = { correct: 10, mock: 200 }; // per new question right; per Friday mock finished
export const PRACTICE_COINS_PER_DAY = 400;

export type PlanDates = { trialEndsAt: Date | null; paidUntil: Date | null };

/** When the parent's access ends: the later of the trial and what they've paid for. */
export function accessUntil(p: PlanDates): Date | null {
  const ends = [p.trialEndsAt, p.paidUntil].filter((d): d is Date => !!d);
  return ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
}

/** A payment adds 30 days on top of whatever is left, so paying early never loses trial or paid days. */
export function extendedPaidUntil(p: PlanDates, now = new Date()): Date {
  const until = accessUntil(p);
  return addDays(until && until > now ? until : now, PLAN_DAYS);
}
