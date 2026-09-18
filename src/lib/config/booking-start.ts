import { dateKeyInTimeZone } from "@/lib/helpers/datetime";

export const OPENING_DATE_KEY = "2026-10-01";

/**
 * The earliest day a visitor may pick, and therefore the day every calendar
 * opens on: opening day until it arrives, the current Prague date afterwards.
 *
 * Before the gym opens there is nothing to book in the months in between, so
 * this is also the floor for month navigation. A calendar that let a visitor
 * page back to September showed a month of struck-through days and made the
 * opening date look negotiable.
 */
export function firstBookableDateKey(now: Date): string {
  const today = dateKeyInTimeZone(now);
  return today < OPENING_DATE_KEY ? OPENING_DATE_KEY : today;
}
