import { createHmac } from "node:crypto";
import type { NextResponse } from "next/server";
import { safeEqual } from "@/lib/helpers/crypto";
import { logger } from "@/lib/helpers/logger";
import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

/**
 * Proof that this browser has just come through a password-recovery link.
 *
 * `/reset-password` sets a new password without asking for the current one,
 * which is only acceptable right after the recovery e-mail proved control of
 * the address. A Supabase session alone does not say how it was created, so
 * the routes that complete a recovery (`/auth/confirm` with `type=recovery`
 * and the older `/auth/callback?next=/reset-password` exchange) set this
 * short-lived, httpOnly, HMAC-signed cookie bound to the user. Anyone holding
 * only an existing session (a shared computer, a stolen cookie) cannot mint
 * it, and has to change the password in the account with the current one.
 *
 * Server-only (node:crypto). The signing key is derived from a server secret
 * that every deployment already has, so nothing new has to be configured.
 */

export const RECOVERY_GRANT_COOKIE = "navi_password_recovery";
export const RECOVERY_GRANT_TTL_MS = 15 * 60 * 1000;

/** The derived key, or null when no server secret is available. */
export function recoveryGrantKey(
  source: Record<string, string | undefined> = process.env,
): string | null {
  const secret =
    source.SUPABASE_SECRET_KEY ||
    source.SUPABASE_SERVICE_ROLE_KEY ||
    source.DATABASE_URL;
  if (!secret) return null;
  return createHmac("sha256", secret)
    .update("navi/password-recovery-grant/v1")
    .digest("hex");
}

function signature(key: string, userId: string, issuedAt: number): string {
  return createHmac("sha256", key)
    .update(`${userId}.${issuedAt}`)
    .digest("base64url");
}

/** Cookie value for `userId`, or null when there is no key to sign with. */
export function signRecoveryGrant(
  userId: string,
  issuedAt = Date.now(),
  key = recoveryGrantKey(),
): string | null {
  if (!key) return null;
  return `${issuedAt}.${signature(key, userId, issuedAt)}`;
}

/** Whether `value` is an unexpired grant issued to exactly this user. */
export function verifyRecoveryGrant(
  value: string | null | undefined,
  userId: string,
  now = Date.now(),
  key = recoveryGrantKey(),
): boolean {
  if (!value || !key) return false;
  const [rawIssuedAt, received, ...rest] = value.split(".");
  if (!rawIssuedAt || !received || rest.length > 0) return false;
  const issuedAt = Number(rawIssuedAt);
  if (!Number.isSafeInteger(issuedAt)) return false;
  if (issuedAt > now || now - issuedAt > RECOVERY_GRANT_TTL_MS) return false;
  return safeEqual(signature(key, userId, issuedAt), received);
}

/** Cookie attributes: server-only, this site only, gone after the window. */
export function recoveryGrantCookieOptions(
  secure: boolean = SUPABASE_COOKIE_OPTIONS.secure,
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: Math.floor(RECOVERY_GRANT_TTL_MS / 1000),
  };
}

/** Set the grant on a route handler's response after a verified recovery. */
export function attachRecoveryGrant(
  response: NextResponse,
  userId: string,
): void {
  const value = signRecoveryGrant(userId);
  if (!value) {
    // Without a key the reset page asks for a new link; say why in the logs.
    logger.error(new Error("Password recovery grant has no signing key"), {
      where: "recoveryGrant.attach",
    });
    return;
  }
  response.cookies.set(
    RECOVERY_GRANT_COOKIE,
    value,
    recoveryGrantCookieOptions(),
  );
}
