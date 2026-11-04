import { and, eq, gt, inArray, lt, or } from "drizzle-orm";
import { readDatabase } from "@/lib/db/read";
import {
  blockedSlot,
  openingHours,
  pricingPeriod,
  reservation,
  siteSetting,
} from "@/lib/db/schema";
import {
  calendarLocation,
  type CalendarView,
} from "@/lib/config/booking-calendar";
import {
  BOOKING_HORIZON_SETTING_KEY,
  clampBookingHorizonDays,
  DEFAULT_BOOKING_HORIZON_DAYS,
} from "@/lib/config/schedule";
import {
  DEFAULT_OPERATIONS,
  OPERATIONS_SETTING_KEY,
  operationsSchema,
  isDateOpenForBooking,
} from "@/lib/config/operations";
import {
  BLOCK_PRICING_KEY,
  parseBlockPrices,
  type PricingHours,
} from "@/lib/config/block-pricing";
import {
  DEFAULT_ENTRY_PRICE_CENTS,
  ENTRY_PRICE_SETTING_KEY,
  resolveEntryPrice,
  type PricingWindow,
} from "@/lib/config/pricing";
import {
  PARTICIPANTS_ENABLED_KEY,
  PARTICIPANT_PRICING_KEY,
} from "@/lib/config/participants";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
  minutesBetween,
} from "@/lib/helpers/datetime";
import { formatTimeRange } from "@/lib/helpers/format";
import {
  buildConfiguredDay,
  resolveConfiguredSlotFromSchedule,
  type DaySlots,
} from "./slots";
import {
  parsePlannedSchedules,
  PLANNED_SCHEDULES_KEY,
} from "@/lib/config/planned-schedules";
import { reservationOverlaps } from "./availability";

export const BOOKING_PUBLIC_SETTING_KEYS = [
  BOOKING_HORIZON_SETTING_KEY,
  OPERATIONS_SETTING_KEY,
  BLOCK_PRICING_KEY,
  PLANNED_SCHEDULES_KEY,
  ENTRY_PRICE_SETTING_KEY,
  PARTICIPANTS_ENABLED_KEY,
  PARTICIPANT_PRICING_KEY,
];
export interface BookingPricingSnapshot {
  settings: { key: string; value: unknown }[];
  hours: PricingHours[];
  periods: (PricingWindow & { name: string })[];
}

/** One bounded read-only snapshot, independent of CMS, authentication and provider work. */
export async function loadCalendarAvailability(
  input: { date?: string | null; month?: string | null },
  now = new Date(),
  dayOnly?: string,
) {
  return readDatabase(async (tx) => {
    const [settings, hours, periods] = await Promise.all([
      tx
        .select({ key: siteSetting.key, value: siteSetting.value })
        .from(siteSetting)
        .where(inArray(siteSetting.key, BOOKING_PUBLIC_SETTING_KEYS)),
      tx.select().from(openingHours),
      tx
        .select({
          name: pricingPeriod.name,
          priceCents: pricingPeriod.priceCents,
          startsAt: pricingPeriod.startsAt,
          endsAt: pricingPeriod.endsAt,
        })
        .from(pricingPeriod),
    ]);
    const stored = new Map(settings.map((row) => [row.key, row.value]));
    const horizon = stored.get(BOOKING_HORIZON_SETTING_KEY);
    const location = calendarLocation(
      input,
      typeof horizon === "number"
        ? clampBookingHorizonDays(horizon)
        : DEFAULT_BOOKING_HORIZON_DAYS,
      now,
    );
    const rangeStart = dayOnly ?? location.rangeStart,
      rangeEnd = dayOnly ? addDaysToDateKey(dayOnly, 1) : location.rangeEnd;
    const a = localDateTimeToDate(rangeStart, 0),
      b = localDateTimeToDate(rangeEnd, 0);
    const [bookings, blocks] = await Promise.all([
      tx
        .select({
          startsAt: reservation.startsAt,
          endsAt: reservation.endsAt,
          rescheduleStartsAt: reservation.rescheduleStartsAt,
          rescheduleEndsAt: reservation.rescheduleEndsAt,
        })
        .from(reservation)
        .where(
          and(
            reservationOverlaps(a, b),
            or(
              inArray(reservation.status, ["pending", "confirmed"]),
              eq(reservation.accessRevocationPending, true),
            ),
          ),
        ),
      tx
        .select({ startsAt: blockedSlot.startsAt, endsAt: blockedSlot.endsAt })
        .from(blockedSlot)
        .where(and(lt(blockedSlot.startsAt, b), gt(blockedSlot.endsAt, a))),
    ]);
    const ops = operationsSchema.safeParse(stored.get(OPERATIONS_SETTING_KEY));
    const operations = ops.success ? ops.data : DEFAULT_OPERATIONS;
    const planned = parsePlannedSchedules(stored.get(PLANNED_SCHEDULES_KEY));
    const rules = parseBlockPrices(stored.get(BLOCK_PRICING_KEY));
    const standard = stored.get(ENTRY_PRICE_SETTING_KEY);
    const priceForDate = (at: Date) =>
      resolveEntryPrice({
        standardPriceCents:
          typeof standard === "number" ? standard : DEFAULT_ENTRY_PRICE_CENTS,
        periods,
        blockPrices: rules,
        hours,
        planned,
        at,
      }).priceCents;
    const busy = [
      ...bookings,
      ...blocks,
      ...bookings.flatMap((row) =>
        row.rescheduleStartsAt && row.rescheduleEndsAt
          ? [{ startsAt: row.rescheduleStartsAt, endsAt: row.rescheduleEndsAt }]
          : [],
      ),
    ].map((row) => ({ start: row.startsAt, end: row.endsAt }));
    const days: DaySlots[] = [];
    for (let key = rangeStart; key < rangeEnd; key = addDaysToDateKey(key, 1)) {
      days.push(
        isDateOpenForBooking(key, operations)
          ? buildConfiguredDay(key, hours, planned, busy, now)
          : { dateKey: key, isClosed: true, slots: [] },
      );
    }
    const selected = days.find(
      (day) => day.dateKey === location.selectedDateKey,
    );
    const view: CalendarView = {
      monthKey: location.monthKey,
      selectedDateKey: location.selectedDateKey,
      todayKey: location.todayKey,
      minDateKey: location.minDateKey,
      maxDateKey: location.maxDateKey,
      horizonDays: location.horizonDays,
      source: "live",
      days: days.map((day) => ({
        dateKey: day.dateKey,
        isClosed: day.isClosed,
        hasAvailability: day.slots.some((slot) => slot.available),
      })),
      selectedSlots: (selected?.slots ?? [])
        .filter((slot) => slot.start > now)
        .map((slot) => ({
          startISO: slot.start.toISOString(),
          label: formatTimeRange(slot.start, slot.end),
          durationMinutes: minutesBetween(slot.start, slot.end),
          priceCents: priceForDate(slot.start),
          booked: slot.booked,
        })),
    };
    return {
      view,
      days,
      pricing: { settings, hours, periods } satisfies BookingPricingSnapshot,
      priceForDate,
      resolveSelection: (start: Date) =>
        isDateOpenForBooking(dateKeyInTimeZone(start), operations)
          ? resolveConfiguredSlotFromSchedule(start, hours, planned)
          : null,
    };
  });
}
