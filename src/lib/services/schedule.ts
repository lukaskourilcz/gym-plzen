import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, gte, inArray, lt, or, sql } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import type { PgColumn } from "drizzle-orm/pg-core";
import {
  blockedSlot,
  openingHours,
  reservation,
  reservationChange,
  siteSetting,
} from "@/lib/db/schema";
import type { BlockedSlot, OpeningHours, Reservation } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";
import { lockSchedule, reservationOverlaps } from "./availability";
import {
  DEFAULT_SHOWER_MINUTES,
  SHOWER_MINUTES_SETTING_KEY,
} from "@/lib/config/schedule";

import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "@/lib/helpers/datetime";
import {
  MAX_PLANNED_SCHEDULES,
  PLANNED_SCHEDULES_KEY,
  plannedScheduleForDate,
  plannedSchedulesOverlap,
  type PlannedSchedule,
  type PlannedScheduleInput,
} from "@/lib/config/planned-schedules";
import { listPlannedSchedules } from "./planned-schedules";
import { resolveConfiguredSlotFromSchedule } from "./slots";

/** Serialize settings changes with booking writers. Reservation data is untouched. */
export async function changePlannedSchedule(
  input: PlannedScheduleInput | { id: string; revision: string; remove: true },
  adminId: string,
) {
  return db.transaction(async (tx) => {
    await lockSchedule(tx, "exclusive");
    const schedules = await listPlannedSchedules(tx);
    const existing = schedules.find((schedule) => schedule.id === input.id);
    if (input.id && (!existing || existing.revision !== input.revision))
      throw new ActionError("Rozvrh mezitím někdo změnil. Obnovte stránku.");
    const remaining = schedules.filter((schedule) => schedule.id !== input.id);
    if (!("remove" in input)) {
      const today = dateKeyInTimeZone(new Date());
      if (
        input.to < today ||
        (input.from < today && input.from !== existing?.from)
      )
        throw new ActionError(
          "Naplánujte rozvrh na dnešek nebo budoucí období.",
        );
      if (remaining.length >= MAX_PLANNED_SCHEDULES)
        throw new ActionError("Nejdříve odeberte některý ze starších rozvrhů.");
      if (
        remaining.some((schedule) => plannedSchedulesOverlap(schedule, input))
      )
        throw new ActionError(
          "Pro některé vybrané dny už v tomto období existuje rozvrh.",
        );
      remaining.push({
        ...input,
        id: existing?.id ?? randomUUID(),
        revision: randomUUID(),
        weekdays: [...input.weekdays].sort((a, b) => a - b),
        windows: [...input.windows].sort(
          (a, b) => a.startMinute - b.startMinute,
        ),
      } satisfies PlannedSchedule);
    }
    const periods =
      "remove" in input
        ? [existing!]
        : [input, ...(existing ? [existing] : [])];
    await assertPendingWindowsPreserved(tx, periods, schedules, remaining);
    const values = {
      value: remaining.sort((a, b) => a.from.localeCompare(b.from)),
      updatedByAdminId: adminId,
      updatedAt: new Date(),
    };
    await tx
      .insert(siteSetting)
      .values({ key: PLANNED_SCHEDULES_KEY, ...values })
      .onConflictDoUpdate({ target: siteSetting.key, set: values });
    // Same privacy-safe invalidation used by the opening_hours trigger.
    await tx.execute(sql`
      insert into public.availability_signal (key, version, changed_at)
      values (1, 1, now())
      on conflict (key) do update
        set version = public.availability_signal.version + 1,
            changed_at = excluded.changed_at
    `);
  });
}

/** Check in-progress checkouts before publishing a different set of slots. */
async function assertPendingWindowsPreserved(
  tx: Transaction,
  periods: Pick<PlannedSchedule, "from" | "to">[],
  previous: PlannedSchedule[],
  next: PlannedSchedule[],
) {
  const now = new Date();
  const inPeriods = (column: PgColumn) =>
    or(
      ...periods.map(({ from, to }) =>
        and(
          gte(column, localDateTimeToDate(from, 0)),
          lt(column, localDateTimeToDate(addDaysToDateKey(to, 1), 0)),
        ),
      ),
    );
  const [orders, changes] = await Promise.all([
    tx
      .select({ startsAt: reservation.startsAt, endsAt: reservation.endsAt })
      .from(reservation)
      .where(
        and(
          eq(reservation.status, "pending"),
          gt(reservation.startsAt, now),
          inPeriods(reservation.startsAt),
        ),
      ),
    tx
      .select({
        startsAt: reservationChange.startsAt,
        endsAt: reservationChange.endsAt,
      })
      .from(reservationChange)
      .where(
        and(
          inArray(reservationChange.status, ["awaiting_payment", "applying"]),
          gt(reservationChange.expiresAt, now),
          inPeriods(reservationChange.startsAt),
        ),
      ),
  ]);
  const holds = [...orders, ...changes];
  if (!holds.length) return;
  const weekly = await tx.select().from(openingHours);
  const invalidated = holds.some((hold) => {
    const date = dateKeyInTimeZone(hold.startsAt);
    if (
      plannedScheduleForDate(previous, date)?.revision ===
      plannedScheduleForDate(next, date)?.revision
    )
      return false;
    return (
      resolveConfiguredSlotFromSchedule(
        hold.startsAt,
        weekly,
        next,
      )?.endsAt.getTime() !== hold.endsAt.getTime()
    );
  });
  if (invalidated)
    throw new ActionError(
      "Některý z termínů čeká na dokončení platby nebo změny rezervace. Zkuste rozvrh uložit později.",
    );
}

/**
 * Schedule service : opening hours and blocked slots, both managed from the
 * administration.
 */

// ── Opening hours ────────────────────────────────────────────────────────────

export async function listOpeningHours(): Promise<OpeningHours[]> {
  return db.select().from(openingHours).orderBy(asc(openingHours.dayOfWeek));
}

/** Upsert the opening hours for one weekday (0=Sun…6=Sat). */
export async function setOpeningHours(input: {
  dayOfWeek: number;
  openMinute: number;
  closeMinute: number;
  slotMinutes?: number;
  isClosed?: boolean;
}): Promise<OpeningHours> {
  if (input.closeMinute <= input.openMinute && !input.isClosed) {
    throw new ActionError("Zavírací čas musí být po otevíracím čase.");
  }
  const now = new Date();
  return db.transaction(async (tx) => {
    await lockSchedule(tx, "exclusive");
    const [row] = await tx
      .insert(openingHours)
      .values({
        dayOfWeek: input.dayOfWeek,
        openMinute: input.openMinute,
        closeMinute: input.closeMinute,
        slotMinutes: input.slotMinutes ?? 60,
        isClosed: input.isClosed ? 1 : 0,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: openingHours.dayOfWeek,
        set: {
          openMinute: input.openMinute,
          closeMinute: input.closeMinute,
          slotMinutes: input.slotMinutes ?? 60,
          isClosed: input.isClosed ? 1 : 0,
          updatedAt: now,
        },
      })
      .returning();
    return row!;
  });
}

// ── Blocked slots ────────────────────────────────────────────────────────────

/**
 * Blocks overlapping [rangeStart, rangeEnd). Overlap rather than "starts
 * inside": a closure that began before the range and is still running must
 * stay visible, otherwise the admin cannot see or remove it.
 */
export async function listBlockedSlots(
  rangeStart: Date,
  rangeEnd: Date,
): Promise<BlockedSlot[]> {
  return db
    .select()
    .from(blockedSlot)
    .where(
      and(
        lt(blockedSlot.startsAt, rangeEnd),
        gt(blockedSlot.endsAt, rangeStart),
      ),
    )
    .orderBy(asc(blockedSlot.startsAt));
}

export async function createBlockedSlot(input: {
  startsAt: Date;
  endsAt: Date;
  reason?: BlockedSlot["reason"];
  note?: string | null;
  createdByAdminId?: string | null;
}): Promise<BlockedSlot> {
  if (input.endsAt <= input.startsAt) {
    throw new ActionError("Konec bloku musí být po jeho začátku.");
  }
  return db.transaction(async (tx) => {
    await lockSchedule(tx, "exclusive");
    const [row] = await tx
      .insert(blockedSlot)
      .values({
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        reason: input.reason ?? "other",
        note: input.note ?? null,
        createdByAdminId: input.createdByAdminId ?? null,
      })
      .returning();
    return row!;
  });
}

export async function getBlockedSlot(id: string): Promise<BlockedSlot | null> {
  const [row] = await db
    .select()
    .from(blockedSlot)
    .where(eq(blockedSlot.id, id))
    .limit(1);
  return row ?? null;
}

export async function deleteBlockedSlot(id: string): Promise<void> {
  const [change] = await db
    .select({ id: reservationChange.id })
    .from(reservationChange)
    .where(eq(reservationChange.blockId, id));
  if (change)
    throw new ActionError(
      "Tento čas drží rozpracovaná změna rezervace. Stav doplatku vyřešte v Kreditech.",
    );
  await db.delete(blockedSlot).where(eq(blockedSlot.id, id));
}

// ── Closing time that already has bookings ───────────────────────────────────

/** Active (pending/confirmed) reservations overlapping a time range. */
export async function findOverlappingReservations(
  start: Date,
  end: Date,
): Promise<Reservation[]> {
  return db
    .select()
    .from(reservation)
    .where(
      and(
        // start < otherEnd AND end > otherStart, using operators so Dates bind.
        reservationOverlaps(start, end),
        or(
          eq(reservation.status, "pending"),
          eq(reservation.status, "confirmed"),
        ),
      ),
    );
}

// ── Shower grace (admin-configurable) ────────────────────────────────────────

/**
 * Minutes the access code stays valid after a training slot so the member can
 * shower. Read from the `schedule.shower_minutes` setting, falling back to the
 * default. This grace does NOT affect slot overlap : only code validity.
 */
export async function getShowerMinutes(): Promise<number> {
  try {
    const [row] = await db
      .select({ value: siteSetting.value })
      .from(siteSetting)
      .where(eq(siteSetting.key, SHOWER_MINUTES_SETTING_KEY))
      .limit(1);
    if (typeof row?.value === "number" && row.value >= 0) return row.value;
  } catch {
    // fall through to default
  }
  return DEFAULT_SHOWER_MINUTES;
}

/** Persist the shower grace (minutes). */
export async function setShowerMinutes(
  minutes: number,
  updatedByAdminId?: string | null,
): Promise<void> {
  const now = new Date();
  await db
    .insert(siteSetting)
    .values({
      key: SHOWER_MINUTES_SETTING_KEY,
      value: minutes,
      updatedByAdminId: updatedByAdminId ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: siteSetting.key,
      set: {
        value: minutes,
        updatedByAdminId: updatedByAdminId ?? null,
        updatedAt: now,
      },
    });
}
