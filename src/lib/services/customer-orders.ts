import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoice, reservation } from "@/lib/db/schema";

export const ORDER_PAGE_SIZE = 20;
/** Every query is scoped to the verified auth user; no contact-email matching. */
export async function listCustomerOrders(userId: string, page: number) {
  return db
    .select({
      id: reservation.id,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      createdAt: reservation.createdAt,
      status: reservation.status,
      priceCents: reservation.priceCents,
      currency: reservation.currency,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      paymentStatus: sql<
        string | null
      >`(select p.status::text from public.payment p where p.reservation_id = ${reservation.id} order by p.created_at desc, p.id desc limit 1)`,
    })
    .from(reservation)
    .leftJoin(
      invoice,
      and(
        eq(invoice.reservationId, reservation.id),
        eq(invoice.userId, userId),
      ),
    )
    .where(eq(reservation.userId, userId))
    .orderBy(desc(reservation.createdAt), desc(reservation.id))
    .limit(ORDER_PAGE_SIZE + 1)
    .offset((page - 1) * ORDER_PAGE_SIZE);
}

export async function getCustomerInvoice(userId: string, invoiceId: string) {
  const [row] = await db
    .select()
    .from(invoice)
    .where(and(eq(invoice.id, invoiceId), eq(invoice.userId, userId)))
    .limit(1);
  return row ?? null;
}
