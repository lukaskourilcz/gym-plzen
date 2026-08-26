import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { blockedSlot, openingHours, reservation } from "@/lib/db/schema";
import {
  addDaysToDateKey,
  addMinutes,
  dateKeyInTimeZone,
  dayOfWeek,
  intervalsOverlap,
  localDateTimeToDate,
  minuteOfDay,
} from "@/lib/helpers/datetime";
import { logger } from "@/lib/helpers/logger";
import { isBookingPreviewEnabled } from "@/lib/config/preview";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
  DEFAULT_SLOT_MINUTES,
} from "@/lib/config/schedule";
import { releaseExpiredPendingReservations } from "./reservations";

export interface Slot {
  start: Date;
  end: Date;
  available: boolean;
  /** Taken by a reservation or an admin block (distinct from merely being in the past). */
  booked: boolean;
}

interface DaySlots {
  dateKey: string;
  slots: Slot[];
  isClosed: boolean;
}

export interface CalendarSlots {
  days: DaySlots[];
  source: "live" | "preview" | "unavailable";
}

export interface DayHours {
  openMinute: number;
  closeMinute: number;
  slotMinutes: number;
  isClosed: boolean;
}

export const BOOKING_HORIZON_DAYS = 60;

export function buildDaySlots(
  dateKey: string,
  hours: DayHours,
  busy: { start: Date; end: Date }[],
  now: Date,
): Slot[] {
  if (
    hours.isClosed ||
    hours.slotMinutes <= 0 ||
    hours.closeMinute <= hours.openMinute
  ) {
    return [];
  }

  const slots: Slot[] = [];
  for (
    let minute = hours.openMinute;
    minute + hours.slotMinutes <= hours.closeMinute;
    minute += hours.slotMinutes
  ) {
    const start = localDateTimeToDate(dateKey, minute);
    const end = addMinutes(start, hours.slotMinutes);
    const clash = busy.some((item) =>
      intervalsOverlap(start, end, item.start, item.end),
    );
    slots.push({ start, end, available: start > now && !clash, booked: clash });
  }
  return slots;
}

/** Load a visible calendar range without ever substituting fictional slots. */
export async function getSlotsForRange(
  startDateKey: string,
  endDateKeyExclusive: string,
  now: Date = new Date(),
): Promise<CalendarSlots> {
  const rangeStart = localDateTimeToDate(startDateKey, 0);
  const rangeEnd = localDateTimeToDate(endDateKeyExclusive, 0);

  try {
    await releaseExpiredPendingReservations(now);
    const [hoursRows, reservations, blocks] = await Promise.all([
      db.select().from(openingHours),
      db
        .select({ startsAt: reservation.startsAt, endsAt: reservation.endsAt })
        .from(reservation)
        .where(
          and(
            lt(reservation.startsAt, rangeEnd),
            gt(reservation.endsAt, rangeStart),
            inArray(reservation.status, ["pending", "confirmed"]),
          ),
        ),
      db
        .select({ startsAt: blockedSlot.startsAt, endsAt: blockedSlot.endsAt })
        .from(blockedSlot)
        .where(
          and(
            lt(blockedSlot.startsAt, rangeEnd),
            gt(blockedSlot.endsAt, rangeStart),
          ),
        ),
    ]);

    const hoursByDay = new Map<number, DayHours>(
      hoursRows.map((row) => [
        row.dayOfWeek,
        {
          openMinute: row.openMinute,
          closeMinute: row.closeMinute,
          slotMinutes: row.slotMinutes,
          isClosed: row.isClosed === 1,
        },
      ]),
    );
    const busy = [...reservations, ...blocks].map((item) => ({
      start: item.startsAt,
      end: item.endsAt,
    }));

    const days: DaySlots[] = [];
    for (
      let dateKey = startDateKey;
      dateKey < endDateKeyExclusive;
      dateKey = addDaysToDateKey(dateKey, 1)
    ) {
      const midday = localDateTimeToDate(dateKey, 12 * 60);
      const hours = hoursByDay.get(dayOfWeek(midday));
      days.push({
        dateKey,
        isClosed: !hours || hours.isClosed,
        slots: hours ? buildDaySlots(dateKey, hours, busy, now) : [],
      });
    }
    return { days, source: "live" };
  } catch (error) {
    if (isBookingPreviewEnabled()) {
      logger.info("Using explicit local availability preview", {
        range: `${startDateKey}:${endDateKeyExclusive}`,
      });
      const days: DaySlots[] = [];
      const hours: DayHours = {
        openMinute: DEFAULT_OPEN_MINUTE,
        closeMinute: DEFAULT_CLOSE_MINUTE,
        slotMinutes: DEFAULT_SLOT_MINUTES,
        isClosed: false,
      };
      for (
        let dateKey = startDateKey;
        dateKey < endDateKeyExclusive;
        dateKey = addDaysToDateKey(dateKey, 1)
      ) {
        days.push({
          dateKey,
          isClosed: false,
          slots: buildDaySlots(dateKey, hours, [], now),
        });
      }
      return { days, source: "preview" };
    }
    logger.warn("Calendar availability is unavailable", {
      error,
      range: `${startDateKey}:${endDateKeyExclusive}`,
    });
    return { days: [], source: "unavailable" };
  }
}

/** Resolve configured duration and grid alignment on the server. */
export function resolveSlotFromHours(
  startsAt: Date,
  hours: DayHours,
): { startsAt: Date; endsAt: Date; durationMinutes: number } | null {
  if (hours.isClosed || hours.slotMinutes <= 0) return null;
  const startMinute = minuteOfDay(startsAt);
  const aligned =
    startMinute >= hours.openMinute &&
    startMinute + hours.slotMinutes <= hours.closeMinute &&
    (startMinute - hours.openMinute) % hours.slotMinutes === 0;
  if (!aligned) return null;
  return {
    startsAt,
    endsAt: addMinutes(startsAt, hours.slotMinutes),
    durationMinutes: hours.slotMinutes,
  };
}

export async function resolveBookableSlot(startsAt: Date) {
  const [hours] = await db
    .select()
    .from(openingHours)
    .where(eq(openingHours.dayOfWeek, dayOfWeek(startsAt)))
    .limit(1);
  if (!hours) return null;
  return resolveSlotFromHours(startsAt, {
    openMinute: hours.openMinute,
    closeMinute: hours.closeMinute,
    slotMinutes: hours.slotMinutes,
    isClosed: hours.isClosed === 1,
  });
}

export function isWithinBookingHorizon(
  dateKey: string,
  now = new Date(),
): boolean {
  const today = dateKeyInTimeZone(now);
  return (
    dateKey >= today && dateKey <= addDaysToDateKey(today, BOOKING_HORIZON_DAYS)
  );
}
