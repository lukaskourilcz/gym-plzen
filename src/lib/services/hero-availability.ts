import { isHeroDateAllowed } from "@/lib/helpers/hero-availability";
import { loadCalendarAvailability } from "./calendar-availability";
import { formatMoney, formatTimeRange } from "@/lib/helpers/format";

/** Only the selected day's public availability. No reservation identifiers or contacts. */
export async function getHeroDay(date: string, now = new Date()) {
  if (!isHeroDateAllowed(date, now)) return null;
  const result = await loadCalendarAvailability({ date }, now, date);
  const day = result.days[0];
  if (!day) return null;
  return {
    source: result.view.source,
    day: {
      dateLabel: day.dateKey,
      slots: day.slots.map((slot) => ({
        label: formatTimeRange(slot.start, slot.end),
        price: formatMoney(result.priceForDate(slot.start)),
        startMs: slot.start.getTime(),
        booked: slot.booked,
      })),
    },
  };
}
