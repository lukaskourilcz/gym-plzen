import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservation } from "@/lib/db/schema";
import type { NewReservation, Reservation } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";
import { checkAvailability } from "./availability";
import { initPipeline } from "./pipeline";

/**
 * Reservation service — the write-side business logic for bookings. All
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
    createdByAdminId: input.createdByAdminId ?? null,
  };

  const [created] = await db.insert(reservation).values(values).returning();
  if (!created) throw new ActionError("Rezervaci se nepodařilo vytvořit.");

  if (created.status === "confirmed") {
    await initPipeline(created.id);
  }

  return created;
}

/** Mark a reservation as confirmed (e.g. after successful payment) and kick off the pipeline. */
export async function confirmReservation(id: string): Promise<void> {
  const [updated] = await db
    .update(reservation)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(eq(reservation.id, id))
    .returning();
  if (updated) await initPipeline(id);
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
  // NOTE: access-code revocation on the lock is handled by the pipeline/watchdog.
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
export async function listUpcomingForUser(userId: string): Promise<Reservation[]> {
  return db
    .select()
    .from(reservation)
    .where(and(eq(reservation.userId, userId), gte(reservation.startsAt, new Date())))
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
