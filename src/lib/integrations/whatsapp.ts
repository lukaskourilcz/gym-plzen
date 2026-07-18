import { env, hasEnv, requireEnv } from "@/lib/env";
import { httpRequest } from "@/lib/helpers/http";
import { verifyHmacSignature } from "@/lib/helpers/crypto";
import { logger } from "@/lib/helpers/logger";

/**
 * WhatsApp Business Cloud API adapter.
 *
 * Business-initiated messages (the access-code notification) must use an
 * approved *template*; free-form replies within the 24h support window use a
 * plain text message. Both paths are covered here.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const GRAPH_VERSION = "v21.0";

export function isWhatsAppConfigured(): boolean {
  return hasEnv("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID");
}

function baseUrl(): string {
  const { WHATSAPP_PHONE_NUMBER_ID } = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  return `https://graph.facebook.com/${GRAPH_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}`;
}

function authHeader(): Record<string, string> {
  const { WHATSAPP_ACCESS_TOKEN } = requireEnv("WHATSAPP_ACCESS_TOKEN");
  return { authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` };
}

export interface WhatsAppSendResult {
  sent: boolean;
  providerMessageId?: string;
  error?: string;
}

interface GraphMessageResponse {
  messages?: { id: string }[];
}

/**
 * Send an approved template message (used for the access code — a
 * business-initiated notification). `bodyParams` fill the template's {{n}}
 * placeholders in order.
 */
export async function sendTemplateMessage(params: {
  to: string; // E.164 without the leading "+" is also accepted by the API
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
}): Promise<WhatsAppSendResult> {
  if (!isWhatsAppConfigured()) {
    logger.warn("WhatsApp not configured — template not sent", { to: params.to });
    return { sent: false, error: "whatsapp_not_configured" };
  }
  try {
    const res = await httpRequest<GraphMessageResponse>(
      `${baseUrl()}/messages`,
      {
        method: "POST",
        headers: authHeader(),
        retries: 2,
        json: {
          messaging_product: "whatsapp",
          to: params.to,
          type: "template",
          template: {
            name: params.templateName,
            language: { code: params.languageCode ?? "cs" },
            components: params.bodyParams?.length
              ? [
                  {
                    type: "body",
                    parameters: params.bodyParams.map((text) => ({
                      type: "text",
                      text,
                    })),
                  },
                ]
              : undefined,
          },
        },
      },
    );
    return { sent: true, providerMessageId: res.messages?.[0]?.id };
  } catch (e) {
    logger.error(e, { where: "whatsapp.sendTemplateMessage" });
    return { sent: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

/** Send a free-form text reply (only valid inside the 24h support window). */
export async function sendTextMessage(params: {
  to: string;
  body: string;
}): Promise<WhatsAppSendResult> {
  if (!isWhatsAppConfigured()) {
    return { sent: false, error: "whatsapp_not_configured" };
  }
  try {
    const res = await httpRequest<GraphMessageResponse>(
      `${baseUrl()}/messages`,
      {
        method: "POST",
        headers: authHeader(),
        retries: 2,
        json: {
          messaging_product: "whatsapp",
          to: params.to,
          type: "text",
          text: { body: params.body },
        },
      },
    );
    return { sent: true, providerMessageId: res.messages?.[0]?.id };
  } catch (e) {
    logger.error(e, { where: "whatsapp.sendTextMessage" });
    return { sent: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

/**
 * Verify the `X-Hub-Signature-256` header on an inbound webhook against the raw
 * request body. Returns false when the app secret is not configured.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!env.WHATSAPP_APP_SECRET || !signatureHeader) return false;
  return verifyHmacSignature(rawBody, signatureHeader, env.WHATSAPP_APP_SECRET);
}

/** Verify the GET webhook-subscription handshake Meta performs on setup. */
export function verifyWebhookChallenge(query: URLSearchParams): string | null {
  const mode = query.get("hub.mode");
  const token = query.get("hub.verify_token");
  const challenge = query.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token &&
    env.WHATSAPP_VERIFY_TOKEN &&
    token === env.WHATSAPP_VERIFY_TOKEN
  ) {
    return challenge;
  }
  return null;
}
