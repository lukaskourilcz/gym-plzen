import { dateKeyInTimeZone } from "@/lib/helpers/datetime";

export const OPENING_DATE_KEY = "2026-10-01";

/** Show opening day before launch, then follow the current Prague date. */
export function initialBookingDateKey(now: Date): string {
  const today = dateKeyInTimeZone(now);
  return today < OPENING_DATE_KEY ? OPENING_DATE_KEY : today;
}
