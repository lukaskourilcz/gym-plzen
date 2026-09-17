import { raiseAlert } from "./alerts";
import { and, desc, eq, gte, inArray, lt, notExists } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { withReservationLock } from "./operation-lock";
import { payment, reservation } from "@/lib/db/schema";
import type { NewReservation, Reservation } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";
import { checkAvailability } from "./availability";
import { initPipeline } from "./pipeline";
import { listCodesForReservation, revokeAccessCode } from "./access-codes";
import { releaseForReservation } from "./vouchers";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";

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
  confirmationTokenHash?: string;
  loyaltyReward?: number;
}

/**
 * Create a reservation, guarding against overlaps. Throws `ActionError` with a
 * user-facing message when the slot is unavailable. Initialises the reliability
 * pipeline for confirmed bookings.
 */
export async function createReservation(
  input: CreateReservationInput,
  executor: DatabaseExecutor = db,
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
    confirmationTokenHash: input.confirmationTokenHash,
    loyaltyReward: input.loyaltyReward,
  };

  let created: Reservation | undefined;
  try {
    [created] = await executor.insert(reservation).values(values).returning();
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
    await initPipeline(created.id, executor);
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

/** Persist the server-calculated price after an optional voucher claim. */
export async function updateReservationPrice(
  id: string,
  priceCents: number,
): Promise<void> {
  const [updated] = await db
    .update(reservation)
    .set({ priceCents, updatedAt: new Date() })
    .where(and(eq(reservation.id, id), eq(reservation.status, "pending")))
    .returning({ id: reservation.id });
  if (!updated) throw new ActionError("Cenu rezervace se nepodařilo uložit.");
}

/** Cancel a reservation, recording who/why. */
export async function cancelReservation(params: {
  id: string;
  reason?: string;
  byAdminId?: string;
}): Promise<void> {
  return withReservationLock(params.id, () => cancelReservationLocked(params));
}

async function cancelReservationLocked(params: {
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
  const revocations = await Promise.allSettled(
    codes.map((code) => revokeAccessCode(code.id)),
  );
  if (revocations.some((result) => result.status === "rejected")) {
    await raiseAlert({
      severity: "critical",
      dedupeKey: `code-revocation:${params.id}`,
      title: "Vstupní kód zrušené rezervace se nepodařilo odebrat",
      body: "Rezervace je zrušená, ale kód může být stále platný. Zkontrolujte zámek Nuki.",
      context: { reservationId: params.id },
    });
  }
}

/**
 * Cancel reservations the operator is closing (a block placed over a range
 * that already has bookings). Each one takes the full cancellation path, so
 * the reservation lock is held and any access code is revoked; voucher claims
 * are released; and a paid reservation raises a critical alert, because the
 * money has to be returned by hand in the Comgate portal and nothing else
 * would tell the operator that.
 */
export async function cancelReservationsForClosure(
  affected: Reservation[],
  params: { reason: string; byAdminId?: string },
): Promise<void> {
  if (affected.length === 0) return;
  const settled = await db
    .select({
      id: payment.id,
      reservationId: payment.reservationId,
      amountCents: payment.amountCents,
      currency: payment.currency,
    })
    .from(payment)
    .where(
      and(
        inArray(
          payment.reservationId,
          affected.map((row) => row.id),
        ),
        eq(payment.status, "succeeded"),
      ),
    );
  const paidBy = new Map(settled.map((row) => [row.reservationId, row]));

  for (const row of affected) {
    await cancelReservation({
      id: row.id,
      reason: params.reason,
      byAdminId: params.byAdminId,
    });
    await releaseForReservation(row.id);
    const paid = paidBy.get(row.id);
    if (!paid) continue;
    await raiseAlert({
      severity: "critical",
      dedupeKey: `refund-needed:${row.id}`,
      title: "Zrušená zaplacená rezervace vyžaduje vrácení platby",
      body: `Termín ${formatDateTime(row.startsAt)} uzavřel provozovatel. Zákazník zaplatil ${formatMoney(paid.amountCents, paid.currency)}; vraťte platbu v portálu Comgate a dejte mu vědět.`,
      context: {
        reservationId: row.id,
        paymentId: paid.id,
        amountCents: paid.amountCents,
      },
    });
  }
}

/**
 * Give up a checkout hold that its own visitor is replacing with a fresh
 * attempt (they came back to add a voucher, or the hold never reached the
 * gateway). Only a row that is still pending is touched: a payment settling
 * at the same moment confirms the reservation under the same lock, and a
 * confirmed booking is never cancelled here. Returns whether it was released.
 */
export async function releasePendingHold(
  id: string,
  reason: string,
): Promise<boolean> {
  return withReservationLock(id, async () => {
    const now = new Date();
    const [released] = await db
      .update(reservation)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelReason: reason,
        updatedAt: now,
      })
      .where(and(eq(reservation.id, id), eq(reservation.status, "pending")))
      .returning({ id: reservation.id });
    if (!released) return false;
    await releaseForReservation(id);
    return true;
  });
}

/** Release stale Checkout holds so abandoned payments cannot block the gym. */
export async function releaseExpiredPendingReservations(
  now = new Date(),
  holdMinutes = 32,
): Promise<number> {
  const cutoff = pendingHoldCutoff(now, holdMinutes);
  return db.transaction(async (tx) => {
    const released = await tx
      .update(reservation)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelReason: "checkout_expired",
        updatedAt: now,
      })
      .where(
        and(
          eq(reservation.status, "pending"),
          notExists(
            db
              .select({ id: payment.id })
              .from(payment)
              .where(
                and(
                  eq(payment.reservationId, reservation.id),
                  eq(payment.provider, "comgate"),
                  inArray(payment.status, [
                    "pending",
                    "processing",
                    "succeeded",
                  ]),
                ),
              ),
          ),
          lt(reservation.createdAt, cutoff),
        ),
      )
      .returning({ id: reservation.id });

    if (released.length > 0) {
      await tx
        .update(payment)
        .set({
          status: "failed",
          failureReason: "checkout_expired",
          updatedAt: now,
        })
        .where(
          and(
            eq(payment.status, "pending"),
            inArray(
              payment.reservationId,
              released.map((row) => row.id),
            ),
          ),
        );
    }

    return released.length;
  });
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
        eq(reservation.status, "confirmed"),
        gte(reservation.endsAt, new Date()),
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
