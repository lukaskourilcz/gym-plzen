import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfileForUser } from "@/lib/services/members";
import {
  DEMO_ADMIN_EMAIL,
  DEMO_CUSTOMER_EMAIL,
  DEMO_CUSTOMER_ID,
  hasDemoAdminSession,
  hasDemoCustomerSession,
} from "@/lib/auth/demo";

/**
 * Authentication guards over **Supabase Auth**. `getSessionUser()` reads the
 * verified Supabase user, ensures a `profiles` row exists, and resolves the
 * app role. Server Components use `requireUser`/`requireAdmin`; server actions
 * use `assertAdmin` (throws instead of redirecting).
 */

export const ADMIN_ROLE = "admin";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/** The current user (verified via Supabase), or null when signed out. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (await hasDemoAdminSession()) {
    return {
      id: "00000000-0000-0000-0000-000000000001",
      email: DEMO_ADMIN_EMAIL,
      name: "Demo administrátor",
      role: ADMIN_ROLE,
    };
  }

  if (await hasDemoCustomerSession()) {
    return {
      id: DEMO_CUSTOMER_ID,
      email: DEMO_CUSTOMER_EMAIL,
      name: "Klára Nováková",
      role: "member",
    };
  }

  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ?? null;
  const profile = await ensureProfileForUser({
    id: user.id,
    email: user.email ?? null,
    fullName,
  });

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile.fullName ?? fullName ?? user.email ?? "",
    role: profile.role,
  };
}

/** Session wrapper: `{ user }` or null (kept for action `authorize` callbacks). */
export async function getSession(): Promise<{ user: SessionUser } | null> {
  const user = await getSessionUser();
  return user ? { user } : null;
}

export function isAdmin(
  user: Pick<SessionUser, "role"> | null | undefined,
): boolean {
  return user?.role === ADMIN_ROLE;
}

/** Require an authenticated user; redirect to login otherwise. */
export async function requireUser(nextPath = "/"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** Require an admin user; redirect non-admins to login. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/admin")}`);
  if (!isAdmin(user)) redirect("/login?error=forbidden");
  return user;
}

/** Assert admin access inside a server action (throws instead of redirecting). */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    throw new Error("Unauthorized: administrator access required.");
  }
  return user;
}
