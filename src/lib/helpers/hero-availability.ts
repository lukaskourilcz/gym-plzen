import { firstBookableDateKey } from "../config/booking-start";
import { HERO_HORIZON_DAYS, HERO_INITIAL_DAYS } from "../config/hero";
import { addDaysToDateKey, dateKeyInTimeZone } from "./datetime";

export function isHeroDateAllowed(date: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date &&
    date >= firstBookableDateKey(now) &&
    date <= addDaysToDateKey(dateKeyInTimeZone(now), HERO_HORIZON_DAYS)
  );
}

/** Fetch the selection first, then four dates ahead after navigation starts. */
export function heroDatesToLoad(
  selectedDate: string,
  endDate: string,
  navigated: boolean,
): string[] {
  return Array.from({ length: navigated ? 5 : 1 }, (_, offset) =>
    addDaysToDateKey(selectedDate, offset),
  ).filter((date) => date <= endDate);
}

/** Keep the initial four dates, two behind and four ahead (at most 11). */
export function pruneHeroAvailabilityCache<T>(
  cache: Record<string, T>,
  startDate: string,
  selectedDate: string,
): Record<string, T> {
  const initialEnd = addDaysToDateKey(startDate, HERO_INITIAL_DAYS);
  const nearbyStart = addDaysToDateKey(selectedDate, -2);
  const nearbyEnd = addDaysToDateKey(selectedDate, 4);
  const entries = Object.entries(cache);
  const retained = entries.filter(
    ([date]) =>
      (date >= startDate && date < initialEnd) ||
      (date >= nearbyStart && date <= nearbyEnd),
  );
  return retained.length === entries.length
    ? cache
    : Object.fromEntries(retained);
}
