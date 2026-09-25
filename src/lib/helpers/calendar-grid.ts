import { DEFAULT_SLOT_MINUTES } from "@/lib/config/schedule";

/** Use booking windows when aligned; bound mixed schedules to a readable grid. */
export function calendarRowMinutes(
  days: { openMinute: number; slotMinutes: number }[],
  gridStart: number,
): number {
  if (!days.length) return DEFAULT_SLOT_MINUTES;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const alignedStep = days.reduce(
    (step, day) =>
      gcd(gcd(step, day.slotMinutes), Math.abs(day.openMinute - gridStart)),
    days[0]!.slotMinutes,
  );
  // Arbitrary opening minutes must not create thousands of full-height rows.
  // FullCalendar still positions events at their exact time within the row.
  return Math.max(15, alignedStep);
}
