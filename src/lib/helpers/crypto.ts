import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

/**
 * Cryptographic helpers used across access codes and webhook verification.
 * Server-only (imports node:crypto).
 */

/**
 * Generate a Nuki-compatible six-digit Keypad PIN. Nuki accepts digits 1–9
 * only and reserves the `12` prefix.
 */
export function generateNukiKeypadCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 6 }, () => randomInt(1, 10)).join("");
  } while (code.startsWith("12"));
  return code;
}

/** One-way hash of an access code for storage (we never need the plaintext back). */
export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Constant-time comparison of two strings (avoids timing side-channels). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify an HMAC-SHA256 webhook signature. `signatureHeader` may include a
 * scheme prefix like "sha256=" (as WhatsApp/Meta sends), which is stripped.
 */
export function verifyHmacSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const received = signatureHeader.replace(/^sha256=/, "");
  return safeEqual(expected, received);
}
