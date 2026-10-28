import { readBodyBytes, BodyReadError } from "@/lib/helpers/limited-body";
import { NextResponse, type NextRequest } from "next/server";
import {
  verifyWebhookChallenge,
  verifyWebhookSignature,
} from "@/lib/integrations/whatsapp";
import { logger } from "@/lib/helpers/logger";
import { messages } from "@/lib/services";
import { z } from "zod";

/**
 * WhatsApp Cloud API webhook.
 *  - GET  handles Meta's verification handshake (echoes hub.challenge).
 *  - POST receives message + status events; we update delivery status and log
 *    inbound support messages. Signature is verified against the app secret.
 */

export async function GET(request: NextRequest) {
  const challenge = verifyWebhookChallenge(request.nextUrl.searchParams);
  if (challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification_failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = (await readBodyBytes(request, 262_144)).toString("utf8");
  } catch (error) {
    return NextResponse.json(
      { error: "invalid_body" },
      {
        status:
          error instanceof BodyReadError
            ? error.reason === "too_large"
              ? 413
              : 408
            : 400,
      },
    );
  }
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn("WhatsApp webhook signature verification failed");
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch (e) {
    logger.warn("Invalid WhatsApp webhook JSON", { error: String(e) });
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn("Invalid WhatsApp webhook structure");
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    await handleWhatsAppEvent(parsed.data);
  } catch (e) {
    logger.error(e, { where: "whatsapp.webhook" });
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleWhatsAppEvent(
  body: z.infer<typeof webhookSchema>,
): Promise<void> {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      // Delivery status updates for messages we sent.
      for (const candidate of value.statuses ?? []) {
        const parsed = statusSchema.safeParse(candidate);
        if (!parsed.success) {
          // Isolate malformed items; one bad date must not prevent the rest
          // of an authenticated batch from reaching the durable ledger.
          logger.warn("Invalid WhatsApp delivery status ignored");
          continue;
        }
        const status = parsed.data;
        await messages.updateStatusByProviderId({
          providerMessageId: status.id,
          status: status.status,
          at:
            status.timestamp === undefined
              ? undefined
              : new Date(Number(status.timestamp) * 1000),
        });
      }

      // Inbound support messages : logged for now; the shared inbox UI is a
      // later phase. This is where an auto-reply / routing would hook in.
      for (const message of value.messages ?? []) {
        const parsed = inboundSchema.safeParse(message);
        if (parsed.success)
          logger.info("Inbound WhatsApp message", { type: parsed.data.type });
      }
    }
  }
}

// The outer envelope is validated before any writes. Individual unknown or
// malformed statuses are ignored rather than being interpreted as "sent".
const webhookSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z
          .array(
            z.object({
              value: z.object({
                statuses: z.array(z.unknown()).optional(),
                messages: z.array(z.unknown()).optional(),
              }),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});
const statusSchema = z.object({
  id: z.string().min(1).max(256),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  timestamp: z
    .string()
    .regex(/^\d+$/)
    .refine((value) => {
      const millis = Number(value) * 1000;
      return (
        Number.isSafeInteger(millis) &&
        !Number.isNaN(new Date(millis).getTime())
      );
    })
    .optional(),
});
const inboundSchema = z.object({ type: z.string().min(1).max(64) });
