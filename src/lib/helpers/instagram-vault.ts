import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";
import { InstagramError } from "@/lib/integrations/instagram";

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
export function encryptInstagramToken(token: string, accountId: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key("token"), iv);
  cipher.setAAD(Buffer.from(accountId));
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
export function decryptInstagramToken(value: string, accountId: string) {
  try {
    const [version, nonce, tag, data, extra] = value.split(".");
    if (version !== "v1" || !nonce || !tag || !data || extra) throw new Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key("token"),
      Buffer.from(nonce, "base64url"),
    );
    decipher.setAAD(Buffer.from(accountId));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
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
      !equal(signature(payload, "oauth"), Buffer.from(mac, "base64url"))
    )
      return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
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
    if (!equal(expected, Buffer.from(mac, "base64url"))) throw new Error();
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
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
      equal(signature(payload, "receipt"), Buffer.from(mac, "base64url")) &&
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).expires >
        Date.now(),
    );
  } catch {
    return false;
  }
}
