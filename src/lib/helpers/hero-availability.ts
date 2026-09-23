import { firstBookableDateKey } from "../config/booking-start";
import { HERO_HORIZON_DAYS } from "../config/hero";
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
