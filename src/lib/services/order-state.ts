import { and, asc, eq, inArray } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { bookingOrder, reservation } from "@/lib/db/schema";
import type { BookingOrder, Reservation } from "@/lib/db/types";
import { withOperationLock } from "./operation-lock";
import { initPipeline } from "./pipeline";
import { redeemForOrder, releaseForOrder } from "./vouchers";

/**
 * The stored state of a multi-slot order: reading it and the few transitions
 * that must move the order and all of its reservations together. The booking
 * flow (`orders.ts`) and the payment reconciliation (`payments.ts`) both build
 * on these, so neither has to import the other.
 */

/** Serialises everything that changes one order: payment, release, confirm. */
export function withOrderLock<T>(orderId: string, work: () => Promise<T>) {
  return withOperationLock(`order:${orderId}`, work);
}

export async function getOrder(
  id: string,
  executor: DatabaseExecutor = db,
): Promise<BookingOrder | null> {
  const [row] = await executor
    .select()
    .from(bookingOrder)
    .where(eq(bookingOrder.id, id))
    .limit(1);
  return row ?? null;
}

/** Every reservation of an order, in the order the slots take place. */
export async function listOrderReservations(
  orderId: string,
  executor: DatabaseExecutor = db,
): Promise<Reservation[]> {
  return executor
    .select()
    .from(reservation)
    .where(eq(reservation.orderId, orderId))
    .orderBy(asc(reservation.startsAt), asc(reservation.id));
}

/**
 * Confirm a pending order and every one of its pending reservations in the
 * caller's transaction, start each reservation's pipeline and consume the
 * voucher claim. Returns the reservations it confirmed; none when the order
 * was no longer pending, which makes a repeated call harmless.
 */
export async function confirmOrderIn(
  executor: DatabaseExecutor,
  orderId: string,
): Promise<Reservation[]> {
  const now = new Date();
  const [order] = await executor
    .update(bookingOrder)
    .set({ status: "confirmed", updatedAt: now })
    .where(
      and(eq(bookingOrder.id, orderId), eq(bookingOrder.status, "pending")),
    )
    .returning({ id: bookingOrder.id });
  if (!order) return [];
  const confirmed = await executor
    .update(reservation)
    .set({ status: "confirmed", updatedAt: now })
    .where(
      and(eq(reservation.orderId, orderId), eq(reservation.status, "pending")),
    )
    .returning();
  for (const row of confirmed) await initPipeline(row.id, executor);
  await redeemForOrder(orderId, executor);
  return confirmed.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Give up a pending order in the caller's transaction: the order and its
 * still-pending reservations are cancelled and the voucher claim released.
 * Confirmed reservations are never touched here. Returns the reservations it
 * released; none when the order was no longer pending.
 */
export async function cancelPendingOrderIn(
  executor: DatabaseExecutor,
  orderId: string,
  reason: string,
): Promise<Reservation[]> {
  const now = new Date();
  const [order] = await executor
    .update(bookingOrder)
    .set({
      status: "cancelled",
      cancelledAt: now,
      cancelReason: reason,
      updatedAt: now,
    })
    .where(
      and(eq(bookingOrder.id, orderId), eq(bookingOrder.status, "pending")),
    )
    .returning({ id: bookingOrder.id });
  if (!order) return [];
  const released = await executor
    .update(reservation)
    .set({
      status: "cancelled",
      cancelledAt: now,
      cancelReason: reason,
      updatedAt: now,
    })
    .where(
      and(eq(reservation.orderId, orderId), eq(reservation.status, "pending")),
    )
    .returning();
  await releaseForOrder(orderId, executor);
  return released;
}

/**
 * Release an order its own visitor is replacing or that could not reach the
 * gateway. Taken under the order lock, so a payment settling at the same
 * moment either confirms first (and nothing is released) or finds the order
 * cancelled and raises the late-payment alert. Returns whether it released.
 */
export async function releasePendingOrder(
  orderId: string,
  reason: string,
): Promise<boolean> {
  return withOrderLock(orderId, async () => {
    const released = await db.transaction(async (tx) =>
      cancelPendingOrderIn(tx, orderId, reason),
    );
    if (released.length > 0) return true;
    return (await getOrder(orderId))?.status === "cancelled";
  });
}

/** Mark orders whose reservations the checkout expiry has just released. */
export async function cancelOrdersOfReleased(
  executor: DatabaseExecutor,
  orderIds: string[],
  reason: string,
  now = new Date(),
): Promise<void> {
  if (orderIds.length === 0) return;
  const cancelled = await executor
    .update(bookingOrder)
    .set({
      status: "cancelled",
      cancelledAt: now,
      cancelReason: reason,
      updatedAt: now,
    })
    .where(
      and(
        inArray(bookingOrder.id, orderIds),
        eq(bookingOrder.status, "pending"),
      ),
    )
    .returning({ id: bookingOrder.id });
  for (const row of cancelled) await releaseForOrder(row.id, executor);
}
