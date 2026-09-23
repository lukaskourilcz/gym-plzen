import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function keyBuffer(key: string): Buffer {
  if (!/^[a-fA-F0-9]{64}$/.test(key))
    throw new Error("Invalid access-code encryption key");
  return Buffer.from(key, "hex");
}
/** AES-GCM authenticates the identity as well as the encrypted PIN. */
export function encryptPin(pin: string, identity: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuffer(key), iv);
  cipher.setAAD(Buffer.from(identity));
  const ciphertext = Buffer.concat([
    cipher.update(pin, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
export function decryptPin(
  value: string,
  identity: string,
  key: string,
): string {
  try {
    const [version, nonce, tag, data, extra] = value.split(".");
    if (version !== "v1" || !nonce || !tag || !data || extra) throw new Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyBuffer(key),
      Buffer.from(nonce, "base64url"),
    );
    decipher.setAAD(Buffer.from(identity));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const pin = Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    if (!/^[1-9]{6}$/.test(pin)) throw new Error();
    return pin;
  } catch {
    throw new Error("Access-code decryption failed");
  }
}
