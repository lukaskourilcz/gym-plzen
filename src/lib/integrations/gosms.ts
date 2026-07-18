import { env, hasEnv, requireEnv } from "@/lib/env";
import { httpRequest } from "@/lib/helpers/http";
import { logger } from "@/lib/helpers/logger";

/**
 * GoSMS adapter — OPTIONAL SMS fallback channel. Disabled by default (see the
 * plan: WhatsApp + email are usually enough). Enabled per-member via the
 * `notifyBySms` profile flag, and only functional when GoSMS keys are set.
 *
 * GoSMS uses OAuth2 client-credentials; we cache the token until it expires.
 * Docs: https://doc.gosms.cz/
 */

const TOKEN_URL = "https://app.gosms.cz/oauth/v2/token";
const SEND_URL = "https://app.gosms.cz/api/v1/messages";

let tokenCache: { token: string; expiresAt: number } | null = null;

export function isGoSmsConfigured(): boolean {
  return hasEnv("GOSMS_CLIENT_ID", "GOSMS_CLIENT_SECRET");
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.token;
  }
  const { GOSMS_CLIENT_ID, GOSMS_CLIENT_SECRET } = requireEnv(
    "GOSMS_CLIENT_ID",
    "GOSMS_CLIENT_SECRET",
  );
  const basic = Buffer.from(`${GOSMS_CLIENT_ID}:${GOSMS_CLIENT_SECRET}`).toString(
    "base64",
  );
  const res = await httpRequest<{ access_token: string; expires_in: number }>(
    TOKEN_URL,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      retries: 2,
    },
  );
  tokenCache = {
    token: res.access_token,
    expiresAt: now + res.expires_in * 1000,
  };
  return res.access_token;
}

export interface SmsSendResult {
  sent: boolean;
  providerMessageId?: string;
  error?: string;
}

/** Send a single SMS. Requires a configured channel id. */
export async function sendSms(params: {
  to: string; // E.164
  message: string;
}): Promise<SmsSendResult> {
  if (!isGoSmsConfigured() || !env.GOSMS_CHANNEL) {
    return { sent: false, error: "gosms_not_configured" };
  }
  try {
    const token = await getAccessToken();
    const res = await httpRequest<{ id?: string | number }>(SEND_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      retries: 2,
      json: {
        message: params.message,
        recipients: params.to,
        channel: Number(env.GOSMS_CHANNEL),
      },
    });
    return { sent: true, providerMessageId: res.id ? String(res.id) : undefined };
  } catch (e) {
    logger.error(e, { where: "gosms.sendSms" });
    return { sent: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
