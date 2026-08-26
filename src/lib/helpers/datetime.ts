/**
 * Date/time helpers for the booking calendar. All persisted timestamps are
 * timezone-aware (UTC in the DB); these helpers deal in absolute `Date`s and
 * minute-of-day offsets. Display formatting lives in ./format.ts.
 */

const MINUTE_MS = 60_000;
const PRAGUE_TIME_ZONE = "Europe/Prague";
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

/** Calendar date (`YYYY-MM-DD`) as observed in an IANA timezone. */
export function dateKeyInTimeZone(
  date: Date,
  timeZone = PRAGUE_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Strictly validate that a date key represents a real Gregorian date. */
export function isDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month! - 1 &&
    check.getUTCDate() === day
  );
}

/** Date-key arithmetic without depending on the machine timezone. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  if (!isDateKey(dateKey)) throw new Error("Invalid date key.");
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year!, month! - 1, day! + days, 12));
  return value.toISOString().slice(0, 10);
}

/** Convert a Prague wall-clock date and minute-of-day to an absolute instant. */
export function localDateTimeToDate(
  dateKey: string,
  minute: number,
  timeZone = PRAGUE_TIME_ZONE,
): Date {
  if (
    !isDateKey(dateKey) ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute >= 1440
  ) {
    throw new Error("Invalid local date or time.");
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const hour = Math.floor(minute / 60);
  const minutePart = minute % 60;
  const wantedUtc = Date.UTC(year!, month! - 1, day!, hour, minutePart);
  let instant = new Date(wantedUtc);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rendered = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(instant);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(rendered.find((item) => item.type === type)?.value ?? 0);
    const renderedUtc = Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour") % 24,
      part("minute"),
    );
    const delta = wantedUtc - renderedUtc;
    if (delta === 0) return instant;
    instant = new Date(instant.getTime() + delta);
  }

  if (
    dateKeyInTimeZone(instant, timeZone) !== dateKey ||
    minuteOfDay(instant, timeZone) !== minute
  ) {
    throw new Error("Local time does not exist in the selected timezone.");
  }
  return instant;
}

export interface MonthGridDay {
  dateKey: string;
  inMonth: boolean;
}

/** Monday-first six-week grid for an ISO month (`YYYY-MM`). */
export function monthGrid(monthKey: string): MonthGridDay[] {
  if (!/^\d{4}-\d{2}$/.test(monthKey) || !isDateKey(`${monthKey}-01`)) {
    throw new Error("Invalid month key.");
  }
  const [year, month] = monthKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, 1)).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const gridStart = addDaysToDateKey(`${monthKey}-01`, mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const dateKey = addDaysToDateKey(gridStart, index);
    return { dateKey, inMonth: dateKey.startsWith(monthKey) };
  });
}
