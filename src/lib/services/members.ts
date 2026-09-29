import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import type { Profile } from "@/lib/db/types";
import { toE164 } from "@/lib/helpers/phone";
import { ActionError } from "@/lib/helpers/action";
import { logger } from "@/lib/helpers/logger";
import { hasMemberAction, record as recordActivity } from "./activity";
import { notifyNewMember } from "./operator-notifications";
import { withOperationLock } from "./operation-lock";

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

/**
 * A visitor finished registering: they confirmed their e-mail or came back
 * from Google for the first time. Writes the history entry and informs the
 * operator, once per member however many times the route is opened, and never
 * at the cost of the sign-in that called it.
 */
export async function recordRegistration(params: {
  userId: string;
  email?: string | null;
  name?: string | null;
}): Promise<void> {
  try {
    // The history row references profiles. The Auth trigger normally creates
    // that row; ensure it here as well if the trigger is unavailable.
    await ensureProfileForUser({
      id: params.userId,
      email: params.email ?? null,
      fullName: params.name ?? null,
    });
    if (await hasMemberAction(params.userId, "member.registered")) return;
    const label = params.name?.trim() || params.email?.trim() || "";
    await recordActivity({
      action: "member.registered",
      actorType: "customer",
      actorId: params.userId,
      actorLabel: label || null,
      memberId: params.userId,
      summary: `${label || "Nový zákazník"} dokončil registraci.`,
    });
    await notifyNewMember(params);
  } catch (error) {
    logger.error(error, { where: "members.recordRegistration" });
  }
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
  if (patch.phone && !normalizedPhone)
    throw new ActionError("Zadejte platné telefonní číslo.");

  const [updated] = await db
    .update(profiles)
    .set({
      ...patch,
      phone: normalizedPhone,
      phoneVerified:
        normalizedPhone !== undefined
          ? sql`case when ${profiles.phone} is not distinct from ${normalizedPhone} then ${profiles.phoneVerified} else false end`
          : undefined,
      marketingConsentAt:
        patch.marketingConsent === true ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId))
    .returning();
  if (!updated) throw new ActionError("Člena se nepodařilo najít.");
  return updated;
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
  return withOperationLock("admin-roles", () => setRoleLocked(userId, role));
}

async function setRoleLocked(
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
