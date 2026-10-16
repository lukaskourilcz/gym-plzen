import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  isDateKey,
  monthGrid,
} from "@/lib/helpers/datetime";
import { firstBookableDateKey } from "./booking-start";
export interface CalendarDayView {
  dateKey: string;
  isClosed: boolean;
  hasAvailability: boolean;
}
export interface CalendarSlotView {
  startISO: string;
  label: string;
  durationMinutes: number;
  priceCents: number;
  booked?: boolean;
}
export interface CalendarView {
  monthKey: string;
  selectedDateKey: string | null;
  todayKey: string;
  minDateKey: string;
  maxDateKey: string;
  horizonDays: number;
  days: CalendarDayView[];
  selectedSlots: CalendarSlotView[];
  source: "live" | "preview" | "unavailable";
}
export function calendarLocation(
  input: { month?: string | null; date?: string | null },
  horizonDays: number,
  now: Date,
) {
  const todayKey = dateKeyInTimeZone(now),
    minDateKey = firstBookableDateKey(now),
    maxDateKey = addDaysToDateKey(todayKey, horizonDays);
  const allowed = (value: string) => value >= minDateKey && value <= maxDateKey;
  const requestedDate =
    input.date && isDateKey(input.date) && allowed(input.date)
      ? input.date
      : null;
  const requestedMonth =
    input.month &&
    /^\d{4}-\d{2}$/.test(input.month) &&
    isDateKey(`${input.month}-01`) &&
    input.month >= minDateKey.slice(0, 7) &&
    input.month <= maxDateKey.slice(0, 7)
      ? input.month
      : null;
  const monthKey =
    requestedDate?.slice(0, 7) ?? requestedMonth ?? minDateKey.slice(0, 7);
  const selectedDateKey =
    requestedDate ?? (monthKey === minDateKey.slice(0, 7) ? minDateKey : null);
  const grid = monthGrid(monthKey);
  return {
    monthKey,
    selectedDateKey,
    todayKey,
    minDateKey,
    maxDateKey,
    horizonDays,
    rangeStart: grid[0]!.dateKey,
    rangeEnd: addDaysToDateKey(grid.at(-1)!.dateKey, 1),
  };
}
