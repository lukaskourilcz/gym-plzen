import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
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
import { startReservationPayment, refreshReservationPayment } from "./payments";

export type BookingOutcome =
  | { kind: "free" | "processing"; reservationId: string; token?: string }
  | {
      kind: "checkout";
      url: string;
      reservationId: string;
      priceCents: number;
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

export async function startBooking(params: {
  userId: string | null;
  startsAt: Date;
  details: BookingDetails;
  voucherCode?: string;
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
