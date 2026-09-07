import { and, desc, eq, gt, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import {
  accessCode,
  payment,
  reservation,
  reservationPipeline,
} from "@/lib/db/schema";
import type { NewReservation, Reservation } from "@/lib/db/types";
import { databaseErrorCode } from "@/lib/helpers/database-error";
import { withReservationOperation } from "./reservation-operations";
import { releaseForReservation } from "./vouchers";
import { raiseAlert } from "./alerts";
import { sendReservationClosure } from "./notifications";
import { logger } from "@/lib/helpers/logger";
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
  tx?: Transaction,
): Promise<Reservation> {
  if (!tx)
    return db.transaction((transaction) =>
      createReservation(input, transaction),
    );
  await tx.execute(sql`select pg_advisory_xact_lock_shared(721834001)`);
  const availability = await checkAvailability(input.startsAt, input.endsAt, {
    database: tx,
  });
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
    [created] = await tx.insert(reservation).values(values).returning();
  } catch (error) {
    const code = databaseErrorCode(error);
    if (code === "23P01") {
      throw new ActionError(
        "Tento termín právě rezervoval jiný zákazník. Vyberte prosím jiný čas.",
      );
    }
    throw error;
  }
  if (!created) throw new ActionError("Rezervaci se nepodařilo vytvořit.");

  if (created.status === "confirmed") {
    await initPipeline(created.id, tx);
  }

  return created;
}

/** Mark a reservation as confirmed (e.g. after successful payment) and kick off the pipeline. */
export async function confirmReservation(id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [snapshot] = await tx
      .select()
      .from(reservation)
      .where(eq(reservation.id, id))
      .limit(1);
    if (snapshot?.userId)
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`loyalty:${snapshot.userId}`}))`,
      );
    const [existing] = await tx
      .select()
      .from(reservation)
      .where(eq(reservation.id, id))
      .for("update")
      .limit(1);
    const [updated] = await tx
      .update(reservation)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(and(eq(reservation.id, id), eq(reservation.status, "pending")))
      .returning();
    if (updated || existing?.status === "confirmed") {
      await initPipeline(id, tx);
      return true;
    }
    return false;
  });
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
  onlyIfPending?: boolean;
}): Promise<void> {
  return withReservationOperation(params.id, async () => {
    const current = await getReservation(params.id);
    if (!current) throw new ActionError("Rezervace nebyla nalezena.");
    if (params.onlyIfPending && current.status !== "pending") return;
    const cancelled = await db.transaction(async (tx) => {
      if (current.userId)
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`loyalty:${current.userId}`}))`,
        );
      const [updated] = await tx
        .update(reservation)
        .set({
          status: "cancelled",
          cancelledAt: current.cancelledAt ?? new Date(),
          cancelReason: params.reason ?? current.cancelReason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(reservation.id, params.id),
            params.onlyIfPending
              ? eq(reservation.status, "pending")
              : undefined,
          ),
        )
        .returning({ id: reservation.id });
      if (!updated) return false;
      await tx
        .delete(reservationPipeline)
        .where(eq(reservationPipeline.reservationId, params.id));
      return true;
    });
    if (!cancelled) return;
    await releaseForReservation(params.id);
    const codes = await listCodesForReservation(params.id);
    const revocations = await Promise.allSettled(
      codes.map((code) => revokeAccessCode(code.id)),
    );
    const revocationFailed = revocations.some(
      (result) => result.status === "rejected",
    );
    if (revocationFailed)
      await raiseAlert({
        severity: "critical",
        dedupeKey: `revocation:${params.id}`,
        title: "Zrušená rezervace má neodvolaný vstupní kód",
        body: "Zkontrolujte zámek. Opakujte storno po obnovení připojení.",
        context: { reservationId: params.id },
      });
    if (params.byAdminId && current.status !== "cancelled") {
      await sendReservationClosure({
        userId: current.userId,
        reservationId: current.id,
        name: current.contactName,
        startsAt: current.startsAt,
        email: current.contactEmail,
        phone: current.contactPhone,
        reason: params.reason,
      }).catch((error) =>
        logger.error(error, {
          where: "cancellation.notification",
          reservationId: params.id,
        }),
      );
      const [paid] = await db
        .select({ id: payment.id })
        .from(payment)
        .where(
          and(
            eq(payment.reservationId, params.id),
            eq(payment.status, "succeeded"),
          ),
        )
        .limit(1);
      if (paid)
        await raiseAlert({
          severity: "warning",
          dedupeKey: `refund:${params.id}`,
          title: "Storno zaplacené rezervace: zkontrolujte vrácení platby",
          body: "Storno samo nevrací platbu ve Stripe.",
          context: { reservationId: params.id },
        });
    }
    if (revocationFailed)
      throw new ActionError(
        "Rezervace je zrušená, ale vstupní kód se nepodařilo odvolat. Zkontrolujte zámek a opakujte storno.",
      );
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

/** Retry cancellation cleanup after a temporarily unreachable lock. */
export async function cancellationsAwaitingRevocation(
  limit = 5,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: reservation.id })
    .from(reservation)
    .innerJoin(accessCode, eq(accessCode.reservationId, reservation.id))
    .where(
      and(
        eq(reservation.status, "cancelled"),
        ne(accessCode.status, "revoked"),
        gt(accessCode.validUntil, new Date()),
      ),
    )
    .limit(limit);
  return rows.map((row) => row.id);
}
