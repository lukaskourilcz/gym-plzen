import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { blockedSlot, openingHours, reservation } from "@/lib/db/schema";
import { addMinutes, dayOfWeek, intervalsOverlap, startOfDayTz } from "@/lib/helpers/datetime";
import { logger } from "@/lib/helpers/logger";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
  DEFAULT_SLOT_MINUTES,
} from "@/lib/config/schedule";

/**
 * Slot generation for the public booking calendar. Produces one day of
 * bookable slots from the opening hours, marking each as available or not
 * against existing reservations and blocks (and whether it already passed).
 *
 * Resilient by design: if the database is not yet provisioned it falls back to
 * default opening hours with everything free, so the booking page still renders
 * on a fresh deploy (`source: "demo"`).
 */

export interface Slot {
  start: Date;
  end: Date;
  /** Bookable right now (not past, not taken, not blocked). */
  available: boolean;
  /** The slot's end already passed — hidden on the booking page. */
  inPast: boolean;
}

export interface DaySlots {
  date: Date;
  slots: Slot[];
  source: "live" | "demo";
}

/** How many days ahead a member can browse/book (0 = today). */
export const BOOKING_DAYS_AHEAD = 14;

interface DayHours {
  openMinute: number;
  closeMinute: number;
  slotMinutes: number;
  isClosed: boolean;
}

// Fallback day: open 05:00–21:00 with 1-hour slots (mirrors the seed and
// src/lib/config/schedule.ts). Used only until the DB has opening hours.
const DEFAULT_DAY: DayHours = {
  openMinute: DEFAULT_OPEN_MINUTE,
  closeMinute: DEFAULT_CLOSE_MINUTE,
  slotMinutes: DEFAULT_SLOT_MINUTES,
  isClosed: false,
};

function buildDaySlots(
  dayStart: Date,
  hours: DayHours,
  busy: { start: Date; end: Date }[],
  now: Date,
): Slot[] {
  if (hours.isClosed || hours.closeMinute <= hours.openMinute) return [];
  const slots: Slot[] = [];
  const base = dayStart;
  for (let m = hours.openMinute; m + hours.slotMinutes <= hours.closeMinute; m += hours.slotMinutes) {
    const start = addMinutes(base, m);
    const end = addMinutes(start, hours.slotMinutes);
    const inPast = end.getTime() <= now.getTime();
    const clash = busy.some((b) => intervalsOverlap(start, end, b.start, b.end));
    slots.push({ start, end, inPast, available: !inPast && !clash });
  }
  return slots;
}

/**
 * Get the bookable slots for the single day containing `date` — days and
 * minute-of-day offsets are anchored to the gym's timezone (Europe/Prague),
 * matching the opening-hours check in services/availability.ts. `now` defaults
 * to the current time and is injectable for testing/determinism.
 */
export async function getDaySlots(date: Date, now: Date = new Date()): Promise<DaySlots> {
  const start = startOfDayTz(date);
  const end = addMinutes(start, 24 * 60);

  let hours: DayHours = DEFAULT_DAY;
  let busy: { start: Date; end: Date }[] = [];
  let source: "live" | "demo" = "demo";

  try {
    const [hoursRow] = await db
      .select()
      .from(openingHours)
      .where(eq(openingHours.dayOfWeek, dayOfWeek(start)))
      .limit(1);
    if (hoursRow) {
      hours = {
        openMinute: hoursRow.openMinute,
        closeMinute: hoursRow.closeMinute,
        slotMinutes: hoursRow.slotMinutes,
        isClosed: hoursRow.isClosed === 1,
      };
    }

    const [reservations, blocks] = await Promise.all([
      db
        .select({ startsAt: reservation.startsAt, endsAt: reservation.endsAt })
        .from(reservation)
        .where(
          and(
            gte(reservation.startsAt, start),
            lte(reservation.startsAt, end),
            inArray(reservation.status, ["pending", "confirmed"]),
          ),
        ),
      db
        .select({ startsAt: blockedSlot.startsAt, endsAt: blockedSlot.endsAt })
        .from(blockedSlot)
        .where(and(gte(blockedSlot.startsAt, start), lte(blockedSlot.startsAt, end))),
    ]);
    busy = [...reservations, ...blocks].map((b) => ({ start: b.startsAt, end: b.endsAt }));
    source = "live";
  } catch (e) {
    logger.warn("getDaySlots: demo mode (DB unavailable)", { error: String(e) });
  }

  return { date: start, slots: buildDaySlots(start, hours, busy, now), source };
}
