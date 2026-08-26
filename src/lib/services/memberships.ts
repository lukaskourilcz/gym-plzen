import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payment } from "@/lib/db/schema";
import type { Payment } from "@/lib/db/types";

/**
 * Persistence for reservation payments. Historical membership tables remain
 * in the schema for migration compatibility, but the live product sells only
 * one-off entries.
 */

export async function getPaymentByCheckoutSessionId(
  checkoutSessionId: string,
): Promise<Payment | null> {
  const [row] = await db
    .select()
    .from(payment)
    .where(eq(payment.stripeCheckoutSessionId, checkoutSessionId))
    .limit(1);
  return row ?? null;
}

export async function recordPayment(input: {
  userId?: string | null;
  reservationId?: string | null;
  membershipId?: string | null;
  type: Payment["type"];
  status: Payment["status"];
  amountCents: number;
  currency?: string;
  stripePaymentIntentId?: string | null;
  stripeInvoiceId?: string | null;
  stripeCheckoutSessionId?: string | null;
}): Promise<Payment> {
  const values = {
    userId: input.userId ?? null,
    reservationId: input.reservationId ?? null,
    membershipId: input.membershipId ?? null,
    type: input.type,
    status: input.status,
    amountCents: input.amountCents,
    currency: input.currency ?? "czk",
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    stripeInvoiceId: input.stripeInvoiceId ?? null,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
    paidAt: input.status === "succeeded" ? new Date() : null,
    updatedAt: new Date(),
  };
  const query = db.insert(payment).values(values);
  const [row] = input.stripeCheckoutSessionId
    ? await query
        .onConflictDoUpdate({
          target: payment.stripeCheckoutSessionId,
          set: values,
        })
        .returning()
    : await query.onConflictDoNothing().returning();
  if (!row) throw new Error("Payment record could not be persisted.");
  return row;
}

export async function markCheckoutPaymentFailed(
  checkoutSessionId: string,
  failureReason: string,
) {
  await db
    .update(payment)
    .set({ status: "failed", failureReason, updatedAt: new Date() })
    .where(eq(payment.stripeCheckoutSessionId, checkoutSessionId));
}
