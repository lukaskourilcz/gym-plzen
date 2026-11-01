import {
  pricingSlots,
  type BlockPrice,
  type PricingHours,
} from "./block-pricing";
import { firstBookableDateKey } from "./booking-start";
import { resolveEntryPrice, type PricingWindow } from "./pricing";
import { clampBookingHorizonDays } from "./schedule";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  dayOfWeek,
  localDateTimeToDate,
} from "@/lib/helpers/datetime";

/**
 * Advertised “from” price for the configured schedule, not a customer quote.
 * Uses the same period → block → fallback rule as checkout. Occupancy and
 * individual loyalty rewards do not change the advertised price list.
 */
export function minimumScheduledEntryPrice(params: {
  standardPriceCents: number;
  blockPrices: readonly BlockPrice[];
  hours: readonly PricingHours[];
  periods: readonly PricingWindow[];
  now: Date;
  horizonDays: number;
  bookingsFrom: string;
}): number {
  const { now } = params;
  const firstDate = [firstBookableDateKey(now), params.bookingsFrom]
    .sort()
    .at(-1)!;
  const lastDate = addDaysToDateKey(
    dateKeyInTimeZone(now),
    clampBookingHorizonDays(params.horizonDays),
  );
  const end = localDateTimeToDate(addDaysToDateKey(lastDate, 1), 0);

  // Between period boundaries prices repeat weekly. Check eight date keys
  // per segment: a partial first day must not hide that weekday next week.
  // This avoids scanning hundreds of days or adding any database reads.
  const boundaries = new Set([now.getTime(), end.getTime()]);
  for (const period of params.periods) {
    if (
      period.priceCents <= 0 ||
      period.endsAt.getTime() <= period.startsAt.getTime()
    )
      continue;
    for (const boundary of [period.startsAt, period.endsAt])
      if (boundary > now && boundary < end) boundaries.add(boundary.getTime());
  }
  const opening = localDateTimeToDate(firstDate, 0);
  if (opening > now && opening < end) boundaries.add(opening.getTime());
  const ordered = [...boundaries].sort((a, b) => a - b);
  const dates = new Set<string>();
  for (let index = 0; index < ordered.length - 1; index++) {
    const start = dateKeyInTimeZone(new Date(ordered[index]!));
    const stop = dateKeyInTimeZone(new Date(ordered[index + 1]!));
    for (let offset = 0; offset <= 7; offset++) {
      const date = addDaysToDateKey(start, offset);
      if (date > stop || date > lastDate) break;
      if (date >= firstDate) dates.add(date);
    }
  }

  let minimum = Infinity;
  for (const date of dates) {
    const weekday = dayOfWeek(localDateTimeToDate(date, 720));
    const hours = params.hours.find((row) => row.dayOfWeek === weekday);
    if (!hours) continue;
    for (const slot of pricingSlots(hours)) {
      let at: Date;
      try {
        at = localDateTimeToDate(date, slot.startMinute);
      } catch {
        // A nonexistent local time during the spring DST transition.
        continue;
      }
      if (at <= now) continue;
      minimum = Math.min(
        minimum,
        resolveEntryPrice({ ...params, at }).priceCents,
      );
    }
  }
  return Number.isFinite(minimum)
    ? minimum
    : resolveEntryPrice({ ...params, at: now }).priceCents;
}
