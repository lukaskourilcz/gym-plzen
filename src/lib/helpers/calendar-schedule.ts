import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
} from "@/lib/config/schedule";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  dayOfWeek,
  minuteOfDay,
} from "./datetime";

type Hours = {
  dayOfWeek: number;
  openMinute: number;
  closeMinute: number;
  isClosed: number;
};
type Window = { startsAt: Date; endsAt: Date };
const endMinuteOfDay = (date: Date) =>
  minuteOfDay(date) +
  (date.getUTCSeconds() || date.getUTCMilliseconds() ? 1 : 0);

export const OUTSIDE_OPENING_HOURS_LABEL = "Rezervace mimo otevírací dobu";

/** Display classification only. Never use current hours to revalidate a sale. */
export function isOutsideOpeningHours(window: Window, hours: Hours[]): boolean {
  const day = hours.find((row) => row.dayOfWeek === dayOfWeek(window.startsAt));
  if (!day || day.isClosed || window.endsAt <= window.startsAt) return true;
  const startDate = dateKeyInTimeZone(window.startsAt);
  const endDate = dateKeyInTimeZone(window.endsAt);
  const endsAtMidnight =
    endDate === addDaysToDateKey(startDate, 1) &&
    endMinuteOfDay(window.endsAt) === 0;
  if (startDate !== endDate && !endsAtMidnight) return true;
  const end = endsAtMidnight ? 1440 : endMinuteOfDay(window.endsAt);
  return minuteOfDay(window.startsAt) < day.openMinute || end > day.closeMinute;
}

/** Include the entire stored interval, even after opening hours were narrowed. */
export function calendarTimeBounds(hours: Hours[], windows: Window[]) {
  const active = hours.filter((day) => !day.isClosed);
  let openMinute = active.length
    ? Math.min(...active.map((d) => d.openMinute))
    : DEFAULT_OPEN_MINUTE;
  let closeMinute = active.length
    ? Math.max(...active.map((d) => d.closeMinute))
    : DEFAULT_CLOSE_MINUTE;
  for (const { startsAt, endsAt } of windows) {
    const startDate = dateKeyInTimeZone(startsAt);
    const endDate = dateKeyInTimeZone(endsAt);
    const end = endMinuteOfDay(endsAt);
    if (
      startDate !== endDate &&
      !(endDate === addDaysToDateKey(startDate, 1) && end === 0)
    ) {
      openMinute = 0;
      closeMinute = 1440;
    } else {
      openMinute = Math.min(openMinute, minuteOfDay(startsAt));
      closeMinute = Math.max(closeMinute, startDate !== endDate ? 1440 : end);
    }
  }
  return { openMinute, closeMinute };
}
