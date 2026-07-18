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

/** Minutes east of UTC for `date` in `timeZone` (Prague summer = +120). */
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24, // some ICU versions render midnight as "24"
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - date.getTime()) / MINUTE_MS);
}

/**
 * Midnight of the calendar day containing `date` in `timeZone`, as an absolute
 * instant. Keeps slot generation anchored to the gym's local day regardless of
 * the server's timezone (Vercel runs UTC). Two passes absorb a DST switch.
 */
export function startOfDayTz(date: Date, timeZone = "Europe/Prague"): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const utcMidnight = Date.UTC(get("year"), get("month") - 1, get("day"));
  let ts = utcMidnight;
  for (let i = 0; i < 2; i++) {
    ts = utcMidnight - tzOffsetMinutes(new Date(ts), timeZone) * MINUTE_MS;
  }
  return new Date(ts);
}
