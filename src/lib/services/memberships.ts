import { and, asc, desc, eq, gt, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { membership, membershipPlan, payment } from "@/lib/db/schema";
import type { Membership, MembershipPlan, Payment } from "@/lib/db/types";

/**
 * Membership & plan service. Plans are admin-managed products; memberships are
 * historical per-member subscriptions.
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

// ── Historical memberships ──────────────────────────────────────────────

/** The member's current active/trialing membership, if any. */
export async function getActiveMembership(
  userId: string,
  now = new Date(),
): Promise<Membership | null> {
  const [row] = await db
    .select()
    .from(membership)
    .where(
      and(
        eq(membership.userId, userId),
        inArray(membership.status, ["active", "trialing"]),
        lte(membership.currentPeriodStart, now),
        gt(membership.currentPeriodEnd, now),
      ),
    )
    .orderBy(desc(membership.currentPeriodEnd))
    .limit(1);
  return row ?? null;
}

/** True when the member can book without paying per session. */
export async function hasActiveMembership(
  userId: string,
  now = new Date(),
): Promise<boolean> {
  return (await getActiveMembership(userId, now)) !== null;
}

// ── Payments (history) ───────────────────────────────────────────────────────

export async function listPaymentsForUser(userId: string): Promise<Payment[]> {
  return db
    .select()
    .from(payment)
    .where(eq(payment.userId, userId))
    .orderBy(desc(payment.createdAt));
}
