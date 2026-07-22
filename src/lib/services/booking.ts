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
import { priceForNextEntry } from "./loyalty";
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
  | { state: "confirmed"; reservationId: string }
  | { state: "processing"; reservationId: string }
  | { state: "invalid" };

const AVAILABILITY_MESSAGES: Record<string, string> = {
  closed: "Vybraný čas je mimo otevírací dobu.",
  overlap_reservation: "Tento termín je již rezervovaný.",
  overlap_block: "Tento termín je blokovaný.",
  invalid_range: "Neplatný časový rozsah.",
};

/**
 * Start a booking for `userId` at the hour beginning `startsAt`.
 * - Free (loyalty) entry → creates a confirmed reservation, fulfills it,
 *   returns `{ kind: "free" }`.
 * - Paid entry → creates a pending reservation + a Stripe Checkout session,
 *   returns `{ kind: "checkout", url }`.
 */
export async function startBooking(params: {
  userId: string;
  startsAt: Date;
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

  const member = await getMember(params.userId);
  if (!member) throw new ActionError("Účet nenalezen.");

  const { priceCents, isFree } = await priceForNextEntry(params.userId);

  // Free loyalty entry : no payment needed.
  if (isFree) {
    const reservation = await createReservation({
      userId: params.userId,
      startsAt,
      endsAt,
      status: "confirmed",
      contactName: member.user.name,
      contactEmail: member.user.email,
      contactPhone: member.profile?.phone ?? null,
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
    contactName: member.user.name,
    contactEmail: member.user.email,
    contactPhone: member.profile?.phone ?? null,
    priceCents,
  });

  const customerId = await ensureStripeCustomer({
    existingCustomerId: member.profile?.stripeCustomerId ?? null,
    email: member.user.email,
    name: member.user.name,
    userId: params.userId,
  });
  if (customerId !== member.profile?.stripeCustomerId) {
    await setStripeCustomerId(params.userId, customerId);
  }

  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
  const session = await createOneOffCheckout({
    customerId,
    amountCents: priceCents,
    currency: "czk",
    description: "Jednorázový vstup | NAMASTÉ Private Gym",
    successUrl: `${appUrl}/rezervace/hotovo?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/rezervace?date=${dateKeyInTimeZone(startsAt)}&stav=zruseno`,
    metadata: { reservationId: reservation.id, userId: params.userId },
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

/** Verify success-page parameters against Stripe and reservation ownership. */
export async function getBookingConfirmation(params: {
  userId: string;
  stripeSessionId?: string;
  reservationId?: string;
}): Promise<BookingConfirmation> {
  if (params.stripeSessionId && isStripeConfigured()) {
    try {
      const session = await stripe().checkout.sessions.retrieve(
        params.stripeSessionId,
      );
      const reservationId = session.metadata?.reservationId;
      if (!reservationId || session.metadata?.userId !== params.userId) {
        return { state: "invalid" };
      }
      const reservation = await getReservation(reservationId);
      if (!reservation || reservation.userId !== params.userId) {
        return { state: "invalid" };
      }
      return session.payment_status === "paid" &&
        reservation.status === "confirmed"
        ? { state: "confirmed", reservationId }
        : { state: "processing", reservationId };
    } catch {
      return { state: "invalid" };
    }
  }

  if (params.reservationId) {
    const reservation = await getReservation(params.reservationId);
    if (
      reservation?.userId === params.userId &&
      reservation.status === "confirmed" &&
      reservation.priceCents === 0
    ) {
      return { state: "confirmed", reservationId: reservation.id };
    }
  }
  return { state: "invalid" };
}
