import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Session } from "./index";

/** The admin role name (mirrors the `admin` plugin config in ./index.ts). */
export const ADMIN_ROLE = "admin";

/** Read the current session on the server, or `null` if signed out. */
export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

type SessionUser = Session["user"];

/**
 * Require an authenticated user in a Server Component / route. Redirects to the
 * login page (with a `next` param) when signed out. Returns the user.
 */
export async function requireUser(nextPath = "/"): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return session.user;
}

/** True when the given user carries the admin role. */
export function isAdmin(user: Pick<SessionUser, "role"> | null | undefined): boolean {
  return user?.role === ADMIN_ROLE;
}

/**
 * Require an admin user. Redirects non-admins to the login page. Use at the top
 * of every admin Server Component / layout and admin server action.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/admin")}`);
  }
  if (!isAdmin(session.user)) {
    redirect("/login?error=forbidden");
  }
  return session.user;
}

/**
 * Assert admin access inside a server action, throwing instead of redirecting.
 * Returns the admin user so the action can attribute changes to them.
 */
export async function assertAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session || !isAdmin(session.user)) {
    throw new Error("Unauthorized: administrator access required.");
  }
  return session.user;
}
