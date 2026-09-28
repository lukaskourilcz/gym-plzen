import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookingOrder, invoice, payment, reservation } from "@/lib/db/schema";
import { pageLimit, pageOffset } from "@/lib/helpers/pagination";

export const ORDER_PAGE_SIZE = 20;

/** One slot inside a purchase in the customer's order history. */
export interface CustomerOrderSlot {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  priceCents: number | null;
  loyaltyReward: number | null;
}

/**
 * One purchase: a multi-slot order, or a reservation bought on its own
 * before orders existed (or made by the administration). The document and
 * the payment belong to the purchase, not to each slot.
 */
export interface CustomerOrder {
  id: string;
  orderId: string | null;
  createdAt: Date;
  totalCents: number | null;
  currency: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  paymentStatus: string | null;
  slots: CustomerOrderSlot[];
}

/**
 * A member's purchases, newest first, one page at a time (the page reads one
 * purchase beyond its size, for `splitPage`). Every query is scoped to the
 * verified auth user; no contact-email matching.
 */
export async function listCustomerOrders(
  userId: string,
  page: number,
): Promise<CustomerOrder[]> {
  const unitKey = sql<string>`coalesce(${reservation.orderId}, ${reservation.id})`;
  const created = sql`max(${reservation.createdAt})`;
  const units = await db
    .select({
      id: unitKey,
      createdAt: created.mapWith(reservation.createdAt),
    })
    .from(reservation)
    .where(eq(reservation.userId, userId))
    .groupBy(unitKey)
    .orderBy(desc(created), desc(unitKey))
    .limit(pageLimit(ORDER_PAGE_SIZE))
    .offset(pageOffset(page, ORDER_PAGE_SIZE));
  if (units.length === 0) return [];
  const ids = units.map((unit) => unit.id);

  const [slots, orders, documents] = await Promise.all([
    db
      .select()
      .from(reservation)
      .where(
        and(
          eq(reservation.userId, userId),
          or(inArray(reservation.orderId, ids), inArray(reservation.id, ids)),
        ),
      )
      .orderBy(asc(reservation.startsAt)),
    db
      .select()
      .from(bookingOrder)
      .where(
        and(eq(bookingOrder.userId, userId), inArray(bookingOrder.id, ids)),
      ),
    db
      .select({
        id: invoice.id,
        number: invoice.number,
        orderId: invoice.orderId,
        reservationId: invoice.reservationId,
      })
      .from(invoice)
      .where(
        and(
          eq(invoice.userId, userId),
          or(
            inArray(invoice.orderId, ids),
            inArray(invoice.reservationId, ids),
          ),
        ),
      ),
  ]);
  const payments = await db
    .select({
      status: payment.status,
      orderId: payment.orderId,
      reservationId: payment.reservationId,
    })
    .from(payment)
    .where(
      or(
        inArray(payment.orderId, ids),
        inArray(
          payment.reservationId,
          slots.map((slot) => slot.id),
        ),
      ),
    )
    .orderBy(desc(payment.createdAt), desc(payment.id));

  const orderById = new Map(orders.map((order) => [order.id, order]));
  return units.map((unit) => {
    const order = orderById.get(unit.id) ?? null;
    const own = slots.filter((slot) =>
      order ? slot.orderId === order.id : slot.id === unit.id,
    );
    const document =
      documents.find((row) => (order ? row.orderId === order.id : false)) ??
      documents.find((row) => !row.orderId && row.reservationId === unit.id);
    const latest = payments.find((row) =>
      order ? row.orderId === order.id : row.reservationId === unit.id,
    );
    const first = own[0];
    return {
      id: unit.id,
      orderId: order?.id ?? null,
      createdAt: unit.createdAt,
      totalCents: order ? order.totalCents : (first?.priceCents ?? null),
      currency: order?.currency ?? first?.currency ?? "czk",
      invoiceId: document?.id ?? null,
      invoiceNumber: document?.number ?? null,
      paymentStatus: latest?.status ?? null,
      slots: own.map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: slot.status,
        priceCents: slot.priceCents,
        loyaltyReward: slot.loyaltyReward,
      })),
    };
  });
}

export async function getCustomerInvoice(userId: string, invoiceId: string) {
  const [row] = await db
    .select()
    .from(invoice)
    .where(and(eq(invoice.id, invoiceId), eq(invoice.userId, userId)))
    .limit(1);
  return row ?? null;
}
