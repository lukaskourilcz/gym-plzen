import { count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import type { Profile } from "@/lib/db/types";
import { toE164 } from "@/lib/helpers/phone";
import { ActionError } from "@/lib/helpers/action";

/**
 * Member service over the Supabase-Auth `profiles` table. Supabase owns
 * `auth.users`; each user has one `profiles` row (id = auth uid) mirroring
 * email/name plus app-specific fields (role, phone, prefs, GDPR consents).
 */

/**
 * The list/detail shape the admin UI consumes. Keeps a `user` (identity) /
 * `profile` (app fields) split so the admin pages read `member.user.email` etc.
 */
export interface MemberWithProfile {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
  };
  profile: Profile | null;
}

function toMember(p: Profile): MemberWithProfile {
  return {
    user: {
      id: p.id,
      name: p.fullName ?? p.email ?? "",
      email: p.email ?? "",
      role: p.role,
      createdAt: p.createdAt,
    },
    profile: p,
  };
}

/**
 * Ensure a profile row exists for a signed-in Supabase user (fallback to the
 * DB trigger) and keep the mirrored email/name fresh. Returns the profile.
 */
export async function ensureProfileForUser(user: {
  id: string;
  email: string | null;
  fullName: string | null;
}): Promise<Profile> {
  // The common case is a plain read: the row exists and the mirrored e-mail is
  // current. Writing on every session lookup would turn each page view of a
  // signed-in visitor into an upsert.
  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  if (existing && existing.email === user.email) return existing;

  const [row] = await db
    .insert(profiles)
    .values({ id: user.id, email: user.email, fullName: user.fullName })
    .onConflictDoUpdate({
      target: profiles.id,
      // Refresh the mirrored identity fields; never overwrite role/prefs.
      set: { email: user.email, updatedAt: new Date() },
    })
    .returning();
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
): Promise<Profile> {
  const normalizedPhone =
    patch.phone !== undefined && patch.phone !== null
      ? toE164(patch.phone)
      : patch.phone;

  const [updated] = await db
    .update(profiles)
    .set({
      ...patch,
      phone: normalizedPhone,
      marketingConsentAt:
        patch.marketingConsent === true ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId))
    .returning();
  return updated!;
}

/** List all members (admin members view). */
export async function listMembers(limit = 200): Promise<MemberWithProfile[]> {
  const rows = await db
    .select()
    .from(profiles)
    .orderBy(desc(profiles.createdAt))
    .limit(limit);
  return rows.map(toMember);
}

/** One member by id. */
export async function getMember(
  userId: string,
): Promise<MemberWithProfile | null> {
  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return row ? toMember(row) : null;
}

/** Roles a profile can hold. `admin` unlocks everything under /admin. */
export type MemberRole = "member" | "admin";

/** How many administrators exist right now. */
export async function countAdmins(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(profiles)
    .where(eq(profiles.role, "admin"));
  return row?.value ?? 0;
}

/**
 * Grant or revoke the administrator role.
 *
 * Refuses to remove the last administrator: locking everyone out of the
 * administration would need database access to undo.
 */
export async function setRole(
  userId: string,
  role: MemberRole,
): Promise<Profile> {
  if (role !== "admin") {
    const [target] = await db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    if (target?.role === "admin" && (await countAdmins()) <= 1) {
      throw new ActionError(
        "Nelze odebrat posledního správce. Nejdřív nastavte jiného.",
      );
    }
  }

  const [updated] = await db
    .update(profiles)
    .set({ role, updatedAt: new Date() })
    .where(eq(profiles.id, userId))
    .returning();
  if (!updated) throw new ActionError("Člena se nepodařilo najít.");
  return updated;
}
