import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservation } from "@/lib/db/schema";
import { dayOfWeek, minuteOfDay } from "@/lib/helpers/datetime";
import { logger } from "@/lib/helpers/logger";

/**
 * Statistics service — aggregates reservations into insights for the admin
 * (sessions per weekday, most frequent hours, monthly trend, status mix).
 * Aggregation is done in JS over a bounded fetch so weekday/hour buckets are
 * computed in the gym's local timezone without SQL timezone pitfalls. Resilient:
 * returns empty stats if the DB is unavailable.
 */

export interface Bucket {
  label: string;
  count: number;
}

export interface Stats {
  total: number;
  confirmed: number;
  cancelled: number;
  noShow: number;
  completed: number;
  last30: number;
  byWeekday: Bucket[]; // Mon..Sun
  byHour: Bucket[]; // only hours that occur
  byMonth: Bucket[]; // chronological
  busiestWeekday?: string;
  busiestHour?: string;
}

const WEEKDAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const TZ = "Europe/Prague";

export async function getStats(now: Date = new Date()): Promise<Stats> {
  let rows: { startsAt: Date; status: string }[] = [];
  try {
    rows = await db
      .select({ startsAt: reservation.startsAt, status: reservation.status })
      .from(reservation)
      .orderBy(desc(reservation.startsAt))
      .limit(5000);
  } catch (e) {
    logger.warn("getStats: empty (DB unavailable)", { error: String(e) });
  }

  const counted = rows.filter((r) => r.status !== "cancelled");
  const weekday = new Array(7).fill(0) as number[]; // index 0=Mon .. 6=Sun
  const hour = new Map<number, number>();
  const month = new Map<string, number>();
  const monthFmt = new Intl.DateTimeFormat("cs-CZ", { month: "short", year: "numeric", timeZone: TZ });
  const thirtyAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  let last30 = 0;

  for (const r of counted) {
    // dayOfWeek: 0=Sun..6=Sat → convert to Mon-based index 0=Mon..6=Sun.
    const dow = dayOfWeek(r.startsAt, TZ);
    const monIdx = (dow + 6) % 7;
    weekday[monIdx]!++;

    const h = Math.floor(minuteOfDay(r.startsAt, TZ) / 60);
    hour.set(h, (hour.get(h) ?? 0) + 1);

    const mKey = monthFmt.format(r.startsAt);
    month.set(mKey, (month.get(mKey) ?? 0) + 1);

    if (r.startsAt.getTime() >= thirtyAgo && r.startsAt.getTime() <= now.getTime()) last30++;
  }

  const byWeekday: Bucket[] = WEEKDAY_LABELS.map((label, i) => ({ label, count: weekday[i]! }));
  const byHour: Bucket[] = [...hour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([h, count]) => ({ label: `${String(h).padStart(2, "0")}:00`, count }));
  const byMonth: Bucket[] = [...month.entries()].map(([label, count]) => ({ label, count })).slice(-12);

  const busiestWeekday = [...byWeekday].sort((a, b) => b.count - a.count)[0];
  const busiestHour = [...byHour].sort((a, b) => b.count - a.count)[0];

  return {
    total: rows.length,
    confirmed: rows.filter((r) => r.status === "confirmed").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    noShow: rows.filter((r) => r.status === "no_show").length,
    completed: rows.filter((r) => r.status === "completed").length,
    last30,
    byWeekday,
    byHour,
    byMonth,
    busiestWeekday: busiestWeekday && busiestWeekday.count > 0 ? busiestWeekday.label : undefined,
    busiestHour: busiestHour && busiestHour.count > 0 ? busiestHour.label : undefined,
  };
}
