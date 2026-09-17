import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, reservation } from "@/lib/db/schema";
import type { Reservation } from "@/lib/db/types";
import type { BookingHold } from "@/lib/helpers/booking-hold";
import { FREE_ENTRY_EVERY } from "@/lib/config/pricing";
import { isDateOpenForBooking } from "@/lib/config/operations";
import { ActionError } from "@/lib/helpers/action";
import { hashCode, safeEqual } from "@/lib/helpers/crypto";
import { dateKeyInTimeZone } from "@/lib/helpers/datetime";
import { isComgateConfigured } from "@/lib/integrations/comgate";
import {
  createReservation,
  getReservation,
  cancelReservation,
  confirmReservation,
  releasePendingHold,
  updateReservationPrice,
} from "./reservations";
import {
  countEntries,
  deriveLoyaltyStatus,
  getEntryPriceCents,
  hasClaimedReward,
} from "./loyalty";
import { fulfillReservation } from "./fulfillment";
import {
  getBookingHorizonDays,
  isWithinBookingHorizon,
  resolveBookableSlot,
} from "./slots";
import {
  claimVoucher,
  redeemForReservation,
  releaseForReservation,
} from "./vouchers";
import { getOperations } from "./operations";
import {
  refreshReservationPayment,
  resumeReservationCheckout,
  startReservationPayment,
} from "./payments";

export type BookingOutcome =
  | { kind: "free" | "processing"; reservationId: string; token?: string }
  | {
      kind: "checkout";
      url: string;
      reservationId: string;
      priceCents: number;
      /** A guest's proof of ownership, for the hold cookie; absent on resumes. */
      token?: string;
    };
export type BookingConfirmation =
  | {
      state: "confirmed";
      reservationId: string;
      priceCents: number;
      currency: string;
      startsAt: Date;
      endsAt: Date;
    }
  | { state: "processing" | "cancelled"; reservationId: string }
  | { state: "invalid" };
export interface BookingDetails {
  name: string;
  email: string;
  phone: string;
  acceptedAt: Date;
}

const ALREADY_CONFIRMED =
  "Tento termín už máte potvrzený. Potvrzení jsme vám poslali e-mailem.";
const STILL_PROCESSING =
  "Platbu za tento termín ještě ověřujeme. Zkuste to prosím za chvíli znovu.";

export async function startBooking(params: {
  userId: string | null;
  startsAt: Date;
  details: BookingDetails;
  voucherCode?: string;
  /** The guest's hold cookie, when the browser sent one. */
  hold?: BookingHold | null;
}): Promise<BookingOutcome> {
  const operations = await getOperations();
  const resolved = await resolveBookableSlot(params.startsAt);
  const horizon = await getBookingHorizonDays();
  const date = dateKeyInTimeZone(params.startsAt);
  if (
    !resolved ||
    params.startsAt <= new Date() ||
    !isWithinBookingHorizon(date, new Date(), horizon) ||
    !isDateOpenForBooking(date, operations)
  )
    throw new ActionError("Vybraný termín není dostupný pro rezervaci.");
  const continued = await continueOwnBooking(params);
  if (continued) return continued;
  const basePrice = await getEntryPriceCents(params.startsAt);
  const token = randomBytes(32).toString("hex");
  // Price, reward claim and reservation commit atomically under one member row
  // lock. No external HTTP call can hold this transaction open.
  const reserved = await db.transaction(async (tx) => {
    let reward: number | undefined;
    if (params.userId) {
      const [member] = await tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, params.userId))
        .for("update");
      if (!member) throw new ActionError("Účet nebyl nalezen.");
      const count = await countEntries(params.userId, tx);
      const number = Math.floor(count / FREE_ENTRY_EVERY) + 1;
      if (
        deriveLoyaltyStatus(count).nextEntryIsFree &&
        !(await hasClaimedReward(params.userId, number, tx))
      )
        reward = number;
    }
    if (!reward && (!operations.paymentsEnabled || !isComgateConfigured()))
      throw new ActionError(
        "Online platby teď nejsou dostupné. Zkuste to prosím později.",
      );
    return createReservation(
      {
        userId: params.userId,
        startsAt: params.startsAt,
        endsAt: resolved.endsAt,
        contactName: params.details.name,
        contactEmail: params.details.email,
        contactPhone: params.details.phone,
        rulesAcceptedAt: params.details.acceptedAt,
        termsAcceptedAt: params.details.acceptedAt,
        priceCents: reward ? 0 : basePrice,
        status: reward ? "confirmed" : "pending",
        confirmationTokenHash: hashCode(token),
        loyaltyReward: reward,
      },
      tx,
    );
  });
  if (reserved.status === "confirmed") {
    await fulfillReservation(reserved.id);
    return { kind: "free", reservationId: reserved.id, token };
  }
  let priceCents = basePrice;
  if (params.voucherCode?.trim()) {
    try {
      const quote = await claimVoucher({
        code: params.voucherCode,
        reservationId: reserved.id,
        originalPriceCents: basePrice,
        reservedUntil: resolved.endsAt,
      });
      priceCents = quote.finalPriceCents;
      await updateReservationPrice(reserved.id, priceCents);
    } catch (error) {
      await releaseForReservation(reserved.id);
      await cancelReservation({ id: reserved.id, reason: "voucher_rejected" });
      throw error;
    }
  }
  if (priceCents === 0) {
    if (!(await confirmReservation(reserved.id)))
      throw new ActionError("Rezervaci se nepodařilo potvrdit.");
    await redeemForReservation(reserved.id);
    await fulfillReservation(reserved.id);
    return { kind: "free", reservationId: reserved.id, token };
  }
  return startReservationPayment({
    reservationId: reserved.id,
    userId: params.userId,
    token,
  });
}

/**
 * The visitor's own live reservation for a slot, if there is one. A hold
 * cookie proves a guest's reservation by its token; a member's is matched by
 * account; failing both, a guest is matched by the contact e-mail they typed,
 * for the slot they typed it for, because that snapshot is all a guest
 * reservation is identified by.
 */
export async function findOwnReservation(params: {
  userId: string | null;
  email: string | null;
  startsAt: Date;
  hold?: BookingHold | null;
}): Promise<Reservation | null> {
  if (params.hold) {
    const held = await getReservation(params.hold.reservationId);
    if (
      held &&
      held.confirmationTokenHash &&
      safeEqual(hashCode(params.hold.token), held.confirmationTokenHash) &&
      held.startsAt.getTime() === params.startsAt.getTime() &&
      (held.status === "pending" || held.status === "confirmed")
    )
      return held;
  }
  const email = params.email?.trim().toLowerCase();
  const guestMatch = email
    ? and(
        isNull(reservation.userId),
        sql`lower(${reservation.contactEmail}) = ${email}`,
      )
    : undefined;
  const identity = params.userId
    ? guestMatch
      ? or(eq(reservation.userId, params.userId), guestMatch)
      : eq(reservation.userId, params.userId)
    : guestMatch;
  if (!identity) return null;
  const [row] = await db
    .select()
    .from(reservation)
    .where(
      and(
        eq(reservation.startsAt, params.startsAt),
        inArray(reservation.status, ["pending", "confirmed"]),
        identity,
      ),
    )
    .orderBy(desc(reservation.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * A second submit for a slot the visitor already holds (a double click, the
 * back button from the payment gateway, a tab reopened from history)
 * continues that booking instead of reporting the visitor's own hold as a
 * taken slot, which is what a customer ran into on 17. 9. 2026. Returns the
 * outcome to hand back, or null when nothing is left to continue and a fresh
 * reservation should be made.
 */
async function continueOwnBooking(params: {
  userId: string | null;
  startsAt: Date;
  details: BookingDetails;
  voucherCode?: string;
  hold?: BookingHold | null;
}): Promise<BookingOutcome | null> {
  let own = await findOwnReservation({
    userId: params.userId,
    email: params.details.email,
    startsAt: params.startsAt,
    hold: params.hold,
  });
  if (!own) return null;
  if (own.status === "pending") {
    // A payment the gateway has settled may not have reached us yet.
    await refreshReservationPayment(own.id);
    own = (await getReservation(own.id)) ?? own;
  }
  if (own.status === "confirmed" || own.status === "completed")
    throw new ActionError(ALREADY_CONFIRMED);
  // Released in the meantime: the slot is free again.
  if (own.status !== "pending") return null;

  // A voucher on the retry asks for a different price than the hold carries.
  if (!params.voucherCode?.trim()) {
    const proven =
      (params.userId !== null && own.userId === params.userId) ||
      params.hold?.reservationId === own.id;
    if (proven)
      // Proof of ownership allows the full path, a fresh gateway session
      // included, should the earlier one never have been created.
      return startReservationPayment({
        reservationId: own.id,
        userId: params.userId,
        token: params.hold?.token,
      });
    const resumed = await resumeReservationCheckout(own.id);
    if (resumed.state === "checkout") return resumed.outcome;
    if (resumed.state === "processing") throw new ActionError(STILL_PROCESSING);
  }
  // Nothing to continue, or a new price is wanted: the earlier hold gives way
  // to this attempt, unless it was confirmed in the meantime.
  if (!(await releasePendingHold(own.id, "superseded")))
    throw new ActionError(ALREADY_CONFIRMED);
  return null;
}

/** An account or a random 256-bit token proves access. Provider transaction IDs
 * are never accepted as guest authentication. */
export async function getBookingConfirmation(params: {
  userId: string | null;
  reservationId?: string;
  token?: string;
}): Promise<BookingConfirmation> {
  if (!params.reservationId || !/^[0-9a-f-]{36}$/i.test(params.reservationId))
    return { state: "invalid" };
  let row = await getReservation(params.reservationId);
  if (!row) return { state: "invalid" };
  const owns = Boolean(params.userId) && row.userId === params.userId;
  const provesToken =
    !row.userId &&
    Boolean(
      params.token &&
      row.confirmationTokenHash &&
      safeEqual(hashCode(params.token), row.confirmationTokenHash),
    );
  if (!owns && !provesToken) return { state: "invalid" };
  if (row.status === "pending") {
    await refreshReservationPayment(row.id);
    row = await getReservation(row.id);
    if (!row) return { state: "invalid" };
  }
  if (row.status === "cancelled")
    return { state: "cancelled", reservationId: row.id };
  if (row.status === "confirmed" || row.status === "completed")
    return {
      state: "confirmed",
      reservationId: row.id,
      priceCents: row.priceCents ?? 0,
      currency: row.currency,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
    };
  return { state: "processing", reservationId: row.id };
}
