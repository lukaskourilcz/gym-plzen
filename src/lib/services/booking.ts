import { publicEnv } from "@/lib/env";
import { ActionError } from "@/lib/helpers/action";
import { addMinutes } from "@/lib/helpers/datetime";
import { DEFAULT_SLOT_MINUTES } from "@/lib/config/schedule";
import { isStripeConfigured, ensureStripeCustomer, createOneOffCheckout } from "@/lib/integrations/stripe";
import { checkAvailability } from "./availability";
import { createReservation } from "./reservations";
import { priceForNextEntry } from "./loyalty";
import { getMember, setStripeCustomerId } from "./members";
import { recordPayment } from "./memberships";
import { fulfillReservation } from "./fulfillment";

/**
 * Booking service — turns a chosen slot into a reservation and either a Stripe
 * checkout (paid entry) or an immediate confirmation (free loyalty entry).
 *
 * The reservation is created as `pending` before checkout so the slot is held
 * (the DB exclusion constraint prevents anyone else taking it during payment);
 * the Stripe webhook confirms it and runs fulfillment on success.
 */

export type BookingOutcome =
  | { kind: "free"; reservationId: string }
  | { kind: "checkout"; url: string; reservationId: string };

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
  const startsAt = params.startsAt;
  const endsAt = addMinutes(startsAt, DEFAULT_SLOT_MINUTES);

  if (startsAt.getTime() <= Date.now()) {
    throw new ActionError("Tento čas už nelze rezervovat.");
  }

  const availability = await checkAvailability(startsAt, endsAt);
  if (!availability.available) {
    throw new ActionError(AVAILABILITY_MESSAGES[availability.reason ?? "invalid_range"]!);
  }

  const member = await getMember(params.userId);
  if (!member) throw new ActionError("Účet nenalezen.");

  const { priceCents, isFree } = await priceForNextEntry(params.userId);

  // Free loyalty entry — no payment needed.
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

  // Paid entry — requires Stripe.
  if (!isStripeConfigured()) {
    throw new ActionError("Platby zatím nejsou nastavené. Zkuste to prosím později.");
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
    description: "Jednorázový vstup | Gym Plzeň",
    successUrl: `${appUrl}/rezervace/hotovo?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/rezervace`,
    metadata: { reservationId: reservation.id, userId: params.userId },
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
