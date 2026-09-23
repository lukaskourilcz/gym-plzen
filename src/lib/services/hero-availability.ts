import { isHeroDateAllowed } from "@/lib/helpers/hero-availability";
import { loadSiteContent } from "@/lib/content/site";
import { addDaysToDateKey } from "@/lib/helpers/datetime";
import { formatMoney, formatTimeRange } from "@/lib/helpers/format";
import { getSlotsForRange } from "./slots";

/** Only the selected day's public availability. No reservation identifiers or contacts. */
export async function getHeroDay(date: string, now = new Date()) {
  if (!isHeroDateAllowed(date, now)) return null;
  const [availability, content] = await Promise.all([
    getSlotsForRange(date, addDaysToDateKey(date, 1), now),
    loadSiteContent("cs", { strict: true }),
  ]);
  const day = availability.days[0];
  if (!day || availability.source === "unavailable") return null;
  return {
    source: availability.source,
    day: {
      dateLabel: day.dateKey,
      slots: day.slots.map((slot) => ({
        label: formatTimeRange(slot.start, slot.end),
        price: formatMoney(content.entryPriceForDate(slot.start)),
        startMs: slot.start.getTime(),
        booked: slot.booked,
      })),
    },
  };
}
