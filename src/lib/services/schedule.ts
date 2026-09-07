import { and, asc, eq, gt, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blockedSlot,
  openingHours,
  reservation,
  siteSetting,
} from "@/lib/db/schema";
import type { BlockedSlot, OpeningHours } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";
import {
  DEFAULT_SHOWER_MINUTES,
  DEFAULT_SLOT_MINUTES,
  SHOWER_MINUTES_SETTING_KEY,
} from "@/lib/config/schedule";

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
  return db.transaction(async (tx) => {
  await tx.execute(sql`select pg_advisory_xact_lock(721834001)`);
  const now = new Date();
  const [row] = await tx
    .insert(openingHours)
    .values({
      dayOfWeek: input.dayOfWeek,
      openMinute: input.openMinute,
      closeMinute: input.closeMinute,
      slotMinutes: input.slotMinutes ?? DEFAULT_SLOT_MINUTES,
      isClosed: input.isClosed ? 1 : 0,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: openingHours.dayOfWeek,
      set: {
        openMinute: input.openMinute,
        closeMinute: input.closeMinute,
        slotMinutes: input.slotMinutes ?? DEFAULT_SLOT_MINUTES,
        isClosed: input.isClosed ? 1 : 0,
        updatedAt: now,
      },
    })
    .returning();
  return row!;
  });
}

// ── Blocked slots ────────────────────────────────────────────────────────────

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
    await tx.execute(sql`select pg_advisory_xact_lock(721834001)`);
    const [conflict] = await tx
      .select({ id: reservation.id })
      .from(reservation)
      .where(
        and(
          lt(reservation.startsAt, input.endsAt),
          gt(reservation.endsAt, input.startsAt),
          or(
            eq(reservation.status, "pending"),
            eq(reservation.status, "confirmed"),
          ),
        ),
      )
      .limit(1);
    if (conflict)
      throw new ActionError(
        "Čas obsahuje rezervaci. Nejdříve ji zrušte v přehledu rezervací a vyřešte případné vrácení platby.",
      );
    const [row] = await tx.insert(blockedSlot).values(input).returning();
    return row!;
  });
}

export async function deleteBlockedSlot(id: string): Promise<void> {
  await db.delete(blockedSlot).where(eq(blockedSlot.id, id));
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
