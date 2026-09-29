import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/helpers/crypto";

export const RECOVERY_PROOF_COOKIE = "navi_password_recovery";
export const RECOVERY_PROOF_PATH = "/reset-password";
const LIFETIME_SECONDS = 15 * 60;

/** Only a verified recovery link may mint this short-lived, HttpOnly proof. */
export function createRecoveryProof(
  userId: string,
  now = Date.now(),
  key = env.ACCESS_CODE_ENCRYPTION_KEY,
): string | null {
  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) return null;
  const expires = Math.floor(now / 1000) + LIFETIME_SECONDS;
  const payload = `${userId}.${expires}`;
  const signature = createHmac("sha256", Buffer.from(key, "hex"))
    .update(`password-recovery-v1:${payload}`)
    .digest("hex");
  return `${payload}.${signature}`;
}

export function validRecoveryProof(
  proof: string | undefined,
  userId: string,
  now = Date.now(),
  key = env.ACCESS_CODE_ENCRYPTION_KEY,
): boolean {
  if (!proof || !key) return false;
  const parts = proof.split(".");
  if (parts.length !== 3 || parts[0] !== userId) return false;
  const expires = Number(parts[1]);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(now / 1000))
    return false;
  if (expires > Math.floor(now / 1000) + LIFETIME_SECONDS) return false;
  const expected = createRecoveryProof(
    userId,
    (expires - LIFETIME_SECONDS) * 1000,
    key,
  );
  return Boolean(expected && safeEqual(expected, proof));
}

export function recoveryProofCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: RECOVERY_PROOF_PATH,
    maxAge: LIFETIME_SECONDS,
  };
}
