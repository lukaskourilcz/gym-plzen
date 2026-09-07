import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { membership, membershipPlan, payment } from "@/lib/db/schema";
import type { Membership, MembershipPlan, Payment } from "@/lib/db/types";

/**
 * Membership & plan service. Plans are admin-managed products; memberships are
 * per-member subscriptions kept in sync from Stripe webhooks.
 */

// ── Plans ───────────────────────────────────────────────────────────────────

export async function listPlans(
  includeInactive = false,
): Promise<MembershipPlan[]> {
  const query = db
    .select()
    .from(membershipPlan)
    .orderBy(asc(membershipPlan.sortOrder));
  if (includeInactive) return query;
  return db
    .select()
    .from(membershipPlan)
    .where(eq(membershipPlan.isActive, true))
    .orderBy(asc(membershipPlan.sortOrder));
}

export async function getPlan(id: string): Promise<MembershipPlan | null> {
  const [row] = await db
    .select()
    .from(membershipPlan)
    .where(eq(membershipPlan.id, id))
    .limit(1);
  return row ?? null;
}

export async function upsertPlan(input: {
  id?: string;
  name: string;
  description?: string | null;
  priceCents: number;
  currency?: string;
  interval?: string;
  stripePriceId?: string | null;
  stripeProductId?: string | null;
  sessionsPerInterval?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}): Promise<MembershipPlan> {
  const values = {
    name: input.name,
    description: input.description ?? null,
    priceCents: input.priceCents,
    currency: input.currency ?? "czk",
    interval: input.interval ?? "month",
    stripePriceId: input.stripePriceId ?? null,
    stripeProductId: input.stripeProductId ?? null,
    sessionsPerInterval: input.sessionsPerInterval ?? null,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
    updatedAt: new Date(),
  };

  if (input.id) {
    const [row] = await db
      .update(membershipPlan)
      .set(values)
      .where(eq(membershipPlan.id, input.id))
      .returning();
    return row!;
  }
  const [row] = await db.insert(membershipPlan).values(values).returning();
  return row!;
}

// ── Memberships (Stripe-synced) ──────────────────────────────────────────────

/** The member's current active/trialing membership, if any. */
export async function getActiveMembership(
  userId: string,
): Promise<Membership | null> {
  const [row] = await db
    .select()
    .from(membership)
    .where(eq(membership.userId, userId))
    .orderBy(desc(membership.currentPeriodEnd))
    .limit(1);
  if (!row) return null;
  return ["active", "trialing"].includes(row.status) ? row : null;
}

/** True when the member can book without paying per session. */
export async function hasActiveMembership(userId: string): Promise<boolean> {
  return (await getActiveMembership(userId)) !== null;
}

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

// ── Payments (history) ───────────────────────────────────────────────────────

export async function listPaymentsForUser(userId: string): Promise<Payment[]> {
  return db
    .select()
    .from(payment)
    .where(eq(payment.userId, userId))
    .orderBy(desc(payment.createdAt));
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
