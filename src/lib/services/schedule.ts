import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { blockedSlot, openingHours } from "@/lib/db/schema";
import type { BlockedSlot, OpeningHours } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";

/**
 * Schedule service — opening hours and blocked slots, both managed from the
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
  const [row] = await db
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
        gte(blockedSlot.startsAt, rangeStart),
        lte(blockedSlot.startsAt, rangeEnd),
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
  const [row] = await db
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
}

export async function deleteBlockedSlot(id: string): Promise<void> {
  await db.delete(blockedSlot).where(eq(blockedSlot.id, id));
}
