import { publicEnv } from "@/lib/public-env";
import { ActionError } from "@/lib/helpers/action";
import { dateKeyInTimeZone } from "@/lib/helpers/datetime";
import {
  isStripeConfigured,
  ensureStripeCustomer,
  createOneOffCheckout,
  stripe,
} from "@/lib/integrations/stripe";
import { checkAvailability } from "./availability";
import {
  createReservation,
  getReservation,
  releaseExpiredPendingReservations,
} from "./reservations";
import { getEntryPriceCents, priceForNextEntry } from "./loyalty";
import { getMember, setStripeCustomerId } from "./members";
import { recordPayment } from "./memberships";
import { fulfillReservation } from "./fulfillment";
import { isWithinBookingHorizon, resolveBookableSlot } from "./slots";

/**
 * Booking service : turns a chosen slot into a reservation and either a Stripe
 * checkout (paid entry) or an immediate confirmation (free loyalty entry).
 *
 * The reservation is created as `pending` before checkout so the slot is held
 * (the DB exclusion constraint prevents anyone else taking it during payment);
 * the Stripe webhook confirms it and runs fulfillment on success.
 */

export type BookingOutcome =
  | { kind: "free"; reservationId: string }
  | { kind: "checkout"; url: string; reservationId: string };

export type BookingConfirmation =
  | {
      state: "confirmed";
      reservationId: string;
      priceCents: number;
      currency: string;
    }
  | { state: "processing"; reservationId: string }
  | { state: "invalid" };

const AVAILABILITY_MESSAGES: Record<string, string> = {
  closed: "Vybraný čas je mimo otevírací dobu.",
  overlap_reservation: "Tento termín je již rezervovaný.",
  overlap_block: "Tento termín je blokovaný.",
  invalid_range: "Neplatný časový rozsah.",
};

/** Details every visitor supplies before paying, member or guest alike. */
export interface BookingDetails {
  name: string;
  email: string;
  /** E.164, already normalised by the action. */
  phone: string;
  /** When the visitor ticked the house rules and the terms of business. */
  acceptedAt: Date;
}

/**
 * Start a booking at the window beginning `startsAt`.
 * - Free (loyalty) entry → creates a confirmed reservation, fulfills it,
 *   returns `{ kind: "free" }`.
 * - Paid entry → creates a pending reservation + a Stripe Checkout session,
 *   returns `{ kind: "checkout", url }`.
 *
 * `userId` is null for a guest booking. A guest pays the standard price and
 * receives their code on the contact details recorded here; loyalty (every
 * n-th entry free) needs an account to count against and stays members-only.
 */
export async function startBooking(params: {
  userId: string | null;
  startsAt: Date;
  details: BookingDetails;
}): Promise<BookingOutcome> {
  await releaseExpiredPendingReservations();
  const startsAt = params.startsAt;
  const resolved = await resolveBookableSlot(startsAt);
  if (!resolved || !isWithinBookingHorizon(dateKeyInTimeZone(startsAt))) {
    throw new ActionError("Vybraný termín není platný.");
  }
  const endsAt = resolved.endsAt;

  if (startsAt.getTime() <= Date.now()) {
    throw new ActionError("Tento čas už nelze rezervovat.");
  }

  const availability = await checkAvailability(startsAt, endsAt);
  if (!availability.available) {
    throw new ActionError(
      AVAILABILITY_MESSAGES[availability.reason ?? "invalid_range"]!,
    );
  }

  const member = params.userId ? await getMember(params.userId) : null;
  if (params.userId && !member) throw new ActionError("Účet nenalezen.");

  // The details typed into the booking form win over the profile: they are what
  // the visitor just confirmed, and they are where the entry code will be sent.
  const contact = {
    contactName: params.details.name,
    contactEmail: params.details.email,
    contactPhone: params.details.phone,
    rulesAcceptedAt: params.details.acceptedAt,
    termsAcceptedAt: params.details.acceptedAt,
  };

  // Loyalty is counted against an account, so a guest always pays.
  const { priceCents, isFree } = params.userId
    ? await priceForNextEntry(params.userId)
    : { priceCents: await getEntryPriceCents(), isFree: false };

  // Free loyalty entry : no payment needed.
  if (isFree) {
    const reservation = await createReservation({
      userId: params.userId,
      startsAt,
      endsAt,
      status: "confirmed",
      ...contact,
      priceCents: 0,
    });
    await fulfillReservation(reservation.id);
    return { kind: "free", reservationId: reservation.id };
  }

  // Paid entry : requires Stripe.
  if (!isStripeConfigured()) {
    throw new ActionError(
      "Platby zatím nejsou nastavené. Zkuste to prosím později.",
    );
  }

  const reservation = await createReservation({
    userId: params.userId,
    startsAt,
    endsAt,
    status: "pending",
    ...contact,
    priceCents,
  });

  // A guest has no Stripe customer to reuse; Checkout collects the receipt
  // address from `customerEmail` instead.
  let customerId: string | undefined;
  if (params.userId && member) {
    customerId = await ensureStripeCustomer({
      existingCustomerId: member.profile?.stripeCustomerId ?? null,
      email: params.details.email,
      name: params.details.name,
      userId: params.userId,
    });
    if (customerId !== member.profile?.stripeCustomerId) {
      await setStripeCustomerId(params.userId, customerId);
    }
  }

  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
  const session = await createOneOffCheckout({
    customerId,
    customerEmail: customerId ? undefined : params.details.email,
    amountCents: priceCents,
    currency: "czk",
    description: "Jednorázový vstup | NAMASTÉ Private Gym",
    successUrl: `${appUrl}/rezervace/hotovo?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/rezervace?date=${dateKeyInTimeZone(startsAt)}&stav=zruseno`,
    // Guests carry no `userId`; the webhook matches an absent one against a
    // reservation with no owner, so the ownership check still holds.
    metadata: {
      reservationId: reservation.id,
      ...(params.userId ? { userId: params.userId } : {}),
    },
    expiresAt: new Date(Date.now() + 31 * 60 * 1000),
  });

  // Record a pending payment linked to the reservation (webhook marks it paid).
  await recordPayment({
    userId: params.userId,
    reservationId: reservation.id,
    type: "one_off",
    status: "pending",
    amountCents: priceCents,
    currency: "czk",
    stripeCheckoutSessionId: session.id,
  });

  if (!session.url) {
    throw new ActionError("Nepodařilo se zahájit platbu.");
  }
  return { kind: "checkout", url: session.url, reservationId: reservation.id };
}

/**
 * Verify success-page parameters against Stripe and reservation ownership.
 *
 * `userId` is null for a guest: the reservation has no owner either, and the
 * unguessable Checkout session id in the redirect is what stands in for one.
 */
export async function getBookingConfirmation(params: {
  userId: string | null;
  stripeSessionId?: string;
  reservationId?: string;
}): Promise<BookingConfirmation> {
  if (params.stripeSessionId && isStripeConfigured()) {
    try {
      const session = await stripe().checkout.sessions.retrieve(
        params.stripeSessionId,
      );
      const reservationId = session.metadata?.reservationId;
      if (
        !reservationId ||
        (session.metadata?.userId ?? null) !== params.userId
      ) {
        return { state: "invalid" };
      }
      const reservation = await getReservation(reservationId);
      if (!reservation || (reservation.userId ?? null) !== params.userId) {
        return { state: "invalid" };
      }
      return session.payment_status === "paid" &&
        reservation.status === "confirmed"
        ? {
            state: "confirmed",
            reservationId,
            priceCents: session.amount_total ?? reservation.priceCents ?? 0,
            currency: session.currency ?? "czk",
          }
        : { state: "processing", reservationId };
    } catch {
      return { state: "invalid" };
    }
  }

  // Free loyalty entries skip Stripe entirely, so they are members-only and
  // identified by the reservation id alone.
  if (params.reservationId && params.userId) {
    const reservation = await getReservation(params.reservationId);
    if (
      reservation?.userId === params.userId &&
      reservation.status === "confirmed" &&
      reservation.priceCents === 0
    ) {
      return {
        state: "confirmed",
        reservationId: reservation.id,
        priceCents: 0,
        currency: "czk",
      };
    }
  }
  return { state: "invalid" };
}
