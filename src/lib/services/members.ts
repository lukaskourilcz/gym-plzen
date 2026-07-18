import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberProfile, user } from "@/lib/db/schema";
import type { MemberProfile, User } from "@/lib/db/types";
import { toE164 } from "@/lib/helpers/phone";

/**
 * Member service — the profile that sits alongside Better Auth's `user`. A
 * profile row is created lazily the first time it is needed.
 */

export interface MemberWithProfile {
  user: User;
  profile: MemberProfile | null;
}

/** Ensure a profile row exists for a user and return it. */
export async function ensureProfile(userId: string): Promise<MemberProfile> {
  const [existing] = await db
    .select()
    .from(memberProfile)
    .where(eq(memberProfile.userId, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(memberProfile)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost the insert race — re-read.
  const [row] = await db
    .select()
    .from(memberProfile)
    .where(eq(memberProfile.userId, userId))
    .limit(1);
  return row!;
}

/** Update mutable profile fields. Phone is normalised to E.164. */
export async function updateProfile(
  userId: string,
  patch: Partial<{
    phone: string | null;
    notifyByWhatsapp: boolean;
    notifyBySms: boolean;
    marketingConsent: boolean;
    note: string | null;
  }>,
): Promise<MemberProfile> {
  await ensureProfile(userId);

  const normalizedPhone =
    patch.phone !== undefined && patch.phone !== null
      ? toE164(patch.phone)
      : patch.phone;

  const [updated] = await db
    .update(memberProfile)
    .set({
      ...patch,
      phone: normalizedPhone,
      marketingConsentAt:
        patch.marketingConsent === true ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(memberProfile.userId, userId))
    .returning();
  return updated!;
}

/** Persist the member's Stripe customer id after first checkout. */
export async function setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
  await ensureProfile(userId);
  await db
    .update(memberProfile)
    .set({ stripeCustomerId, updatedAt: new Date() })
    .where(eq(memberProfile.userId, userId));
}

/** List all members with their profile (admin members view). */
export async function listMembers(limit = 200): Promise<MemberWithProfile[]> {
  const rows = await db
    .select({ user, profile: memberProfile })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .orderBy(desc(user.createdAt))
    .limit(limit);
  return rows.map((r) => ({ user: r.user, profile: r.profile }));
}

/** One member by id, with profile. */
export async function getMember(userId: string): Promise<MemberWithProfile | null> {
  const [row] = await db
    .select({ user, profile: memberProfile })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);
  return row ? { user: row.user, profile: row.profile } : null;
}
