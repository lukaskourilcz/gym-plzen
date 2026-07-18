/**
 * Date/time helpers for the booking calendar. All persisted timestamps are
 * timezone-aware (UTC in the DB); these helpers deal in absolute `Date`s and
 * minute-of-day offsets. Display formatting lives in ./format.ts.
 */

export const MINUTE_MS = 60_000;

/** Two [start, end) intervals overlap iff aStart < bEnd && bStart < aEnd. */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** Add minutes to a date, returning a new Date. */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

/** Duration between two dates in whole minutes. */
export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MINUTE_MS);
}

/** Minute-of-day (0–1439) for a date in the given IANA timezone. */
export function minuteOfDay(date: Date, timeZone = "Europe/Prague"): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** Day of week (0=Sun…6=Sat) for a date in the given timezone. */
export function dayOfWeek(date: Date, timeZone = "Europe/Prague"): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

/** True when `date` is strictly in the future relative to now. */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}
