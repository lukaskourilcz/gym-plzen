import { deliverCancellation } from "./cancellation-delivery";
import { raiseAlert } from "./alerts";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { withReservationLock } from "./operation-lock";
import {
  invoice,
  payment,
  reservation,
  messageDelivery,
  profiles,
} from "@/lib/db/schema";
import { recordIn as recordActivityIn } from "./activity";
import type { NewReservation, Reservation } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";
import { PG_EXCLUSION_VIOLATION, pgErrorCode } from "@/lib/helpers/pg-error";
import { checkAvailability } from "./availability";
import { initPipeline } from "./pipeline";
import {
  listCodesForReservation,
  revokeAccessCode,
  requestCodeRevocations,
} from "./access-codes";
import { releaseForReservation } from "./vouchers";
import { cancelOrdersOfReleased } from "./order-state";
import { notifyReservationCancelled } from "./operator-notifications";
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
  /** The checkout this slot belongs to; absent for admin walk-ins. */
  orderId?: string | null;
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
    orderId: input.orderId ?? null,
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
    if (pgErrorCode(error) === PG_EXCLUSION_VIOLATION) {
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
  // Read it before it changes: only a confirmed reservation disappearing is
  // news for the operator. A pending hold that expired or a rejected voucher
  // is the system tidying up after itself.
  const before = await getReservation(params.id);
  await requestCodeRevocations(params.id);
  if (!before) return;
  const [member] = before.userId
    ? await db
        .select({ email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, before.userId))
    : [];
  const email = before.contactEmail ?? member?.email;
  await db.transaction(async (tx) => {
    await tx
      .update(reservation)
      .set({
        status: "cancelled",
        cancelledAt: before.cancelledAt ?? new Date(),
        cancelReason:
          before.status === "cancelled"
            ? before.cancelReason
            : (params.reason ?? null),
        updatedAt: new Date(),
      })
      .where(eq(reservation.id, params.id));
    if (before.status === "confirmed" && email) {
      await tx
        .insert(messageDelivery)
        .values({
          reservationId: before.id,
          userId: before.userId,
          channel: "email",
          kind: "reservation_cancellation",
          recipient: email,
          dedupeKey: `cancellation/${before.id}`,
          status: "queued",
        })
        .onConflictDoNothing();
    }
  });
  await releaseForReservation(params.id);
  // One payment can cover a whole order; only this slot's share is at stake.
  const [paid] = await db
    .select()
    .from(payment)
    .where(
      and(
        before.orderId
          ? or(
              eq(payment.reservationId, params.id),
              eq(payment.orderId, before.orderId),
            )
          : eq(payment.reservationId, params.id),
        eq(payment.status, "succeeded"),
      ),
    )
    .limit(1);
  const paidForSlot = paid
    ? paid.orderId
      ? (before.priceCents ?? 0)
      : paid.amountCents
    : 0;
  if (paid && paidForSlot > 0)
    await raiseAlert({
      severity: "critical",
      dedupeKey: `refund-needed:${params.id}`,
      title: "Zrušená zaplacená rezervace vyžaduje vrácení platby",
      body: `Rezervace na ${formatDateTime(before.startsAt)} byla zrušena. Zákazník za ni zaplatil ${formatMoney(paidForSlot, paid.currency)}${paid.orderId ? ` jako součást objednávky za ${formatMoney(paid.amountCents, paid.currency)}` : ""}; ověřte nárok a stav refundace v Comgate. Samotné storno platbu nevrací.`,
      context: {
        reservationId: params.id,
        paymentId: paid.id,
        orderId: paid.orderId,
        amountCents: paidForSlot,
      },
    });
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
  await deliverCancellation(params.id);
  if (before?.status === "confirmed")
    await notifyReservationCancelled({
      reservation: before,
      reason: params.reason,
    });
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
                  or(
                    eq(payment.reservationId, reservation.id),
                    and(
                      isNotNull(reservation.orderId),
                      eq(payment.orderId, reservation.orderId),
                    ),
                  ),
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
      .returning({
        id: reservation.id,
        userId: reservation.userId,
        orderId: reservation.orderId,
        startsAt: reservation.startsAt,
      });

    for (const row of released) {
      await recordActivityIn(tx, {
        action: "reservation.cancelled",
        actorType: "system",
        actorLabel: "Watchdog",
        memberId: row.userId,
        reservationId: row.id,
        summary: `Rezervace na ${formatDateTime(row.startsAt)} zrušena: platba nebyla zahájena do ${holdMinutes} minut.`,
        occurredAt: now,
      });
    }

    // An order's slots share one creation time and one payment, so they are
    // released together; the order follows them, voucher claims included.
    await cancelOrdersOfReleased(
      tx,
      [
        ...new Set(
          released.flatMap((row) => (row.orderId ? [row.orderId] : [])),
        ),
      ],
      "checkout_expired",
      now,
    );
    for (const row of released)
      if (!row.orderId) await releaseForReservation(row.id, tx);

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

/** One reservation with what the administration wants to see beside it. */
export interface ReservationHistoryRow extends Reservation {
  paymentStatus: string | null;
  voucherCode: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  rescheduled: boolean;
  /** Slots in this reservation's order; 0 for a reservation bought alone. */
  orderSlots: number;
}

/**
 * A member's complete reservation history for the administration: every
 * status, newest visit first, with the last payment attempt, the voucher that
 * priced it, the issued document and whether the term was moved.
 */
export async function listHistoryForUser(
  userId: string,
  limit = 200,
): Promise<ReservationHistoryRow[]> {
  const rows = await db
    .select({
      reservation,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      paymentStatus: sql<
        string | null
      >`(select p.status::text from public.payment p where p.reservation_id = ${reservation.id} or (${reservation.orderId} is not null and p.order_id = ${reservation.orderId}) order by p.created_at desc, p.id desc limit 1)`,
      voucherCode: sql<
        string | null
      >`(select v.code from public.voucher_redemption vr join public.voucher v on v.id = vr.voucher_id where (vr.reservation_id = ${reservation.id} or (${reservation.orderId} is not null and vr.order_id = ${reservation.orderId})) and vr.status = 'redeemed' limit 1)`,
      rescheduled: sql<boolean>`exists (select 1 from public.reservation_reschedule rr where rr.reservation_id = ${reservation.id})`,
      orderSlots: sql<number>`(select count(*) from public.reservation o where ${reservation.orderId} is not null and o.order_id = ${reservation.orderId})::int`,
    })
    .from(reservation)
    // A slot of an order shares the order's one document.
    .leftJoin(
      invoice,
      or(
        eq(invoice.reservationId, reservation.id),
        and(
          isNotNull(reservation.orderId),
          eq(invoice.orderId, reservation.orderId),
        ),
      ),
    )
    .where(eq(reservation.userId, userId))
    .orderBy(desc(reservation.startsAt), desc(reservation.id))
    .limit(limit);
  return rows.map((row) => ({
    ...row.reservation,
    paymentStatus: row.paymentStatus,
    voucherCode: row.voucherCode,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoiceNumber,
    rescheduled: Boolean(row.rescheduled),
    orderSlots: Number(row.orderSlots ?? 0),
  }));
}

/** How many slots each of the given orders holds, for list annotations. */
export async function countOrderSlots(
  orderIds: readonly string[],
): Promise<Map<string, number>> {
  if (orderIds.length === 0) return new Map();
  const rows = await db
    .select({ orderId: reservation.orderId, value: sql<number>`count(*)::int` })
    .from(reservation)
    .where(inArray(reservation.orderId, [...orderIds]))
    .groupBy(reservation.orderId);
  return new Map(
    rows.flatMap((row) =>
      row.orderId ? [[row.orderId, Number(row.value)] as const] : [],
    ),
  );
}

/** Most recent reservations (admin list view). */
export async function listRecent(limit = 100): Promise<Reservation[]> {
  return db
    .select()
    .from(reservation)
    .orderBy(desc(reservation.startsAt))
    .limit(limit);
}
