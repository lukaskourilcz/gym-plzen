import { and, eq, gt, lt, ne, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db, type DatabaseExecutor } from "@/lib/db";
import { blockedSlot, openingHours, reservation } from "@/lib/db/schema";
import { dayOfWeek, minuteOfDay, minutesBetween } from "@/lib/helpers/datetime";

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
  opts: { excludeReservationId?: string } = {},
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
        overlaps(reservation.startsAt, reservation.endsAt, startsAt, endsAt),
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
    .where(overlaps(blockedSlot.startsAt, blockedSlot.endsAt, startsAt, endsAt))
    .limit(1);

  if (blockConflict.length > 0) {
    return { available: false, reason: "overlap_block" };
  }

  return { available: true };
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
    .where(
      overlaps(reservation.startsAt, reservation.endsAt, rangeStart, rangeEnd),
    );

  const blocks = await db
    .select()
    .from(blockedSlot)
    .where(
      overlaps(blockedSlot.startsAt, blockedSlot.endsAt, rangeStart, rangeEnd),
    );

  return { reservations, blocks };
}
