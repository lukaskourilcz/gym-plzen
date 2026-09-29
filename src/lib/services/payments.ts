import { randomBytes } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bookingOrder,
  payment,
  reservation,
  systemAlert,
} from "@/lib/db/schema";
import type { BookingOrder, Payment } from "@/lib/db/types";
import { env, publicEnv } from "@/lib/env";
import {
  createComgatePayment,
  getComgatePayment,
  isComgateConfigured,
} from "@/lib/integrations/comgate";
import { ActionError } from "@/lib/helpers/action";
import { hashCode, safeEqual } from "@/lib/helpers/crypto";
import { nextPaymentStatus, paymentMatches } from "@/lib/helpers/payment-state";
import { splitFullName } from "@/lib/helpers/profile";
import { cancelReservation } from "./reservations";
import { getOperations } from "./operations";
import { withReservationLock } from "./operation-lock";
import { processWebhookEvent } from "./webhooks";
import { initPipeline } from "./pipeline";
import { fulfillReservation } from "./fulfillment";
import { redeemForReservation, releaseForReservation } from "./vouchers";
import { deliverPendingAlerts, raiseAlert } from "./alerts";
import { recordIn as recordActivityIn } from "./activity";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import type { BookingOutcome } from "./booking";
import {
  cancelPendingOrderIn,
  confirmOrderIn,
  getOrder,
  listOrderReservations,
  releasePendingOrder,
  withOrderLock,
} from "./order-state";

/** What starting or continuing an order's checkout hands back to the page. */
export type OrderOutcome =
  | { kind: "free" | "processing"; orderId: string; token?: string }
  | {
      kind: "checkout";
      url: string;
      orderId: string;
      totalCents: number;
      /** A guest's proof of ownership, for the hold cookie; absent on resumes. */
      token?: string;
    };

const ACTIVE_ATTEMPT = ["pending", "processing", "succeeded"] as const;

/** Czech gateway description: the customer sees it on the payment page. */
export function orderPaymentDescription(slotCount: number): string {
  return slotCount === 1
    ? "Jednorázový vstup | NAVI Private Gym"
    : `Vstupy (${slotCount}×) | NAVI Private Gym`;
}

function ownsOrder(
  order: BookingOrder,
  userId: string | null,
  token: string | undefined,
): boolean {
  if (userId && order.userId === userId) return true;
  return Boolean(
    !order.userId &&
    token &&
    order.confirmationTokenHash &&
    safeEqual(hashCode(token), order.confirmationTokenHash),
  );
}

/**
 * One Comgate payment for the whole order. As with a single reservation, the
 * attempt is persisted before the gateway is called, and an unknown response
 * keeps it active so a double click or a restart can never charge twice.
 */
export async function startOrderPayment(params: {
  orderId: string;
  userId: string | null;
  token?: string;
}): Promise<OrderOutcome> {
  return withOrderLock(params.orderId, async () => {
    const order = await getOrder(params.orderId);
    if (!order || !ownsOrder(order, params.userId, params.token))
      throw new ActionError("Objednávku se nepodařilo najít.");
    const slots = await listOrderReservations(order.id);
    if (
      order.status !== "pending" ||
      order.totalCents <= 0 ||
      !order.contactEmail ||
      slots.length === 0 ||
      slots.some((slot) => slot.status !== "pending") ||
      slots[0]!.startsAt <= new Date()
    )
      throw new ActionError("Tuto objednávku nelze uhradit.");
    if (!(await getOperations()).paymentsEnabled || !isComgateConfigured())
      throw new ActionError(
        "Online platby se připravují. Rezervace je platná pouze po úhradě.",
      );
    const [existing] = await db
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.orderId, order.id),
          eq(payment.provider, "comgate"),
          inArray(payment.status, [...ACTIVE_ATTEMPT]),
        ),
      )
      .limit(1);
    if (existing) {
      if (existing.gatewayUrl && existing.status !== "succeeded")
        return {
          kind: "checkout",
          url: existing.gatewayUrl,
          orderId: order.id,
          totalCents: existing.amountCents,
          token: params.token,
        };
      return { kind: "processing", orderId: order.id, token: params.token };
    }
    const token = params.token ?? randomBytes(32).toString("hex");
    const [attempt] = await db
      .insert(payment)
      .values({
        userId: order.userId,
        orderId: order.id,
        type: "one_off",
        status: "processing",
        amountCents: order.totalCents,
        currency: order.currency,
        provider: "comgate",
        providerMerchantId: env.COMGATE_MERCHANT_ID,
        providerEnvironment: env.COMGATE_TEST_MODE,
        failureReason: "creation_pending",
      })
      .returning();
    if (!attempt) throw new Error("Payment attempt missing");
    const outcome = await createComgatePayment({
      orderNumber: attempt.id,
      amountMinor: order.totalCents,
      payer: {
        email: order.contactEmail,
        ...splitFullName(order.contactName ?? ""),
        ...(order.contactPhone ? { phone: order.contactPhone } : {}),
      },
      description: orderPaymentDescription(slots.length),
      returnUrl: `${publicEnv.NEXT_PUBLIC_APP_URL}/rezervace/hotovo?order_id=${order.id}&token=${token}`,
    });
    if (!outcome.created) {
      await db
        .update(payment)
        .set({
          status: outcome.ambiguous ? "processing" : "failed",
          failureReason: outcome.ambiguous ? "creation_unknown" : outcome.error,
          lastCheckedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payment.id, attempt.id));
      if (outcome.ambiguous) {
        await raiseAlert({
          severity: "critical",
          dedupeKey: `payment-unknown:${attempt.id}`,
          title: "Výsledek založení platby není známý",
          body: "Ověřte pokus v Comgate podle reference. Aplikace další platbu automaticky nezaloží.",
          context: { paymentId: attempt.id, orderId: order.id },
        });
        return { kind: "processing", orderId: order.id, token };
      }
      await releasePendingOrder(order.id, "payment_creation_failed");
      throw new ActionError(
        "Platbu se nepodařilo zahájit. Termíny jsme uvolnili, zkuste rezervaci znovu.",
      );
    }
    await db
      .update(payment)
      .set({
        providerPaymentId: outcome.payment.id,
        gatewayUrl: outcome.payment.gwUrl,
        status: "pending",
        failureReason: null,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payment.id, attempt.id));
    return {
      kind: "checkout",
      url: outcome.payment.gwUrl!,
      orderId: order.id,
      totalCents: order.totalCents,
      token,
    };
  });
}

export type OrderResumeOutcome =
  | { state: "checkout"; outcome: OrderOutcome }
  | { state: "processing" }
  | { state: "none" };

/**
 * Continue the checkout of an order the booking flow has matched to the
 * visitor by contact e-mail, without a token. Creates nothing, so it can never
 * charge twice; see `resumeReservationCheckout` for the single-slot original.
 */
export async function resumeOrderCheckout(
  orderId: string,
): Promise<OrderResumeOutcome> {
  return withOrderLock(orderId, async () => {
    const order = await getOrder(orderId);
    if (!order || order.status !== "pending") return { state: "none" };
    const [attempt] = await db
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.orderId, order.id),
          eq(payment.provider, "comgate"),
          inArray(payment.status, ["pending", "processing"]),
        ),
      )
      .limit(1);
    if (!attempt) return { state: "none" };
    if (attempt.status === "pending" && attempt.gatewayUrl)
      return {
        state: "checkout",
        outcome: {
          kind: "checkout",
          url: attempt.gatewayUrl,
          orderId: order.id,
          totalCents: attempt.amountCents,
        },
      };
    return { state: "processing" };
  });
}

/**
 * Whether a checkout still has a gateway session that could be paid: a
 * `pending` attempt (the customer may complete it in another tab) or a
 * `processing` one whose outcome is unknown. Such a hold must not be released
 * and replaced, or one person can pay for the same slots twice.
 */
export async function hasOpenOrderPayment(orderId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: payment.id })
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.provider, "comgate"),
        inArray(payment.status, ["pending", "processing"]),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** An attempt whose creation at the gateway timed out with no answer. */
export async function hasUnknownPaymentCreation(
  orderId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: payment.id })
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.status, "processing"),
        eq(payment.failureReason, "creation_unknown"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** The single-reservation counterpart of `hasOpenOrderPayment`. */
export async function hasOpenReservationPayment(
  reservationId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: payment.id })
    .from(payment)
    .where(
      and(
        eq(payment.reservationId, reservationId),
        eq(payment.provider, "comgate"),
        inArray(payment.status, ["pending", "processing"]),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Ask the gateway about an order's open payment; failures wait for the watchdog. */
export async function refreshOrderPayment(orderId: string) {
  const [row] = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.provider, "comgate"),
        inArray(payment.status, ["pending", "processing"]),
      ),
    )
    .orderBy(desc(payment.createdAt))
    .limit(1);
  if (row?.providerPaymentId) {
    try {
      await synchronizeComgatePayment(row.providerPaymentId);
    } catch {
      /* Status stays pending; watchdog retries. */
    }
  }
}

/** Persist the attempt before any external side effect. An unknown response
 * keeps the attempt active so double clicks/restarts cannot charge twice. */
export async function startReservationPayment(params: {
  reservationId: string;
  userId: string | null;
  token?: string;
}): Promise<BookingOutcome> {
  return withReservationLock(params.reservationId, async () => {
    const [row] = await db
      .select()
      .from(reservation)
      .where(eq(reservation.id, params.reservationId));
    const owns = params.userId && row?.userId === params.userId;
    const tokenMatches =
      !row?.userId &&
      params.token &&
      row?.confirmationTokenHash &&
      safeEqual(hashCode(params.token), row.confirmationTokenHash);
    if (!row || (!owns && !tokenMatches))
      throw new ActionError("Rezervaci se nepodařilo najít.");
    if (
      row.status !== "pending" ||
      row.startsAt <= new Date() ||
      !row.priceCents ||
      !row.contactEmail
    )
      throw new ActionError("Tuto rezervaci nelze uhradit.");
    if (!(await getOperations()).paymentsEnabled || !isComgateConfigured())
      throw new ActionError(
        "Online platby se připravují. Rezervace je platná pouze po úhradě.",
      );
    const [existing] = await db
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.reservationId, row.id),
          eq(payment.provider, "comgate"),
          inArray(payment.status, ["pending", "processing", "succeeded"]),
        ),
      )
      .limit(1);
    if (existing) {
      if (existing.gatewayUrl && existing.status !== "succeeded")
        return {
          kind: "checkout",
          url: existing.gatewayUrl,
          reservationId: row.id,
          priceCents: existing.amountCents,
          token: params.token,
        };
      return { kind: "processing", reservationId: row.id, token: params.token };
    }
    // Authenticated repeat payment has no guest token and does not need one.
    const token = params.token ?? randomBytes(32).toString("hex");
    const [attempt] = await db
      .insert(payment)
      .values({
        userId: row.userId,
        reservationId: row.id,
        type: "one_off",
        status: "processing",
        amountCents: row.priceCents,
        currency: row.currency,
        provider: "comgate",
        providerMerchantId: env.COMGATE_MERCHANT_ID,
        providerEnvironment: env.COMGATE_TEST_MODE,
        failureReason: "creation_pending",
      })
      .returning();
    if (!attempt) throw new Error("Payment attempt missing");
    const outcome = await createComgatePayment({
      orderNumber: attempt.id,
      amountMinor: row.priceCents,
      payer: {
        email: row.contactEmail,
        ...splitFullName(row.contactName ?? ""),
        ...(row.contactPhone ? { phone: row.contactPhone } : {}),
      },
      description: "Jednorázový vstup | NAVI Private Gym",
      returnUrl: `${publicEnv.NEXT_PUBLIC_APP_URL}/rezervace/hotovo?reservation_id=${row.id}&token=${token}`,
    });
    if (!outcome.created) {
      await db
        .update(payment)
        .set({
          status: outcome.ambiguous ? "processing" : "failed",
          failureReason: outcome.ambiguous ? "creation_unknown" : outcome.error,
          lastCheckedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payment.id, attempt.id));
      if (outcome.ambiguous) {
        await raiseAlert({
          severity: "critical",
          dedupeKey: `payment-unknown:${attempt.id}`,
          title: "Výsledek založení platby není známý",
          body: "Ověřte pokus v Comgate podle reference. Aplikace další platbu automaticky nezaloží.",
          context: { paymentId: attempt.id, reservationId: row.id },
        });
        return { kind: "processing", reservationId: row.id, token };
      }
      await cancelReservation({
        id: row.id,
        reason: "payment_creation_failed",
      });
      await releaseForReservation(row.id);
      throw new ActionError(
        "Platbu se nepodařilo zahájit. Termín jsme uvolnili, zkuste rezervaci znovu.",
      );
    }
    await db
      .update(payment)
      .set({
        providerPaymentId: outcome.payment.id,
        gatewayUrl: outcome.payment.gwUrl,
        status: "pending",
        failureReason: null,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payment.id, attempt.id));
    return {
      kind: "checkout",
      url: outcome.payment.gwUrl!,
      reservationId: row.id,
      priceCents: row.priceCents,
      token,
    };
  });
}

export type ResumeOutcome =
  | { state: "checkout"; outcome: BookingOutcome }
  /** An attempt exists whose result the gateway has not settled yet. */
  | { state: "processing" }
  /** Nothing to continue: the hold is gone, or never reached the gateway. */
  | { state: "none" };

/**
 * Continue the checkout of a hold that `startBooking` has already matched to
 * the visitor. Unlike `startReservationPayment` this needs no token: a guest
 * who came back from the gateway without the hold cookie no longer has one,
 * and the match by contact e-mail is the identity the hold was created with.
 * Nothing is created here, so it can never charge twice.
 */
export async function resumeReservationCheckout(
  reservationId: string,
): Promise<ResumeOutcome> {
  return withReservationLock(reservationId, async () => {
    const [row] = await db
      .select()
      .from(reservation)
      .where(eq(reservation.id, reservationId));
    if (!row || row.status !== "pending" || row.startsAt <= new Date())
      return { state: "none" };
    const [attempt] = await db
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.reservationId, row.id),
          eq(payment.provider, "comgate"),
          inArray(payment.status, ["pending", "processing"]),
        ),
      )
      .limit(1);
    if (!attempt) return { state: "none" };
    if (attempt.status === "pending" && attempt.gatewayUrl)
      return {
        state: "checkout",
        outcome: {
          kind: "checkout",
          url: attempt.gatewayUrl,
          reservationId: row.id,
          priceCents: attempt.amountCents,
        },
      };
    return { state: "processing" };
  });
}

/** An authenticated API status, not callback/redirect fields, is authoritative. */
export async function synchronizeComgatePayment(
  providerId: string,
): Promise<boolean> {
  const [known] = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.provider, "comgate"),
        eq(payment.providerPaymentId, providerId),
      ),
    )
    .limit(1);
  // Never let a public callback trigger arbitrary provider lookups.
  if (!known?.reservationId && !known?.orderId) return false;
  if (
    !isComgateConfigured() ||
    known.providerMerchantId !== env.COMGATE_MERCHANT_ID ||
    known.providerEnvironment !== env.COMGATE_TEST_MODE
  )
    throw new Error("Payment environment mismatch");
  if (known.orderId)
    return synchronizeOrderPayment(known, known.orderId, providerId);
  const reservationId = known.reservationId!;
  return withReservationLock(reservationId, async () => {
    const outcome = await getComgatePayment(providerId);
    if (!outcome.found) throw new Error("Payment status unavailable");
    if (!paymentMatches(known, outcome.payment))
      throw new Error("Payment identity or amount mismatch");
    const snapshot = outcome.payment;
    await processWebhookEvent(
      {
        provider: "comgate",
        eventId: `${snapshot.id}:${snapshot.state}`,
        payload: { paymentId: known.id, state: snapshot.state },
      },
      async (tx) => {
        const [current] = await tx
          .select()
          .from(payment)
          .where(eq(payment.id, known.id))
          .for("update");
        const [booking] = await tx
          .select()
          .from(reservation)
          .where(eq(reservation.id, known.reservationId!))
          .for("update");
        if (!current || !booking || !paymentMatches(current, snapshot))
          throw new Error("Payment binding changed");
        const status = nextPaymentStatus(current.status, snapshot.state);
        await tx
          .update(payment)
          .set({
            status,
            paidAt:
              status === "succeeded"
                ? (current.paidAt ?? new Date())
                : current.paidAt,
            failureReason: status === "failed" ? snapshot.state : null,
            updatedAt: new Date(),
            lastCheckedAt: new Date(),
          })
          .where(eq(payment.id, current.id));
        if (status === "succeeded") {
          if (booking.status === "pending" && booking.endsAt > new Date()) {
            await tx
              .update(reservation)
              .set({ status: "confirmed", updatedAt: new Date() })
              .where(eq(reservation.id, booking.id));
            await redeemForReservation(booking.id, tx);
            await initPipeline(booking.id, tx);
            await recordActivityIn(tx, {
              action: "reservation.confirmed",
              actorType: "system",
              actorLabel: "Comgate",
              memberId: booking.userId,
              reservationId: booking.id,
              summary: `Platba ${formatMoney(current.amountCents, current.currency)} přijata (Comgate ${snapshot.id}), rezervace na ${formatDateTime(booking.startsAt)} potvrzena.`,
              context: {
                paymentId: current.id,
                providerPaymentId: snapshot.id,
              },
            });
          } else if (
            booking.status !== "confirmed" &&
            booking.status !== "completed"
          ) {
            await tx.insert(systemAlert).values({
              severity: "critical",
              dedupeKey: `late-payment:${current.id}`,
              title: "Platba přišla k neplatné rezervaci",
              body: "Ověřte platbu a domluvte vrácení nebo náhradní termín. Původní slot se automaticky neobnovil.",
              context: { paymentId: current.id, reservationId: booking.id },
            });
          }
        } else if (status === "failed" && booking.status === "pending") {
          await tx
            .update(reservation)
            .set({
              status: "cancelled",
              cancelReason: "payment_cancelled",
              cancelledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(reservation.id, booking.id));
          await releaseForReservation(booking.id, tx);
          await recordActivityIn(tx, {
            action: "reservation.cancelled",
            actorType: "system",
            actorLabel: "Comgate",
            memberId: booking.userId,
            reservationId: booking.id,
            summary: `Platba neproběhla (Comgate ${snapshot.id}: ${snapshot.state}), rezervace na ${formatDateTime(booking.startsAt)} zrušena.`,
            context: { paymentId: current.id, providerPaymentId: snapshot.id },
          });
        }
      },
    );
    // A repeated unchanged status must still move the watchdog's cursor.
    await db
      .update(payment)
      .set({ lastCheckedAt: new Date() })
      .where(eq(payment.id, known.id));
    // A late-payment alert is written inside the ledger transaction; send it
    // now that it is committed.
    await deliverPendingAlerts();
    // Durable pipeline exists even if this process dies here. Retries can run it.
    if (snapshot.state === "PAID")
      await fulfillReservation(known.reservationId!);
    return true;
  });
}

/**
 * The order counterpart of the reservation branch above: one payment settles
 * every slot of the order in one transaction, or none of them. There is no
 * partial confirmation; a payment arriving for an order that can no longer be
 * confirmed as a whole raises the late-payment alert instead.
 */
async function synchronizeOrderPayment(
  known: Payment,
  orderId: string,
  providerId: string,
): Promise<boolean> {
  const paid = await withOrderLock(orderId, async () => {
    const outcome = await getComgatePayment(providerId);
    if (!outcome.found) throw new Error("Payment status unavailable");
    if (!paymentMatches(known, outcome.payment))
      throw new Error("Payment identity or amount mismatch");
    const snapshot = outcome.payment;
    await processWebhookEvent(
      {
        provider: "comgate",
        eventId: `${snapshot.id}:${snapshot.state}`,
        payload: { paymentId: known.id, state: snapshot.state },
      },
      async (tx) => {
        const [current] = await tx
          .select()
          .from(payment)
          .where(eq(payment.id, known.id))
          .for("update");
        const [order] = await tx
          .select()
          .from(bookingOrder)
          .where(eq(bookingOrder.id, orderId))
          .for("update");
        if (!current || !order || !paymentMatches(current, snapshot))
          throw new Error("Payment binding changed");
        const slots = await tx
          .select()
          .from(reservation)
          .where(eq(reservation.orderId, orderId))
          .orderBy(asc(reservation.startsAt))
          .for("update");
        const status = nextPaymentStatus(current.status, snapshot.state);
        await tx
          .update(payment)
          .set({
            status,
            paidAt:
              status === "succeeded"
                ? (current.paidAt ?? new Date())
                : current.paidAt,
            failureReason: status === "failed" ? snapshot.state : null,
            updatedAt: new Date(),
            lastCheckedAt: new Date(),
          })
          .where(eq(payment.id, current.id));
        const when = slots.map((slot) => formatDateTime(slot.startsAt));
        if (status === "succeeded") {
          const confirmable =
            order.status === "pending" &&
            slots.length > 0 &&
            slots.every(
              (slot) => slot.status === "pending" && slot.endsAt > new Date(),
            );
          if (confirmable) {
            const confirmed = await confirmOrderIn(tx, orderId);
            for (const slot of confirmed)
              await recordActivityIn(tx, {
                action: "reservation.confirmed",
                actorType: "system",
                actorLabel: "Comgate",
                memberId: slot.userId,
                reservationId: slot.id,
                summary: `Platba ${formatMoney(current.amountCents, current.currency)} za objednávku ${slots.length > 1 ? `${slots.length} termínů ` : ""}přijata (Comgate ${snapshot.id}), rezervace na ${formatDateTime(slot.startsAt)} potvrzena.`,
                context: {
                  orderId,
                  paymentId: current.id,
                  providerPaymentId: snapshot.id,
                },
              });
          } else if (order.status !== "confirmed") {
            await tx.insert(systemAlert).values({
              severity: "critical",
              dedupeKey: `late-payment:${current.id}`,
              title: "Platba přišla k neplatné objednávce",
              body: `Objednávka termínů ${when.join(", ")} už není celá volná. Ověřte platbu a domluvte vrácení nebo náhradní termíny. Termíny se automaticky neobnovily.`,
              context: { paymentId: current.id, orderId },
            });
          }
        } else if (status === "failed" && order.status === "pending") {
          const released = await cancelPendingOrderIn(
            tx,
            orderId,
            "payment_cancelled",
          );
          for (const slot of released)
            await recordActivityIn(tx, {
              action: "reservation.cancelled",
              actorType: "system",
              actorLabel: "Comgate",
              memberId: slot.userId,
              reservationId: slot.id,
              summary: `Platba za objednávku neproběhla (Comgate ${snapshot.id}: ${snapshot.state}), rezervace na ${formatDateTime(slot.startsAt)} zrušena.`,
              context: {
                orderId,
                paymentId: current.id,
                providerPaymentId: snapshot.id,
              },
            });
        }
      },
    );
    await db
      .update(payment)
      .set({ lastCheckedAt: new Date() })
      .where(eq(payment.id, known.id));
    await deliverPendingAlerts();
    return snapshot.state === "PAID";
  });
  // Fulfilment runs after the order lock is released: it takes each slot's
  // lock and the order-fulfilment lock, and holding three pooled lock
  // connections per confirmation could exhaust the pool. Everything it needs
  // is already committed, and the watchdog retries it if this process dies.
  if (paid)
    for (const slot of await listOrderReservations(orderId))
      if (slot.status === "confirmed") await fulfillReservation(slot.id);
  return true;
}

export async function refreshReservationPayment(reservationId: string) {
  const [row] = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.reservationId, reservationId),
        eq(payment.provider, "comgate"),
        inArray(payment.status, ["pending", "processing"]),
      ),
    )
    .orderBy(desc(payment.createdAt))
    .limit(1);
  if (row?.providerPaymentId) {
    try {
      await synchronizeComgatePayment(row.providerPaymentId);
    } catch {
      /* Status stays pending; watchdog retries. */
    }
  }
}

/** Polling recovers missed notifications and a worker crash after persisting
 * provider ID. Ambiguous creation without an ID remains an explicit alert. */
export async function reconcilePendingPayments(limit = 10) {
  if (!isComgateConfigured()) return 0;
  const unknown = await db
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.provider, "comgate"),
        isNull(payment.providerPaymentId),
        inArray(payment.status, ["pending", "processing"]),
        lt(payment.createdAt, new Date(Date.now() - 5 * 60_000)),
        or(
          isNull(payment.lastCheckedAt),
          lt(payment.lastCheckedAt, new Date(Date.now() - 60_000)),
        ),
      ),
    )
    .orderBy(asc(payment.lastCheckedAt))
    .limit(limit);
  for (const attempt of unknown) {
    await raiseAlert({
      severity: "critical",
      dedupeKey: `payment-unknown:${attempt.id}`,
      title: "Výsledek založení platby není známý",
      body: "Ověřte pokus v Comgate podle reference. Bez ověření nezakládejte další platbu ani neuvolňujte termín.",
      context: {
        paymentId: attempt.id,
        reservationId: attempt.reservationId,
        orderId: attempt.orderId,
      },
    });
    await db
      .update(payment)
      .set({ lastCheckedAt: new Date() })
      .where(eq(payment.id, attempt.id));
  }
  const rows = await db
    .select({
      id: payment.providerPaymentId,
      localId: payment.id,
      createdAt: payment.createdAt,
    })
    .from(payment)
    .where(
      and(
        eq(payment.provider, "comgate"),
        isNotNull(payment.providerPaymentId),
        inArray(payment.status, ["pending", "processing"]),
        or(
          isNull(payment.lastCheckedAt),
          lt(payment.lastCheckedAt, new Date(Date.now() - 60_000)),
        ),
      ),
    )
    .orderBy(asc(payment.lastCheckedAt))
    .limit(limit);
  let completed = 0;
  for (const row of rows)
    if (row.id) {
      try {
        await synchronizeComgatePayment(row.id);
        completed++;
      } catch {
        // Rotate failures too: one unavailable transaction must not starve others.
        await db
          .update(payment)
          .set({ lastCheckedAt: new Date() })
          .where(eq(payment.id, row.localId));
        // A gateway session lasts 30 minutes. Still unsettled well after that,
        // the attempt cannot be matched (changed merchant or test mode, a
        // mismatched amount) and would hold its slots forever unnoticed.
        if (row.createdAt < new Date(Date.now() - 45 * 60_000))
          await raiseAlert({
            severity: "critical",
            dedupeKey: `payment-sync:${row.localId}`,
            title: "Platbu se nedaří ověřit v Comgate",
            body: "Stav platby se ani po 45 minutách nepodařilo ověřit. Zkontrolujte platbu v Comgate podle reference; termíny zůstávají blokované, dokud se stav nevyjasní.",
            context: { paymentId: row.localId, providerPaymentId: row.id },
          });
      }
    }
  return completed;
}
