/** Nigeria is UTC+1 all year (no daylight saving). Weeks run Monday–Sunday, Lagos time. */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** Start of the Lagos calendar day for `date`, as a UTC Date at 00:00 (for @db.Date columns). */
export function lagosDay(date = new Date()): Date {
  const local = new Date(date.getTime() + LAGOS_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** Monday of the Lagos week containing `date`, as a @db.Date value. */
export function weekStart(date = new Date()): Date {
  const day = lagosDay(date);
  const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(day.getTime() - dow * 86_400_000);
}

/** The real instant (UTC) when a Lagos-local date begins. */
export const lagosMidnightInstant = (dbDate: Date) => new Date(dbDate.getTime() - LAGOS_OFFSET_MS);

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export function weekLabel(start: Date) {
  const end = addDays(start, 4);
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', ...(withMonth ? { month: 'long' } : {}), timeZone: 'UTC' });
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  return `${fmt(start, !sameMonth)} – ${fmt(end, true)}`;
}

/** "Sat 14 Mar, 4:00 pm" in Lagos time, for messages. */
export const lagosTime = (d: Date) =>
  d.toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
