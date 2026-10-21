import {
  calendarLocation,
  type CalendarView,
} from "@/lib/config/booking-calendar";
import {
  pricingSlots,
  type PricingHours,
  type BlockPrice,
} from "@/lib/config/block-pricing";
import { resolveEntryPrice } from "@/lib/config/pricing";
import type { ParticipantOptions } from "@/lib/config/participants";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  dayOfWeek,
  localDateTimeToDate,
  monthGrid,
} from "./datetime";
import { formatDate, formatTimeRange } from "./format";

export const CUSTOMER_PREVIEW_PATH = "/customer-preview";
export interface CustomerPreviewConfig {
  nowISO: string;
  hours: PricingHours[];
  blockPrices: BlockPrice[];
  periods: { priceCents: number; startsAt: string; endsAt: string }[];
  standardPriceCents: number;
  participants: ParticipantOptions;
  brand: string;
  subtitle: string;
  faq: { question: string; answer: string }[];
  equipment: { title: string; body: string }[];
}

/** Pure synthetic availability. No reservation identifiers, network or persistence. */
export function previewCalendar(
  config: CustomerPreviewConfig,
  input: { month?: string | null; date?: string | null },
  purchased: ReadonlySet<string> = new Set(),
): CalendarView {
  const now = new Date(config.nowISO);
  const tomorrow = addDaysToDateKey(dateKeyInTimeZone(now), 1);
  const location = calendarLocation(
    { ...input, date: input.date === undefined ? tomorrow : input.date },
    90,
    now,
  );
  const periods = config.periods.map((p) => ({
    ...p,
    startsAt: new Date(p.startsAt),
    endsAt: new Date(p.endsAt),
  }));
  const slotsFor = (date: string) => {
    const hours = config.hours.find(
      (h) => h.dayOfWeek === dayOfWeek(localDateTimeToDate(date, 720)),
    );
    return hours
      ? pricingSlots(hours).flatMap((slot, index) => {
          const start = localDateTimeToDate(date, slot.startMinute);
          if (start <= now) return [];
          const end = new Date(start.getTime() + hours.slotMinutes * 60_000);
          return [
            {
              startISO: start.toISOString(),
              label: formatTimeRange(start, end),
              durationMinutes: hours.slotMinutes,
              priceCents: resolveEntryPrice({
                standardPriceCents: config.standardPriceCents,
                hours: config.hours,
                blockPrices: config.blockPrices,
                periods,
                at: start,
              }).priceCents,
              booked: index === 2 || purchased.has(start.toISOString()),
            },
          ];
        })
      : [];
  };
  return {
    ...location,
    source: "preview",
    days: monthGrid(location.monthKey).map(({ dateKey }) => {
      const slots = slotsFor(dateKey);
      return {
        dateKey,
        isClosed: slots.length === 0,
        hasAvailability: slots.some((s) => !s.booked),
      };
    }),
    selectedSlots: location.selectedDateKey
      ? slotsFor(location.selectedDateKey)
      : [],
  };
}

/** Reject URL-injected, occupied, duplicate or stale synthetic slots too. */
export function previewSelection(
  config: CustomerPreviewConfig,
  starts: readonly string[],
  purchased: ReadonlySet<string>,
) {
  return [...new Set(starts)]
    .slice(0, 10)
    .flatMap((startISO) => {
      const start = new Date(startISO);
      if (!Number.isFinite(start.getTime())) return [];
      const date = dateKeyInTimeZone(start);
      const view = previewCalendar(config, { date }, purchased);
      const slot = view.selectedSlots.find(
        (s) => s.startISO === startISO && !s.booked,
      );
      return slot
        ? [{ ...slot, label: `${formatDate(start)}, ${slot.label}` }]
        : [];
    })
    .sort((a, b) => a.startISO.localeCompare(b.startISO));
}
