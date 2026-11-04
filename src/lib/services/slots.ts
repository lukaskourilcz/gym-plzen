import { or, and, eq, gt, inArray, lt } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { readDatabase } from "@/lib/db/read";
import { blockedSlot, reservation } from "@/lib/db/schema";
import {
  addDaysToDateKey,
  addMinutes,
  dateKeyInTimeZone,
  dayOfWeek,
  intervalsOverlap,
  localDateTimeToDate,
  minuteOfDay,
  minutesBetween,
} from "@/lib/helpers/datetime";
import { logger } from "@/lib/helpers/logger";
import { isBookingPreviewEnabled } from "@/lib/config/preview";
import {
  BOOKING_HORIZON_SETTING_KEY,
  clampBookingHorizonDays,
  DEFAULT_BOOKING_HORIZON_DAYS,
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
  DEFAULT_SLOT_MINUTES,
} from "@/lib/config/schedule";
import { getSetting } from "./cms";
import { getOperations } from "./operations";
import { isDateOpenForBooking } from "@/lib/config/operations";
import { reservationOverlaps } from "./availability";
import type { PricingHours } from "@/lib/config/block-pricing";
import {
  plannedScheduleForDate,
  plannedWindowAt,
  plannedWindowTimes,
  type PlannedSchedule,
} from "@/lib/config/planned-schedules";
import { loadBookingSchedule } from "./planned-schedules";

export interface Slot {
  start: Date;
  end: Date;
  available: boolean;
  /** Taken by a reservation or an admin block (distinct from merely being in the past). */
  booked: boolean;
}

export interface DaySlots {
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

/**
 * Read the configured booking horizon, falling back to the default when the
 * setting is missing or unusable.
 */
export async function getBookingHorizonDays(): Promise<number> {
  try {
    const stored = await getSetting<number>(BOOKING_HORIZON_SETTING_KEY);
    return typeof stored === "number"
      ? clampBookingHorizonDays(stored)
      : DEFAULT_BOOKING_HORIZON_DAYS;
  } catch (e) {
    // The booking page must still render on a deploy without a database, the
    // same way site content falls back to its defaults.
    logger.warn("getBookingHorizonDays: default (DB unavailable)", {
      error: String(e),
    });
    return DEFAULT_BOOKING_HORIZON_DAYS;
  }
}

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

export function buildConfiguredDay(
  dateKey: string,
  weekly: readonly PricingHours[],
  planned: readonly PlannedSchedule[],
  busy: { start: Date; end: Date }[],
  now: Date,
): DaySlots {
  const schedule = plannedScheduleForDate(planned, dateKey);
  if (schedule) {
    const slots = schedule.windows.flatMap((window): Slot[] => {
      const times = plannedWindowTimes(dateKey, window);
      if (!times) return [];
      const { startsAt: start, endsAt: end } = times;
      const booked = busy.some((item) =>
        intervalsOverlap(start, end, item.start, item.end),
      );
      return [{ start, end, booked, available: start > now && !booked }];
    });
    return { dateKey, slots, isClosed: slots.length === 0 };
  }
  const weekday = dayOfWeek(localDateTimeToDate(dateKey, 720));
  const hours = weekly.find((row) => row.dayOfWeek === weekday);
  return {
    dateKey,
    isClosed: !hours || hours.isClosed === 1,
    slots: hours
      ? buildDaySlots(
          dateKey,
          { ...hours, isClosed: hours.isClosed === 1 },
          busy,
          now,
        )
      : [],
  };
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
    const operations = await getOperations();
    const [{ weekly, planned }, reservations, blocks] = await readDatabase(
      async (db) =>
        Promise.all([
          loadBookingSchedule(db),
          db
            .select({
              startsAt: reservation.startsAt,
              endsAt: reservation.endsAt,
              rescheduleStartsAt: reservation.rescheduleStartsAt,
              rescheduleEndsAt: reservation.rescheduleEndsAt,
            })
            .from(reservation)
            .where(
              and(
                reservationOverlaps(rangeStart, rangeEnd),
                or(
                  inArray(reservation.status, ["pending", "confirmed"]),
                  eq(reservation.accessRevocationPending, true),
                ),
              ),
            ),
          db
            .select({
              startsAt: blockedSlot.startsAt,
              endsAt: blockedSlot.endsAt,
            })
            .from(blockedSlot)
            .where(
              and(
                lt(blockedSlot.startsAt, rangeEnd),
                gt(blockedSlot.endsAt, rangeStart),
              ),
            ),
        ]),
    );

    const pendingWindows = reservations.flatMap((item) =>
      item.rescheduleStartsAt && item.rescheduleEndsAt
        ? [{ startsAt: item.rescheduleStartsAt, endsAt: item.rescheduleEndsAt }]
        : [],
    );
    const busy = [...reservations, ...pendingWindows, ...blocks].map(
      (item) => ({
        start: item.startsAt,
        end: item.endsAt,
      }),
    );

    const days: DaySlots[] = [];
    for (
      let dateKey = startDateKey;
      dateKey < endDateKeyExclusive;
      dateKey = addDaysToDateKey(dateKey, 1)
    ) {
      days.push(
        isDateOpenForBooking(dateKey, operations)
          ? buildConfiguredDay(dateKey, weekly, planned, busy, now)
          : { dateKey, isClosed: true, slots: [] },
      );
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
  if (!isDateOpenForBooking(dateKeyInTimeZone(startsAt), await getOperations()))
    return null;
  return resolveConfiguredSlot(startsAt);
}

export function resolveConfiguredSlotFromSchedule(
  startsAt: Date,
  weekly: readonly PricingHours[],
  planned: readonly PlannedSchedule[],
) {
  const schedule = plannedScheduleForDate(planned, dateKeyInTimeZone(startsAt));
  if (schedule) {
    const window = plannedWindowAt(schedule, startsAt);
    return (
      window && {
        startsAt,
        endsAt: window.endsAt,
        durationMinutes: minutesBetween(startsAt, window.endsAt),
      }
    );
  }
  const hours = weekly.find((row) => row.dayOfWeek === dayOfWeek(startsAt));
  return hours
    ? resolveSlotFromHours(startsAt, {
        ...hours,
        isClosed: hours.isClosed === 1,
      })
    : null;
}

/** Read one configuration for a selection spanning several days. */
export async function resolveBookableSlots(starts: Date[]) {
  if (starts.length === 0) return [];
  const [operations, { weekly, planned }] = await Promise.all([
    getOperations(),
    readDatabase(loadBookingSchedule),
  ]);
  return starts.map((startsAt) =>
    isDateOpenForBooking(dateKeyInTimeZone(startsAt), operations)
      ? resolveConfiguredSlotFromSchedule(startsAt, weekly, planned)
      : null,
  );
}

/** The configured window, ignoring the public "bookings from" date. */
export async function resolveConfiguredSlot(
  startsAt: Date,
  executor: DatabaseExecutor = db,
) {
  const { weekly, planned } = await loadBookingSchedule(executor);
  return resolveConfiguredSlotFromSchedule(startsAt, weekly, planned);
}

/**
 * Pure horizon check. The horizon is passed in rather than read here so the
 * rule stays synchronous and testable; callers resolve it once per request.
 */
export function isWithinBookingHorizon(
  dateKey: string,
  now = new Date(),
  horizonDays = DEFAULT_BOOKING_HORIZON_DAYS,
): boolean {
  const today = dateKeyInTimeZone(now);
  return dateKey >= today && dateKey <= addDaysToDateKey(today, horizonDays);
}
