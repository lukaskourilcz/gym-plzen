import { and, desc, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservation } from "@/lib/db/schema";
import type { Reservation } from "@/lib/db/types";
import {
  MINUTE_MS,
  addDaysToDateKey,
  dateKeyInTimeZone,
  dayOfWeek,
  localDateTimeToDate,
  minuteOfDay,
} from "@/lib/helpers/datetime";
import { logger } from "@/lib/helpers/logger";

/**
 * Statistics service : aggregates reservations into insights for the admin
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

  return aggregateStats(rows, now);
}

/** Pure aggregation of reservation rows into stats : reused by the demo layer. */
export function aggregateStats(
  rows: { startsAt: Date; status: string }[],
  now: Date = new Date(),
): Stats {
  const counted = rows.filter((r) => r.status !== "cancelled");
  const weekday = new Array(7).fill(0) as number[]; // index 0=Mon .. 6=Sun
  const hour = new Map<number, number>();
  const month = new Map<string, number>();
  const monthFmt = new Intl.DateTimeFormat("cs-CZ", {
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
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

    if (
      r.startsAt.getTime() >= thirtyAgo &&
      r.startsAt.getTime() <= now.getTime()
    )
      last30++;
  }

  const byWeekday: Bucket[] = WEEKDAY_LABELS.map((label, i) => ({
    label,
    count: weekday[i]!,
  }));
  const byHour: Bucket[] = [...hour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([h, count]) => ({
      label: `${String(h).padStart(2, "0")}:00`,
      count,
    }));
  const byMonth: Bucket[] = [...month.entries()]
    .map(([label, count]) => ({ label, count }))
    .slice(-12);

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
    busiestWeekday:
      busiestWeekday && busiestWeekday.count > 0
        ? busiestWeekday.label
        : undefined,
    busiestHour:
      busiestHour && busiestHour.count > 0 ? busiestHour.label : undefined,
  };
}

/** Statuses that represent a booking the gym is actually holding open. */
const LIVE_STATUSES = new Set(["confirmed", "completed"]);

export interface DayOverview {
  /** Today's reservations in chronological order, cancellations included. */
  reservations: Reservation[];
  /** Money actually taken today. Free and membership entries are excluded. */
  revenueCents: number;
  /** Entries today that cost nothing: loyalty rewards or membership. */
  freeEntries: number;
  /** Rolling seven-day counts, so the operator sees a direction of travel. */
  last7: number;
  previous7: number;
  cancelledLast7: number;
  noShowLast7: number;
}

const EMPTY_DAY_OVERVIEW: DayOverview = {
  reservations: [],
  revenueCents: 0,
  freeEntries: 0,
  last7: 0,
  previous7: 0,
  cancelledLast7: 0,
  noShowLast7: 0,
};

/** Prague midnight to midnight for the day the instant falls in. */
export function pragueDayBounds(now: Date): { start: Date; end: Date } {
  const key = dateKeyInTimeZone(now, TZ);
  return {
    start: localDateTimeToDate(key, 0, TZ),
    end: localDateTimeToDate(addDaysToDateKey(key, 1), 0, TZ),
  };
}

/**
 * Everything the admin "Dnes" dashboard needs about one day, plus the two
 * seven-day windows behind it. Resilient in the same way as `getStats`: an
 * unavailable database yields an empty overview rather than a broken page.
 */
export async function getDayOverview(
  now: Date = new Date(),
): Promise<DayOverview> {
  const { start, end } = pragueDayBounds(now);
  const windowStart = new Date(start.getTime() - 13 * 24 * 60 * MINUTE_MS);

  try {
    // One query: the fourteen-day window already contains today, so the day is
    // a filter over these rows rather than a second round trip.
    const window = await db
      .select()
      .from(reservation)
      .where(
        and(
          gte(reservation.startsAt, windowStart),
          lt(reservation.startsAt, end),
        ),
      )
      .orderBy(reservation.startsAt);
    return aggregateDayOverview(window, now);
  } catch (e) {
    logger.warn("getDayOverview: empty (DB unavailable)", { error: String(e) });
    return EMPTY_DAY_OVERVIEW;
  }
}

/**
 * Pure aggregation over the fourteen-day window, so the numbers are testable
 * without a database. Rows are expected in chronological order.
 */
export function aggregateDayOverview(
  window: Reservation[],
  now: Date = new Date(),
): DayOverview {
  const { start, end } = pragueDayBounds(now);
  const sevenAgo = new Date(start.getTime() - 6 * 24 * 60 * MINUTE_MS);
  const fourteenAgo = new Date(start.getTime() - 13 * 24 * 60 * MINUTE_MS);

  const today = window.filter((r) => r.startsAt >= start && r.startsAt < end);
  const live = today.filter((r) => LIVE_STATUSES.has(r.status));
  const inLast7 = window.filter(
    (r) => r.startsAt >= sevenAgo && r.startsAt < end,
  );
  const inPrevious7 = window.filter(
    (r) => r.startsAt >= fourteenAgo && r.startsAt < sevenAgo,
  );

  return {
    reservations: today,
    // `null` means covered by a membership and `0` a loyalty reward: neither is
    // revenue, and the tile's caption says so.
    revenueCents: live.reduce((sum, r) => sum + (r.priceCents ?? 0), 0),
    freeEntries: live.filter((r) => r.priceCents === null || r.priceCents === 0)
      .length,
    last7: inLast7.filter((r) => LIVE_STATUSES.has(r.status)).length,
    previous7: inPrevious7.filter((r) => LIVE_STATUSES.has(r.status)).length,
    cancelledLast7: inLast7.filter((r) => r.status === "cancelled").length,
    noShowLast7: inLast7.filter((r) => r.status === "no_show").length,
  };
}
