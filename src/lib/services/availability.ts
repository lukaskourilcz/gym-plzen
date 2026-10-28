import { and, eq, gt, lt, ne, or, sql, inArray, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db, type DatabaseExecutor } from "@/lib/db";
import { readDatabase } from "@/lib/db/read";
import { MAX_SLOTS_PER_ORDER } from "@/lib/config/orders";
import { blockedSlot, openingHours, reservation } from "@/lib/db/schema";
import {
  dayOfWeek,
  minuteOfDay,
  minutesBetween,
  intervalsOverlap,
} from "@/lib/helpers/datetime";

/**
 * Availability rules for the single-occupancy gym. A requested [start, end)
 * window is bookable iff:
 *   1. it falls within opening hours for that weekday, and
 *   2. it does not overlap any active reservation, and
 *   3. it does not overlap any blocked slot.
 *
 * The overlap check is expressed as an interval-intersection query so the DB :
 * not the app : is the arbiter of truth; combined with the exclusion constraint
 * (see NEEDED.md) this makes double-booking impossible even under a race.
 */

const ACTIVE_STATUSES = ["pending", "confirmed"] as const;

/** Acquire inside the writer's transaction; it stays held through commit. */
export async function lockSchedule(
  executor: DatabaseExecutor,
  mode: "shared" | "exclusive" = "shared",
): Promise<void> {
  await executor.execute(
    mode === "exclusive"
      ? sql`select pg_advisory_xact_lock(hashtextextended('booking-schedule', 0))`
      : sql`select pg_advisory_xact_lock_shared(hashtextextended('booking-schedule', 0))`,
  );
}

export interface AvailabilityResult {
  available: boolean;
  reason?: "closed" | "overlap_reservation" | "overlap_block" | "invalid_range";
}

/**
 * Interval-intersection predicate for any table with start/end columns:
 * two [start, end) windows overlap iff start < otherEnd AND end > otherStart.
 *
 * Uses drizzle's `lt`/`gt` operators (not a raw `sql` template) so `Date` values
 * are bound through each column's timestamp mapper : raw interpolation of a Date
 * fails at the driver with "Received an instance of Date".
 */
function overlaps(
  startCol: PgColumn,
  endCol: PgColumn,
  startsAt: Date,
  endsAt: Date,
): SQL {
  return and(lt(startCol, endsAt), gt(endCol, startsAt))!;
}

/** Includes the second, durable window of an unfinished access-code change. */
export function reservationOverlaps(startsAt: Date, endsAt: Date): SQL {
  // Match the exclusion constraint's expression so active-window reads can
  // use its GiST index, including a hold whose original is outside the range.
  return sql`(case when ${reservation.rescheduleStartsAt} is null
    then tstzmultirange(tstzrange(${reservation.startsAt}, ${reservation.endsAt}, '[)'))
    else tstzmultirange(tstzrange(${reservation.startsAt}, ${reservation.endsAt}, '[)'),
      tstzrange(${reservation.rescheduleStartsAt}, ${reservation.rescheduleEndsAt}, '[)'))
    end) && tstzmultirange(tstzrange(${startsAt.toISOString()}::timestamptz, ${endsAt.toISOString()}::timestamptz, '[)'))`;
}

/** Check whether a requested window is within opening hours. */
async function isWithinOpeningHours(
  startsAt: Date,
  endsAt: Date,
  executor: DatabaseExecutor,
): Promise<boolean> {
  const dow = dayOfWeek(startsAt);
  const [hours] = await executor
    .select()
    .from(openingHours)
    .where(eq(openingHours.dayOfWeek, dow))
    .limit(1);

  if (!hours || hours.isClosed) return false;

  const startMin = minuteOfDay(startsAt);
  const endMin = minuteOfDay(endsAt);
  // Reject windows that cross midnight for simplicity (sessions are short).
  if (endMin <= startMin) return false;
  return startMin >= hours.openMinute && endMin <= hours.closeMinute;
}

/**
 * Determine whether a window is available. `excludeReservationId` lets an edit
 * ignore the row being moved.
 */
export async function checkAvailability(
  startsAt: Date,
  endsAt: Date,
  opts: { excludeReservationId?: string; excludeBlockedSlotId?: string } = {},
  executor: DatabaseExecutor = db,
): Promise<AvailabilityResult> {
  if (minutesBetween(startsAt, endsAt) <= 0) {
    return { available: false, reason: "invalid_range" };
  }

  if (!(await isWithinOpeningHours(startsAt, endsAt, executor))) {
    return { available: false, reason: "closed" };
  }

  const reservationConflict = await executor
    .select({ id: reservation.id })
    .from(reservation)
    .where(
      and(
        reservationOverlaps(startsAt, endsAt),
        or(
          ...ACTIVE_STATUSES.map((s) => eq(reservation.status, s)),
          eq(reservation.accessRevocationPending, true),
        ),
        opts.excludeReservationId
          ? ne(reservation.id, opts.excludeReservationId)
          : undefined,
      ),
    )
    .limit(1);

  if (reservationConflict.length > 0) {
    return { available: false, reason: "overlap_reservation" };
  }

  const blockConflict = await executor
    .select({ id: blockedSlot.id })
    .from(blockedSlot)
    .where(
      and(
        overlaps(blockedSlot.startsAt, blockedSlot.endsAt, startsAt, endsAt),
        opts.excludeBlockedSlotId
          ? ne(blockedSlot.id, opts.excludeBlockedSlotId)
          : undefined,
      ),
    )
    .limit(1);

  if (blockConflict.length > 0) {
    return { available: false, reason: "overlap_block" };
  }

  return { available: true };
}

/**
 * Read-only checkout preview: three bounded SELECTs for the whole selection,
 * rather than three concurrent queries per slot. Writers still use the
 * authoritative per-window check under the schedule lock and DB exclusion.
 */
export async function checkAvailabilityBatch(
  windows: readonly { startsAt: Date; endsAt: Date }[],
): Promise<AvailabilityResult[]> {
  if (windows.length > MAX_SLOTS_PER_ORDER)
    throw new RangeError("Too many preview windows");
  const valid = (window: (typeof windows)[number]) =>
    window.startsAt instanceof Date &&
    window.endsAt instanceof Date &&
    Number.isFinite(window.startsAt.getTime()) &&
    Number.isFinite(window.endsAt.getTime()) &&
    window.endsAt > window.startsAt;
  const requested = windows.filter(valid);
  if (requested.length === 0)
    return windows.map(() => ({ available: false, reason: "invalid_range" }));
  return readDatabase(async (tx) => {
    const [hours, bookings, blocks] = await Promise.all([
      tx
        .select()
        .from(openingHours)
        .where(
          inArray(openingHours.dayOfWeek, [
            ...new Set(requested.map((window) => dayOfWeek(window.startsAt))),
          ]),
        ),
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
            or(
              ...requested.map((window) =>
                reservationOverlaps(window.startsAt, window.endsAt),
              ),
            ),
            or(
              inArray(reservation.status, [...ACTIVE_STATUSES]),
              eq(reservation.accessRevocationPending, true),
            ),
          ),
        ),
      tx
        .select({ startsAt: blockedSlot.startsAt, endsAt: blockedSlot.endsAt })
        .from(blockedSlot)
        .where(
          or(
            ...requested.map((window) =>
              overlaps(
                blockedSlot.startsAt,
                blockedSlot.endsAt,
                window.startsAt,
                window.endsAt,
              ),
            ),
          ),
        ),
    ]);
    const byDay = new Map(hours.map((row) => [row.dayOfWeek, row]));
    const busy = bookings.flatMap((row) => [
      row,
      ...(row.rescheduleStartsAt && row.rescheduleEndsAt
        ? [{ startsAt: row.rescheduleStartsAt, endsAt: row.rescheduleEndsAt }]
        : []),
    ]);
    return windows.map((window): AvailabilityResult => {
      if (!valid(window)) return { available: false, reason: "invalid_range" };
      const h = byDay.get(dayOfWeek(window.startsAt));
      const start = minuteOfDay(window.startsAt),
        end = minuteOfDay(window.endsAt);
      if (
        !h ||
        h.isClosed ||
        end <= start ||
        start < h.openMinute ||
        end > h.closeMinute
      )
        return { available: false, reason: "closed" };
      const conflicts = (other: { startsAt: Date; endsAt: Date }) =>
        intervalsOverlap(
          window.startsAt,
          window.endsAt,
          other.startsAt,
          other.endsAt,
        );
      if (busy.some(conflicts))
        return { available: false, reason: "overlap_reservation" };
      if (blocks.some(conflicts))
        return { available: false, reason: "overlap_block" };
      return { available: true };
    });
  });
}

/**
 * Fetch all reservations + blocks overlapping a date range (for the admin
 * calendar). Overlap, not "starts inside": a closure that began before the
 * range (e.g. a ten-day holiday) must still shade the days it covers.
 */
export async function listCalendarEntries(rangeStart: Date, rangeEnd: Date) {
  const reservations = await db
    .select()
    .from(reservation)
    .where(reservationOverlaps(rangeStart, rangeEnd));

  const blocks = await db
    .select()
    .from(blockedSlot)
    .where(
      overlaps(blockedSlot.startsAt, blockedSlot.endsAt, rangeStart, rangeEnd),
    );

  return { reservations, blocks };
}
