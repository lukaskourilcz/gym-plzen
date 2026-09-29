import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookingOrder, profiles, reservation } from "@/lib/db/schema";
import type { BookingOrder, Reservation } from "@/lib/db/types";
import type { BookingHold } from "@/lib/helpers/booking-hold";
import { FREE_ENTRY_EVERY } from "@/lib/config/pricing";
import { MAX_SLOTS_PER_ORDER } from "@/lib/config/orders";
import { isDateOpenForBooking } from "@/lib/config/operations";
import { ActionError } from "@/lib/helpers/action";
import { hashCode, safeEqual } from "@/lib/helpers/crypto";
import { dateKeyInTimeZone } from "@/lib/helpers/datetime";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import {
  allocateLoyaltyRewards,
  splitOrderDiscount,
} from "@/lib/helpers/order-pricing";
import { isComgateConfigured } from "@/lib/integrations/comgate";
import { createReservation, releasePendingHold } from "./reservations";
import { countEntries, getEntryPriceCents, hasClaimedReward } from "./loyalty";
import {
  getBookingHorizonDays,
  isWithinBookingHorizon,
  resolveBookableSlot,
} from "./slots";
import { claimVoucher } from "./vouchers";
import { getOperations } from "./operations";
import {
  hasOpenOrderPayment,
  hasUnknownPaymentCreation,
  hasOpenReservationPayment,
  refreshOrderPayment,
  refreshReservationPayment,
  resumeOrderCheckout,
  startOrderPayment,
  type OrderOutcome,
} from "./payments";
import {
  confirmOrderIn,
  getOrder,
  listOrderReservations,
  releasePendingOrder,
  withOrderLock,
} from "./order-state";
import { fulfillReservation } from "./fulfillment";
import { record as recordActivity } from "./activity";
import type { BookingDetails } from "./booking";

/**
 * Multi-slot checkout (docs/MULTI_SLOT_ORDER_PLAN_2026_09_28.md). The visitor
 * picks up to `MAX_SLOTS_PER_ORDER` slots, pays once and receives one
 * confirmation. Every slot stays a reservation of its own, so access codes,
 * rescheduling and cancellation keep working per slot; the order is only the
 * unit of purchase. An order with one slot is the ordinary case.
 */

export type { OrderOutcome } from "./payments";

export interface OrderSlotView {
  reservationId: string;
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
  loyaltyReward: number | null;
}

export type OrderConfirmation =
  | {
      state: "confirmed";
      orderId: string;
      totalCents: number;
      currency: string;
      slots: OrderSlotView[];
    }
  | {
      state: "processing";
      orderId: string;
      /** The gateway may never have received the payment at all. */
      creationUnknown: boolean;
    }
  | {
      state: "cancelled";
      orderId: string;
      /** The payment was abandoned or declined, not the booking withdrawn. */
      unpaid: boolean;
      /** The slots, so the visitor can pick them again in one step. */
      starts: Date[];
    }
  | { state: "invalid" };

const STILL_PROCESSING =
  "Platbu za tyto termíny ještě ověřujeme. Zkuste to prosím za chvíli znovu.";
const OPEN_PAYMENT =
  "Za tyto termíny už máte otevřenou platbu. Dokončete ji, nebo počkejte, až za 30 minut vyprší, a vyberte termíny znovu.";
const PAYMENTS_UNAVAILABLE =
  "Online platby teď nejsou dostupné. Zkuste to prosím později.";

function slotUnavailable(startsAt: Date): ActionError {
  return new ActionError(
    `Termín ${formatDateTime(startsAt)} už není volný. Odeberte ho prosím z výběru a pokračujte.`,
  );
}

export interface ResolvedSlot {
  startsAt: Date;
  endsAt: Date;
}

/**
 * The requested starts as bookable slots, sorted and without duplicates.
 * Every slot must be offered right now; the first one that is not is named,
 * so the visitor knows which one to remove.
 */
export async function resolveOrderSlots(
  starts: readonly Date[],
): Promise<ResolvedSlot[]> {
  const unique = [...new Map(starts.map((at) => [at.getTime(), at])).values()]
    .filter((at) => !Number.isNaN(at.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (unique.length === 0)
    throw new ActionError("Vyberte alespoň jeden termín.");
  if (unique.length > MAX_SLOTS_PER_ORDER)
    throw new ActionError(
      `V jedné objednávce může být nejvýše ${MAX_SLOTS_PER_ORDER} termínů.`,
    );
  const [operations, horizon] = await Promise.all([
    getOperations(),
    getBookingHorizonDays(),
  ]);
  const now = new Date();
  const resolved: ResolvedSlot[] = [];
  for (const startsAt of unique) {
    const slot = await resolveBookableSlot(startsAt);
    const date = dateKeyInTimeZone(startsAt);
    if (
      !slot ||
      startsAt <= now ||
      !isWithinBookingHorizon(date, now, horizon) ||
      !isDateOpenForBooking(date, operations)
    )
      throw new ActionError(
        `Termín ${formatDateTime(startsAt)} není dostupný pro rezervaci. Odeberte ho prosím z výběru.`,
      );
    const previous = resolved.at(-1);
    if (previous && previous.endsAt > startsAt)
      throw new ActionError(
        `Termíny ${formatDateTime(previous.startsAt)} a ${formatDateTime(startsAt)} se překrývají. Jeden z nich prosím odeberte.`,
      );
    resolved.push({ startsAt, endsAt: slot.endsAt });
  }
  return resolved;
}

/**
 * The visitor's own live reservations among the requested starts. A hold
 * cookie proves a guest's order (or an older single reservation) by its
 * token; a member is matched by account; failing both, a guest is matched by
 * the contact e-mail typed for those slots, which is all a guest reservation
 * is identified by.
 */
export async function findOwnReservations(params: {
  userId: string | null;
  email: string | null;
  starts: readonly Date[];
  hold?: BookingHold | null;
}): Promise<Reservation[]> {
  if (params.starts.length === 0) return [];
  const atRequestedTimes = inArray(reservation.startsAt, [...params.starts]);
  const live = inArray(reservation.status, ["pending", "confirmed"]);
  const found = new Map<string, Reservation>();

  if (params.hold) {
    const hashed = hashCode(params.hold.token);
    if (params.hold.kind === "order") {
      const order = await getOrder(params.hold.id);
      if (
        order?.confirmationTokenHash &&
        safeEqual(hashed, order.confirmationTokenHash)
      ) {
        const rows = await db
          .select()
          .from(reservation)
          .where(
            and(eq(reservation.orderId, order.id), live, atRequestedTimes),
          );
        for (const row of rows) found.set(row.id, row);
      }
    } else {
      const [held] = await db
        .select()
        .from(reservation)
        .where(and(eq(reservation.id, params.hold.id), live, atRequestedTimes));
      if (
        held?.confirmationTokenHash &&
        safeEqual(hashed, held.confirmationTokenHash)
      )
        found.set(held.id, held);
    }
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
  if (identity) {
    const rows = await db
      .select()
      .from(reservation)
      .where(and(atRequestedTimes, live, identity));
    for (const row of rows) found.set(row.id, row);
  }
  return [...found.values()].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );
}

/**
 * A second submit for slots the visitor already holds (a double click, the
 * back button from the gateway) continues that checkout instead of reporting
 * the visitor's own hold as a taken slot. A different selection, or a
 * voucher on the retry, releases the earlier hold so this attempt can take
 * its place. Returns the outcome to hand back, or null for a fresh order.
 */
async function continueOwnOrder(
  params: {
    userId: string | null;
    details: BookingDetails;
    voucherCode?: string;
    hold?: BookingHold | null;
  },
  slots: readonly ResolvedSlot[],
): Promise<OrderOutcome | null> {
  const lookup = () =>
    findOwnReservations({
      userId: params.userId,
      email: params.details.email,
      starts: slots.map((slot) => slot.startsAt),
      hold: params.hold,
    });
  let own = await lookup();
  if (own.length === 0) return null;
  // A payment the gateway has settled may not have reached us yet.
  const pendingOrders = new Set(
    own.flatMap((row) =>
      row.status === "pending" && row.orderId ? [row.orderId] : [],
    ),
  );
  for (const orderId of pendingOrders) await refreshOrderPayment(orderId);
  for (const row of own)
    if (row.status === "pending" && !row.orderId)
      await refreshReservationPayment(row.id);
  own = await lookup();

  /*
   * Only the account or the hold cookie's token proves a reservation is the
   * visitor's. A match on the typed e-mail alone may at most continue the very
   * same checkout: it must never release someone else's hold, nor reveal
   * whether that person's booking is confirmed.
   */
  const proves = (row: Reservation) =>
    (params.userId !== null && row.userId === params.userId) ||
    (params.hold?.kind === "order" && row.orderId === params.hold.id) ||
    (params.hold?.kind === "reservation" && row.id === params.hold.id);

  const confirmed = own.find((row) => row.status === "confirmed");
  if (confirmed)
    throw proves(confirmed)
      ? new ActionError(
          `Termín ${formatDateTime(confirmed.startsAt)} už máte potvrzený. Odeberte ho prosím z výběru.`,
        )
      : slotUnavailable(confirmed.startsAt);
  if (own.length === 0) return null;

  const orderIds = [...new Set(own.map((row) => row.orderId))];
  const onlyOrder = orderIds.length === 1 ? orderIds[0] : null;
  if (onlyOrder && !params.voucherCode?.trim()) {
    const held = (await listOrderReservations(onlyOrder)).filter(
      (row) => row.status === "pending",
    );
    const sameSelection =
      held.length === slots.length &&
      held.every(
        (row, index) =>
          row.startsAt.getTime() === slots[index]!.startsAt.getTime(),
      );
    if (sameSelection) {
      if (held.every(proves))
        return startOrderPayment({
          orderId: onlyOrder,
          userId: params.userId,
          token: params.hold?.token,
        });
      const resumed = await resumeOrderCheckout(onlyOrder);
      if (resumed.state === "checkout") return resumed.outcome;
      if (resumed.state === "processing")
        throw new ActionError(STILL_PROCESSING);
    }
  }

  const unproven = own.find((row) => !proves(row));
  if (unproven)
    throw new ActionError(
      `Termín ${formatDateTime(unproven.startsAt)} je právě rozpracovaný v jiné platbě. Dokončete ji, nebo to zkuste znovu za 30 minut.`,
    );
  // A gateway session still open for the earlier checkout could be paid after
  // it is released, charging the visitor twice. It has to end first.
  for (const orderId of orderIds)
    if (orderId && (await hasOpenOrderPayment(orderId)))
      throw new ActionError(OPEN_PAYMENT);
  for (const row of own)
    if (!row.orderId && (await hasOpenReservationPayment(row.id)))
      throw new ActionError(OPEN_PAYMENT);

  // A different selection or price is wanted: the earlier holds give way,
  // unless one was confirmed in the meantime.
  for (const orderId of orderIds) {
    if (orderId) {
      if (!(await releasePendingOrder(orderId, "superseded")))
        throw new ActionError(
          "Tyto termíny už máte potvrzené. Potvrzení jsme vám poslali e-mailem.",
        );
    }
  }
  for (const row of own) {
    if (row.orderId) continue;
    if (!(await releasePendingHold(row.id, "superseded")))
      throw new ActionError(
        `Termín ${formatDateTime(row.startsAt)} už máte potvrzený. Odeberte ho prosím z výběru.`,
      );
  }
  for (const row of own)
    await recordActivity({
      action: "reservation.cancelled",
      actorType: "customer",
      actorId: params.userId,
      actorLabel: params.details.email,
      memberId: row.userId,
      reservationId: row.id,
      summary: `Nedokončená rezervace na ${formatDateTime(row.startsAt)} nahrazena novým pokusem zákazníka.`,
      context: row.orderId ? { orderId: row.orderId } : undefined,
    });
  return null;
}

export interface OrderQuoteSlot {
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
  /** The member's loyalty reward: this slot is free. */
  isReward: boolean;
}

/**
 * What the selection would cost right now: every slot's price, the loyalty
 * rewards among them for a member, and the total. The same rules as
 * `startOrder`, read without locks, for the details page and the voucher
 * quote; the order itself recomputes everything atomically.
 */
export async function quoteOrder(params: {
  userId: string | null;
  slots: readonly ResolvedSlot[];
}): Promise<{ slots: OrderQuoteSlot[]; totalCents: number }> {
  const prices = await Promise.all(
    params.slots.map((slot) => getEntryPriceCents(slot.startsAt)),
  );
  let rewards: (number | null)[] = params.slots.map(() => null);
  if (params.userId) {
    const allocated = allocateLoyaltyRewards(
      await countEntries(params.userId),
      params.slots.length,
      FREE_ENTRY_EVERY,
    );
    rewards = [];
    for (const reward of allocated)
      rewards.push(
        reward && !(await hasClaimedReward(params.userId, reward))
          ? reward
          : null,
      );
  }
  const slots = params.slots.map((slot, index) => ({
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    priceCents: rewards[index] ? 0 : prices[index]!,
    isReward: Boolean(rewards[index]),
  }));
  return {
    slots,
    totalCents: slots.reduce((sum, slot) => sum + slot.priceCents, 0),
  };
}

/**
 * Start a checkout of one or more slots. Loyalty rewards, prices and every
 * reservation commit atomically under the member's row lock: either all of
 * the slots are held, or none is and the visitor learns which one is gone.
 */
export async function startOrder(params: {
  userId: string | null;
  starts: readonly Date[];
  details: BookingDetails;
  voucherCode?: string;
  /** The guest's hold cookie, when the browser sent one. */
  hold?: BookingHold | null;
}): Promise<OrderOutcome> {
  const operations = await getOperations();
  const slots = await resolveOrderSlots(params.starts);
  const continued = await continueOwnOrder(params, slots);
  if (continued) return continued;

  const basePrices = await Promise.all(
    slots.map((slot) => getEntryPriceCents(slot.startsAt)),
  );
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashCode(token);
  const { order, reservations } = await db.transaction(async (tx) => {
    let rewards: (number | null)[] = slots.map(() => null);
    if (params.userId) {
      const [member] = await tx
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.id, params.userId))
        .for("update");
      if (!member) throw new ActionError("Účet nebyl nalezen.");
      const counted = await countEntries(params.userId, tx);
      const allocated = allocateLoyaltyRewards(
        counted,
        slots.length,
        FREE_ENTRY_EVERY,
      );
      rewards = [];
      for (const reward of allocated)
        rewards.push(
          reward && !(await hasClaimedReward(params.userId, reward, tx))
            ? reward
            : null,
        );
    }
    const prices = basePrices.map((price, index) =>
      rewards[index] ? 0 : price,
    );
    const totalCents = prices.reduce((sum, price) => sum + price, 0);
    if (
      totalCents > 0 &&
      (!operations.paymentsEnabled || !isComgateConfigured())
    )
      throw new ActionError(PAYMENTS_UNAVAILABLE);
    const allFree = totalCents === 0;
    const [created] = await tx
      .insert(bookingOrder)
      .values({
        userId: params.userId,
        status: allFree ? "confirmed" : "pending",
        totalCents,
        contactName: params.details.name,
        contactEmail: params.details.email,
        contactPhone: params.details.phone,
        confirmationTokenHash: tokenHash,
        rulesAcceptedAt: params.details.acceptedAt,
        termsAcceptedAt: params.details.acceptedAt,
      })
      .returning();
    if (!created) throw new ActionError("Objednávku se nepodařilo vytvořit.");
    const rows: Reservation[] = [];
    for (const [index, slot] of slots.entries()) {
      try {
        rows.push(
          await createReservation(
            {
              userId: params.userId,
              orderId: created.id,
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              contactName: params.details.name,
              contactEmail: params.details.email,
              contactPhone: params.details.phone,
              rulesAcceptedAt: params.details.acceptedAt,
              termsAcceptedAt: params.details.acceptedAt,
              priceCents: prices[index]!,
              status: allFree ? "confirmed" : "pending",
              // The same token opens each slot's calendar file and status.
              confirmationTokenHash: tokenHash,
              loyaltyReward: rewards[index] ?? undefined,
            },
            tx,
          ),
        );
      } catch (error) {
        if (error instanceof ActionError) throw slotUnavailable(slot.startsAt);
        throw error;
      }
    }
    return { order: created, reservations: rows };
  });

  const actor = {
    actorType: "customer" as const,
    actorId: params.userId,
    actorLabel: params.details.email,
    memberId: params.userId,
  };
  const orderNote =
    reservations.length > 1
      ? ` (objednávka ${reservations.length} termínů)`
      : "";

  if (order.status === "confirmed") {
    for (const row of reservations)
      await recordActivity({
        ...actor,
        reservationId: row.id,
        action: "reservation.confirmed",
        summary: `Rezervace na ${formatDateTime(row.startsAt)} potvrzena jako věrnostní vstup zdarma${orderNote}.`,
        context: { orderId: order.id },
      });
    for (const row of reservations) await fulfillReservation(row.id);
    return { kind: "free", orderId: order.id, token };
  }

  let totalCents = order.totalCents;
  let voucherCode: string | null = null;
  if (params.voucherCode?.trim()) {
    try {
      const paid = reservations.filter((row) => (row.priceCents ?? 0) > 0);
      const quote = await claimVoucher({
        code: params.voucherCode,
        reservationId: paid[0]!.id,
        orderId: order.id,
        originalPriceCents: order.totalCents,
        reservedUntil: paid[0]!.endsAt,
      });
      const finals = splitOrderDiscount(
        paid.map((row) => row.priceCents ?? 0),
        quote.discountCents,
      );
      await applyOrderPrices(
        order.id,
        paid.map((row, index) => ({ id: row.id, priceCents: finals[index]! })),
        quote.finalPriceCents,
        quote.voucherId,
      );
      totalCents = quote.finalPriceCents;
      voucherCode = quote.code;
    } catch (error) {
      // Releasing the order gives its voucher claim back as well.
      await releasePendingOrder(order.id, "voucher_rejected");
      throw error;
    }
  }

  if (totalCents === 0) {
    const confirmed = await withOrderLock(order.id, () =>
      db.transaction((tx) => confirmOrderIn(tx, order.id)),
    );
    if (confirmed.length === 0)
      throw new ActionError("Rezervaci se nepodařilo potvrdit.");
    for (const row of confirmed)
      await recordActivity({
        ...actor,
        reservationId: row.id,
        action: "reservation.confirmed",
        summary: `Rezervace na ${formatDateTime(row.startsAt)} potvrzena, voucher ${voucherCode} pokryl celou cenu${orderNote}.`,
        context: { orderId: order.id, voucherCode },
      });
    for (const row of confirmed) await fulfillReservation(row.id);
    return { kind: "free", orderId: order.id, token };
  }

  for (const row of reservations)
    await recordActivity({
      ...actor,
      reservationId: row.id,
      action: "reservation.created",
      summary: `Rezervace na ${formatDateTime(row.startsAt)} vytvořena, čeká na platbu ${formatMoney(totalCents)}${orderNote}${voucherCode ? ` (voucher ${voucherCode})` : ""}.`,
      context: { orderId: order.id, totalCents, voucherCode },
    });
  return startOrderPayment({
    orderId: order.id,
    userId: params.userId,
    token,
  });
}

/** Persist the voucher-adjusted prices of a still-pending order at once. */
async function applyOrderPrices(
  orderId: string,
  prices: readonly { id: string; priceCents: number }[],
  totalCents: number,
  voucherId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(bookingOrder)
      .set({ totalCents, voucherId, updatedAt: new Date() })
      .where(
        and(eq(bookingOrder.id, orderId), eq(bookingOrder.status, "pending")),
      )
      .returning({ id: bookingOrder.id });
    if (!updated)
      throw new ActionError("Cenu objednávky se nepodařilo uložit.");
    for (const row of prices)
      await tx
        .update(reservation)
        .set({ priceCents: row.priceCents, updatedAt: new Date() })
        .where(
          and(eq(reservation.id, row.id), eq(reservation.status, "pending")),
        );
  });
}

/**
 * What the confirmation page may show. An account or the random 256-bit
 * token proves access; provider transaction IDs never do.
 */
export async function getOrderConfirmation(params: {
  userId: string | null;
  orderId?: string;
  token?: string;
}): Promise<OrderConfirmation> {
  if (!params.orderId || !/^[0-9a-f-]{36}$/i.test(params.orderId))
    return { state: "invalid" };
  let order: BookingOrder | null = await getOrder(params.orderId);
  if (!order) return { state: "invalid" };
  const owns = Boolean(params.userId) && order.userId === params.userId;
  // The token proves the order for members too: a banking app may bring the
  // return from the gateway into a browser without the member's session.
  const provesToken = Boolean(
    params.token &&
    order.confirmationTokenHash &&
    safeEqual(hashCode(params.token), order.confirmationTokenHash),
  );
  if (!owns && !provesToken) return { state: "invalid" };
  if (order.status === "pending") {
    await refreshOrderPayment(order.id);
    order = await getOrder(order.id);
    if (!order) return { state: "invalid" };
  }
  const rows = await listOrderReservations(order.id);
  const slots = rows.filter(
    (row) => row.status === "confirmed" || row.status === "completed",
  );
  if (order.status === "pending")
    return {
      state: "processing",
      orderId: order.id,
      creationUnknown: await hasUnknownPaymentCreation(order.id),
    };
  // A confirmed order whose every slot was cancelled later is not "confirmed"
  // to the customer any more.
  if (order.status === "cancelled" || slots.length === 0)
    return {
      state: "cancelled",
      orderId: order.id,
      unpaid:
        order.status === "cancelled" &&
        [
          "payment_cancelled",
          "checkout_expired",
          "payment_creation_failed",
        ].includes(order.cancelReason ?? ""),
      starts: rows.map((row) => row.startsAt),
    };
  return {
    state: "confirmed",
    orderId: order.id,
    totalCents: order.totalCents,
    currency: order.currency,
    slots: slots.map((row) => ({
      reservationId: row.id,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      priceCents: row.priceCents ?? 0,
      loyaltyReward: row.loyaltyReward,
    })),
  };
}

/** Slots of the given orders, for pages that group reservations by order. */
export async function listReservationsOfOrders(
  orderIds: readonly string[],
): Promise<Reservation[]> {
  if (orderIds.length === 0) return [];
  return db
    .select()
    .from(reservation)
    .where(inArray(reservation.orderId, [...orderIds]))
    .orderBy(asc(reservation.startsAt));
}
