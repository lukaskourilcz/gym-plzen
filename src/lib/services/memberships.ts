import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { membership, payment } from "@/lib/db/schema";
import type { Membership, Payment } from "@/lib/db/types";

/** Upsert a membership from a Stripe subscription (called by the webhook). */
export async function upsertMembershipFromStripe(input: {
  userId: string;
  stripeSubscriptionId: string;
  status: Membership["status"];
  planId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}): Promise<void> {
  const now = new Date();
  const existing = await db
    .select({ id: membership.id })
    .from(membership)
    .where(eq(membership.stripeSubscriptionId, input.stripeSubscriptionId))
    .limit(1);

  const values = {
    userId: input.userId,
    planId: input.planId ?? null,
    status: input.status,
    stripeSubscriptionId: input.stripeSubscriptionId,
    currentPeriodStart: input.currentPeriodStart ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    updatedAt: now,
  };

  if (existing[0]) {
    await db
      .update(membership)
      .set(values)
      .where(eq(membership.id, existing[0].id));
  } else {
    await db.insert(membership).values(values);
  }
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
          setWhere:
            input.status === "pending"
              ? inArray(payment.status, ["pending"])
              : ne(payment.status, "refunded"),
        })
        .returning()
    : await query.onConflictDoNothing().returning();
  if (row) return row;
  if (input.stripeCheckoutSessionId) {
    const [existing] = await db
      .select()
      .from(payment)
      .where(eq(payment.stripeCheckoutSessionId, input.stripeCheckoutSessionId))
      .limit(1);
    if (existing) return existing;
  }
  throw new Error("Payment record could not be persisted.");
}

export async function markCheckoutPaymentFailed(
  checkoutSessionId: string,
  failureReason: string,
) {
  await db
    .update(payment)
    .set({ status: "failed", failureReason, updatedAt: new Date() })
    .where(
      and(
        eq(payment.stripeCheckoutSessionId, checkoutSessionId),
        inArray(payment.status, ["pending", "processing"]),
      ),
    );
}
