import { and, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { blockedSlot, openingHours, reservation } from "@/lib/db/schema";
import { addMinutes, dayOfWeek, intervalsOverlap } from "@/lib/helpers/datetime";
import { logger } from "@/lib/helpers/logger";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
  DEFAULT_SLOT_MINUTES,
} from "@/lib/config/schedule";

/**
 * Slot generation for the public booking calendar. Produces a week of bookable
 * slots from the opening hours, marking each as available/unavailable against
 * existing reservations and blocks.
 *
 * Resilient by design: if the database is not yet provisioned it falls back to
 * default opening hours with everything free, so the booking page still renders
 * on a fresh deploy (`source: "demo"`).
 */

export interface Slot {
  start: Date;
  end: Date;
  available: boolean;
}

export interface DaySlots {
  date: Date;
  slots: Slot[];
}

export interface WeekSlots {
  days: DaySlots[];
  source: "live" | "demo";
}

interface DayHours {
  openMinute: number;
  closeMinute: number;
  slotMinutes: number;
  isClosed: boolean;
}

// Fallback week: open every day 06:00–22:00 with 1-hour slots (mirrors the seed
// and src/lib/config/schedule.ts). Used only until the DB has opening hours.
const DEFAULT_DAY: DayHours = {
  openMinute: DEFAULT_OPEN_MINUTE,
  closeMinute: DEFAULT_CLOSE_MINUTE,
  slotMinutes: DEFAULT_SLOT_MINUTES,
  isClosed: false,
};
const DEFAULT_HOURS: Record<number, DayHours> = {
  0: DEFAULT_DAY,
  1: DEFAULT_DAY,
  2: DEFAULT_DAY,
  3: DEFAULT_DAY,
  4: DEFAULT_DAY,
  5: DEFAULT_DAY,
  6: DEFAULT_DAY,
};

/** Midnight (local-ish) for a date. */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildDaySlots(
  day: Date,
  hours: DayHours,
  busy: { start: Date; end: Date }[],
  now: Date,
): Slot[] {
  if (hours.isClosed || hours.closeMinute <= hours.openMinute) return [];
  const slots: Slot[] = [];
  const base = startOfDay(day);
  for (let m = hours.openMinute; m + hours.slotMinutes <= hours.closeMinute; m += hours.slotMinutes) {
    const start = addMinutes(base, m);
    const end = addMinutes(start, hours.slotMinutes);
    const inPast = end.getTime() <= now.getTime();
    const clash = busy.some((b) => intervalsOverlap(start, end, b.start, b.end));
    slots.push({ start, end, available: !inPast && !clash });
  }
  return slots;
}

/**
 * Get one week of slots starting at `weekStart` (7 days). `now` defaults to the
 * current time and is injectable for testing/determinism.
 */
export async function getWeekSlots(weekStart: Date, now: Date = new Date()): Promise<WeekSlots> {
  const start = startOfDay(weekStart);
  const end = addMinutes(start, 7 * 24 * 60);

  let hoursByDow: Record<number, DayHours> = DEFAULT_HOURS;
  let busy: { start: Date; end: Date }[] = [];
  let source: "live" | "demo" = "demo";

  try {
    const hoursRows = await db.select().from(openingHours);
    if (hoursRows.length > 0) {
      hoursByDow = {};
      for (const h of hoursRows) {
        hoursByDow[h.dayOfWeek] = {
          openMinute: h.openMinute,
          closeMinute: h.closeMinute,
          slotMinutes: h.slotMinutes,
          isClosed: h.isClosed === 1,
        };
      }
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
    logger.warn("getWeekSlots: demo mode (DB unavailable)", { error: String(e) });
  }

  const days: DaySlots[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addMinutes(start, i * 24 * 60);
    const hours = hoursByDow[dayOfWeek(date)] ?? { openMinute: 0, closeMinute: 0, slotMinutes: 60, isClosed: true };
    days.push({ date, slots: buildDaySlots(date, hours, busy, now) });
  }

  return { days, source };
}

/** Monday of the week containing `date` (weeks start Monday for the UI). */
export function mondayOf(date: Date): Date {
  const d = startOfDay(date);
  const dow = dayOfWeek(d); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  return addMinutes(d, diff * 24 * 60);
}
