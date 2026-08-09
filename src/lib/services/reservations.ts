import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservation } from "@/lib/db/schema";
import type { NewReservation, Reservation } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";
import { checkAvailability } from "./availability";
import { initPipeline } from "./pipeline";
import { listCodesForReservation, revokeAccessCode } from "./access-codes";

/**
 * Reservation service : the write-side business logic for bookings. All
 * mutations funnel through here so the single-occupancy invariant and the
 * reliability pipeline are always applied.
 */

const AVAILABILITY_MESSAGES: Record<string, string> = {
  closed: "Vybraný čas je mimo otevírací dobu.",
  overlap_reservation: "Tento termín je již rezervovaný.",
  overlap_block: "Tento termín je blokovaný.",
  invalid_range: "Neplatný časový rozsah.",
};

export interface CreateReservationInput {
  userId?: string | null;
  startsAt: Date;
  endsAt: Date;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  priceCents?: number | null;
  /** When the visitor ticked the house rules; null for admin walk-ins. */
  rulesAcceptedAt?: Date | null;
  /** When the visitor ticked the terms of business; null for admin walk-ins. */
  termsAcceptedAt?: Date | null;
  /** Set when an admin creates the booking manually. */
  createdByAdminId?: string | null;
  /** Admin bookings and membership-covered bookings start confirmed. */
  status?: Reservation["status"];
}

/**
 * Create a reservation, guarding against overlaps. Throws `ActionError` with a
 * user-facing message when the slot is unavailable. Initialises the reliability
 * pipeline for confirmed bookings.
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<Reservation> {
  const availability = await checkAvailability(input.startsAt, input.endsAt);
  if (!availability.available) {
    throw new ActionError(
      AVAILABILITY_MESSAGES[availability.reason ?? "invalid_range"] ??
        "Termín není dostupný.",
    );
  }

  const values: NewReservation = {
    userId: input.userId ?? null,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: input.status ?? "pending",
    contactName: input.contactName ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    priceCents: input.priceCents ?? null,
    rulesAcceptedAt: input.rulesAcceptedAt ?? null,
    termsAcceptedAt: input.termsAcceptedAt ?? null,
    createdByAdminId: input.createdByAdminId ?? null,
  };

  let created: Reservation | undefined;
  try {
    [created] = await db.insert(reservation).values(values).returning();
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "23P01") {
      throw new ActionError(
        "Tento termín právě rezervoval jiný zákazník. Vyberte prosím jiný čas.",
      );
    }
    throw error;
  }
  if (!created) throw new ActionError("Rezervaci se nepodařilo vytvořit.");

  if (created.status === "confirmed") {
    await initPipeline(created.id);
  }

  return created;
}

/** Mark a reservation as confirmed (e.g. after successful payment) and kick off the pipeline. */
export async function confirmReservation(id: string): Promise<boolean> {
  const [updated] = await db
    .update(reservation)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(and(eq(reservation.id, id), eq(reservation.status, "pending")))
    .returning();
  if (updated) {
    await initPipeline(id);
    return true;
  }
  const existing = await getReservation(id);
  return existing?.status === "confirmed";
}

/** Cancel a reservation, recording who/why. */
export async function cancelReservation(params: {
  id: string;
  reason?: string;
  byAdminId?: string;
}): Promise<void> {
  await db
    .update(reservation)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: params.reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(reservation.id, params.id));
  const codes = await listCodesForReservation(params.id);
  await Promise.allSettled(codes.map((code) => revokeAccessCode(code.id)));
}

/** Release stale Checkout holds so abandoned payments cannot block the gym. */
export async function releaseExpiredPendingReservations(
  now = new Date(),
  holdMinutes = 32,
): Promise<number> {
  const cutoff = pendingHoldCutoff(now, holdMinutes);
  const released = await db
    .update(reservation)
    .set({
      status: "cancelled",
      cancelledAt: now,
      cancelReason: "checkout_expired",
      updatedAt: now,
    })
    .where(
      and(eq(reservation.status, "pending"), lt(reservation.createdAt, cutoff)),
    )
    .returning({ id: reservation.id });
  return released.length;
}

export function pendingHoldCutoff(now: Date, holdMinutes = 32): Date {
  return new Date(now.getTime() - holdMinutes * 60_000);
}

/** A single reservation by id, or null. */
export async function getReservation(id: string): Promise<Reservation | null> {
  const [row] = await db
    .select()
    .from(reservation)
    .where(eq(reservation.id, id))
    .limit(1);
  return row ?? null;
}

/** Upcoming reservations for one member. */
export async function listUpcomingForUser(
  userId: string,
): Promise<Reservation[]> {
  return db
    .select()
    .from(reservation)
    .where(
      and(
        eq(reservation.userId, userId),
        gte(reservation.startsAt, new Date()),
      ),
    )
    .orderBy(reservation.startsAt);
}

/** Most recent reservations (admin list view). */
export async function listRecent(limit = 100): Promise<Reservation[]> {
  return db
    .select()
    .from(reservation)
    .orderBy(desc(reservation.startsAt))
    .limit(limit);
}
