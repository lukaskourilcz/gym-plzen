import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";
import { z } from "zod";
import {
  InstagramError,
  parseInstagramJson,
} from "@/lib/integrations/instagram";

function decode(value: string) {
  const bytes = Buffer.from(value, "base64url");
  if (!/^[A-Za-z0-9_-]+$/.test(value) || bytes.toString("base64url") !== value)
    throw new Error("Invalid encoding");
  return bytes;
}
function key(purpose: string) {
  if (!env.INSTAGRAM_TOKEN_ENCRYPTION_KEY)
    throw new InstagramError("not_configured");
  return createHmac(
    "sha256",
    Buffer.from(env.INSTAGRAM_TOKEN_ENCRYPTION_KEY, "hex"),
  )
    .update(`navi-instagram-v1:${purpose}`)
    .digest();
}
type TokenVersion = "v1" | "v2" | "v3";
const purposes: Record<TokenVersion, string> = {
  v1: "token",
  v2: "unified-token",
  v3: "facebook-user-token",
};
export function encryptInstagramToken(
  token: string,
  accountId: string,
  version: TokenVersion = "v1",
) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(purposes[version]), iv);
  cipher.setAAD(Buffer.from(accountId));
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return [
    version,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
export function decryptInstagramToken(value: string, accountId: string) {
  try {
    const [version, nonce, tag, data, extra] = value.split(".");
    if (!(version && version in purposes) || !nonce || !tag || !data || extra)
      throw new Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(purposes[version as TokenVersion]),
      decode(nonce),
    );
    decipher.setAAD(Buffer.from(accountId));
    decipher.setAuthTag(decode(tag));
    return Buffer.concat([
      decipher.update(decode(data)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new InstagramError("authorization");
  }
}
const unifiedToken = z.object({
  token: z.string().min(8).max(8192),
  configId: z.string().regex(/^\d{1,30}$/),
  businessId: z.string().regex(/^\d{1,30}$/),
});
const facebookUserToken = z.object({
  token: z.string().min(8).max(8192),
  appId: z.string().min(1).max(64),
});
export function encryptFacebookUserToken(token: string, accountId: string) {
  if (!env.INSTAGRAM_APP_ID) throw new InstagramError("not_configured");
  return encryptInstagramToken(
    JSON.stringify({ token, appId: env.INSTAGRAM_APP_ID }),
    accountId,
    "v3",
  );
}

/** The encrypted version binds a token to its provider and prevents a legacy refresh. */
export function readStoredInstagramToken(
  ciphertext: string,
  accountId: string,
): { provider: "instagram" | "unified" | "facebook-user"; token: string } {
  const raw = decryptInstagramToken(ciphertext, accountId);
  if (ciphertext.startsWith("v1."))
    return { provider: "instagram", token: raw };
  try {
    if (ciphertext.startsWith("v3.")) {
      const grant = facebookUserToken.parse(JSON.parse(raw));
      if (grant.appId !== env.INSTAGRAM_APP_ID) throw new Error();
      return { provider: "facebook-user", token: grant.token };
    }
    const grant = unifiedToken.parse(JSON.parse(raw));
    if (grant.configId !== env.INSTAGRAM_UNIFIED_CONFIG_ID) throw new Error();
    return { provider: "unified", token: grant.token };
  } catch {
    throw new InstagramError("authorization");
  }
}
function signature(payload: string, purpose: string) {
  return createHmac("sha256", key(purpose)).update(payload).digest();
}
function equal(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}
export function createInstagramState(adminId: string, now = Date.now()) {
  const nonce = randomBytes(32).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ nonce, adminId, at: now }),
  ).toString("base64url");
  return {
    nonce,
    cookie: `${payload}.${signature(payload, "oauth").toString("base64url")}`,
  };
}
export function verifyInstagramState(
  cookie: string | undefined,
  nonce: string | null,
  adminId: string,
  now = Date.now(),
) {
  try {
    if (!cookie || cookie.length > 2048 || !nonce || nonce.length > 128)
      return false;
    const [payload, mac, extra] = cookie.split(".");
    if (
      !payload ||
      !mac ||
      extra ||
      !equal(signature(payload, "oauth"), decode(mac))
    )
      return false;
    const data = JSON.parse(decode(payload).toString("utf8"));
    return (
      typeof data.nonce === "string" &&
      typeof data.at === "number" &&
      data.adminId === adminId &&
      now >= data.at &&
      now - data.at <= 10 * 60_000 &&
      equal(Buffer.from(data.nonce), Buffer.from(nonce))
    );
  } catch {
    return false;
  }
}
/** Meta deauthorization/data-deletion callbacks are authenticated separately from customer sessions. */
export function verifyInstagramSignedRequest(signed: string) {
  try {
    if (!env.INSTAGRAM_APP_SECRET || signed.length > 16_384) throw new Error();
    const [mac, payload, extra] = signed.split(".");
    if (!mac || !payload || extra) throw new Error();
    const expected = createHmac("sha256", env.INSTAGRAM_APP_SECRET)
      .update(payload)
      .digest();
    if (!equal(expected, decode(mac))) throw new Error();
    const data = parseInstagramJson(decode(payload).toString("utf8")) as {
      algorithm?: unknown;
      user_id?: unknown;
      issued_at: number;
    };
    if (
      data.algorithm !== "HMAC-SHA256" ||
      !/^\d{1,30}$/.test(String(data.user_id)) ||
      !Number.isFinite(data.issued_at) ||
      data.issued_at * 1000 > Date.now() + 300_000
    )
      throw new Error();
    return {
      userId: String(data.user_id),
      issuedAt: new Date(data.issued_at * 1000),
    };
  } catch {
    throw new InstagramError("invalid_state");
  }
}
export function instagramDeletionReceipt() {
  const payload = Buffer.from(
    JSON.stringify({
      nonce: randomBytes(16).toString("hex"),
      expires: Date.now() + 7 * 86400_000,
    }),
  ).toString("base64url");
  return `${payload}.${signature(payload, "receipt").toString("base64url")}`;
}
export function verifyInstagramDeletionReceipt(value: string) {
  try {
    if (value.length > 1024) return false;
    const [payload, mac, extra] = value.split(".");
    return Boolean(
      payload &&
      mac &&
      !extra &&
      equal(signature(payload, "receipt"), decode(mac)) &&
      JSON.parse(decode(payload).toString("utf8")).expires > Date.now(),
    );
  } catch {
    return false;
  }
}
