import { NextResponse, type NextRequest } from "next/server";
import type { Stripe } from "@/lib/integrations/stripe";
import { constructStripeEvent } from "@/lib/integrations/stripe";
import { logger } from "@/lib/helpers/logger";
import {
  markWebhookProcessed,
  recordWebhookEvent,
  releaseWebhookClaim,
} from "@/lib/services/webhooks";
import {
  memberships,
  reservations,
  fulfillment,
  alerts,
  vouchers,
} from "@/lib/services";

/**
 * Stripe webhook. Verifies the signature, dedupes by event id, and mirrors
 * one-off payment state into our tables. On a successful reservation payment
 * it kicks off fulfillment (code → delivery).
 *
 * The raw body is required for signature verification, so this route reads
 * `request.text()` and must not use a parsed-body middleware.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = constructStripeEvent(rawBody, signature);
  } catch (e) {
    logger.warn("Stripe signature verification failed", { error: String(e) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const claim = await recordWebhookEvent({
    provider: "stripe",
    eventId: event.id,
    payload: { type: event.type },
  });
  if (!claim.isNew) {
    if (claim.processed) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Another request owns the claim but has not committed success yet. A
    // retry is safer than acknowledging an event that may still fail.
    return NextResponse.json({ error: "handler_in_progress" }, { status: 409 });
  }

  try {
    await handleStripeEvent(event);
    await markWebhookProcessed("stripe", event.id);
  } catch (e) {
    logger.error(e, { where: "stripe.webhook", type: event.type });
    await releaseWebhookClaim("stripe", event.id);
    // 500 so Stripe retries.
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") break;
      const reservationId = session.metadata?.reservationId;
      if (!reservationId) {
        logger.debug("Ignoring Checkout session without reservation metadata", {
          checkoutSessionId: session.id,
        });
        break;
      }
      if (session.mode !== "payment") {
        throw new Error("Reservation checkout must use one-off payment mode.");
      }
      // Guest checkouts carry no `userId`, and their reservation has no owner.
      // Comparing both sides as nullable keeps the invariant intact: the
      // reservation must belong to whoever the session says paid for it.
      const userId = session.metadata?.userId ?? null;
      const [reservation, pendingPayment] = await Promise.all([
        reservations.getReservation(reservationId),
        memberships.getPaymentByCheckoutSessionId(session.id),
      ]);
      if (!reservation || (reservation.userId ?? null) !== userId) {
        throw new Error("Checkout ownership mismatch.");
      }
      const currency = session.currency?.toLowerCase();
      if (
        reservation.priceCents == null ||
        session.amount_total !== reservation.priceCents ||
        currency !== reservation.currency.toLowerCase()
      ) {
        throw new Error("Checkout amount or currency mismatch.");
      }
      if (
        !pendingPayment ||
        pendingPayment.reservationId !== reservationId ||
        (pendingPayment.userId ?? null) !== userId ||
        pendingPayment.type !== "one_off" ||
        pendingPayment.amountCents !== reservation.priceCents ||
        pendingPayment.currency.toLowerCase() !== currency
      ) {
        throw new Error("Checkout does not match the pending payment record.");
      }
      await memberships.recordPayment({
        userId,
        reservationId,
        type: "one_off",
        status: "succeeded",
        amountCents: reservation.priceCents,
        currency,
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id,
        stripeCheckoutSessionId: session.id,
      });
      const confirmed = await reservations.confirmReservation(reservationId);
      if (!confirmed) {
        await alerts.raiseAlert({
          severity: "critical",
          title: "Zaplacenou rezervaci nelze potvrdit",
          body: "Zkontrolujte rezervaci a případně vraťte platbu zákazníkovi.",
          dedupeKey: `paid-reservation-conflict:${reservationId}`,
          context: { reservationId, stripeCheckoutSessionId: session.id },
        });
        break;
      }
      await vouchers.redeemForReservation(reservationId);
      await fulfillment.fulfillReservation(reservationId);
      break;
    }

    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await memberships.markCheckoutPaymentFailed(session.id, event.type);
      const reservationId = session.metadata?.reservationId;
      if (reservationId) {
        await vouchers.releaseForReservation(reservationId);
        const reservation = await reservations.getReservation(reservationId);
        if (
          reservation?.status === "pending" &&
          (reservation.userId ?? null) === (session.metadata?.userId ?? null)
        ) {
          await reservations.cancelReservation({
            id: reservationId,
            reason: event.type,
          });
        }
      }
      break;
    }

    default:
      logger.debug("Unhandled Stripe event", { type: event.type });
  }
}
