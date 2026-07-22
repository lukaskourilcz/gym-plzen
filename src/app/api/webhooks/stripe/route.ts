import { NextResponse, type NextRequest } from "next/server";
import type { Stripe } from "@/lib/integrations/stripe";
import { constructStripeEvent } from "@/lib/integrations/stripe";
import { logger } from "@/lib/helpers/logger";
import {
  markWebhookProcessed,
  recordWebhookEvent,
  releaseWebhookClaim,
} from "@/lib/services/webhooks";
import { memberships, reservations, fulfillment, alerts } from "@/lib/services";

/**
 * Stripe webhook. Verifies the signature, dedupes by event id, and mirrors
 * payment/subscription state into our tables. On a successful one-off payment
 * for a reservation it kicks off fulfillment (code → delivery).
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

  const { isNew } = await recordWebhookEvent({
    provider: "stripe",
    eventId: event.id,
    payload: { type: event.type },
  });
  if (!isNew) return NextResponse.json({ received: true, duplicate: true });

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
      const userId = session.metadata?.userId ?? null;
      if (reservationId) {
        const reservation = await reservations.getReservation(reservationId);
        if (!reservation || !userId || reservation.userId !== userId) {
          throw new Error("Checkout ownership mismatch.");
        }
      }
      await memberships.recordPayment({
        userId,
        reservationId: reservationId ?? null,
        type: session.mode === "subscription" ? "subscription" : "one_off",
        status: "succeeded",
        amountCents: session.amount_total ?? 0,
        currency: session.currency ?? "czk",
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id,
        stripeCheckoutSessionId: session.id,
      });
      if (reservationId) {
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
        await fulfillment.fulfillReservation(reservationId);
      }
      break;
    }

    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await memberships.markCheckoutPaymentFailed(session.id, event.type);
      const reservationId = session.metadata?.reservationId;
      if (reservationId) {
        const reservation = await reservations.getReservation(reservationId);
        if (
          reservation?.status === "pending" &&
          reservation.userId === session.metadata?.userId
        ) {
          await reservations.cancelReservation({
            id: reservationId,
            reason: event.type,
          });
        }
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = (sub.metadata?.userId ?? "") || null;
      if (userId) {
        await memberships.upsertMembershipFromStripe({
          userId,
          stripeSubscriptionId: sub.id,
          status: mapSubscriptionStatus(sub.status),
          currentPeriodStart: toDate(sub.items.data[0]?.current_period_start),
          currentPeriodEnd: toDate(sub.items.data[0]?.current_period_end),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      logger.warn("Stripe invoice payment failed", { invoiceId: invoice.id });
      break;
    }

    default:
      logger.debug("Unhandled Stripe event", { type: event.type });
  }
}

/** Map Stripe subscription status to our membership status enum. */
function mapSubscriptionStatus(
  status: Stripe.Subscription.Status,
): "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "paused" {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    case "paused":
      return "paused";
    default:
      return "incomplete";
  }
}

function toDate(unixSeconds: number | null | undefined): Date | null {
  return typeof unixSeconds === "number" ? new Date(unixSeconds * 1000) : null;
}
