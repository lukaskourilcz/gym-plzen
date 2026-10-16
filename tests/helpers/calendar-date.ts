import {
  addDaysToDateKey,
  dateKeyInTimeZone,
} from "../../src/lib/helpers/datetime";
/** Browser flows must still have future slots when checks run after closing. */
export function futureBookingCalendarHref() {
  return `/rezervace?date=${addDaysToDateKey(dateKeyInTimeZone(new Date()), 2)}`;
}
