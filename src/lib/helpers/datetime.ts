/**
 * Date/time helpers for the booking calendar. All persisted timestamps are
 * timezone-aware (UTC in the DB); these helpers deal in absolute `Date`s and
 * minute-of-day offsets. Display formatting lives in ./format.ts.
 */

export const MINUTE_MS = 60_000;
export const PRAGUE_TIME_ZONE = "Europe/Prague";
export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

/** Difference in whole calendar days between date keys. */
export function daysBetweenDateKeys(start: string, end: string): number {
  if (!isDateKey(start) || !isDateKey(end))
    throw new Error("Invalid date key.");
  const toUtc = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year!, month! - 1, day!);
  };
  return Math.round((toUtc(end) - toUtc(start)) / (24 * 60 * MINUTE_MS));
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

/** True when `date` is strictly in the future relative to now. */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Convert a `datetime-local` input value ("2026-10-01T00:00") to the instant it
 * names in the gym's timezone. The input element carries no zone, so without
 * this an administrator in another country would set a different moment than
 * the one they typed.
 */
export function localInputToInstant(
  value: string,
  timeZone = PRAGUE_TIME_ZONE,
): Date {
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(
    value.trim(),
  );
  if (!match) throw new Error("Invalid local date-time value.");
  const [, dateKey, hours, minutes] = match;
  return localDateTimeToDate(
    dateKey!,
    Number(hours) * 60 + Number(minutes),
    timeZone,
  );
}

/** Admin inputs use Prague wall time; calendar selections already carry a zone. */
export function adminDateTimeToInstant(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    return localInputToInstant(value);
  if (
    !isDateKey(value.slice(0, 10)) ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    )
  )
    throw new Error("Invalid date-time zone.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid date-time.");
  return date;
}

/** The inverse, for pre-filling a `datetime-local` input from a stored instant. */
export function instantToLocalInput(
  date: Date,
  timeZone = PRAGUE_TIME_ZONE,
): string {
  const minute = minuteOfDay(date, timeZone);
  const hh = String(Math.floor(minute / 60)).padStart(2, "0");
  const mm = String(minute % 60).padStart(2, "0");
  return `${dateKeyInTimeZone(date, timeZone)}T${hh}:${mm}`;
}
