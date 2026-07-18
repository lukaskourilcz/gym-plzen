import { NextResponse, type NextRequest } from "next/server";
import {
  verifyWebhookChallenge,
  verifyWebhookSignature,
} from "@/lib/integrations/whatsapp";
import { logger } from "@/lib/helpers/logger";
import { messages } from "@/lib/services";

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
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn("WhatsApp webhook signature verification failed");
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  try {
    const body = JSON.parse(rawBody) as WhatsAppWebhookBody;
    await handleWhatsAppEvent(body);
  } catch (e) {
    logger.error(e, { where: "whatsapp.webhook" });
    // Ack anyway so Meta doesn't hammer retries on a parse error.
  }

  return NextResponse.json({ received: true });
}

async function handleWhatsAppEvent(body: WhatsAppWebhookBody): Promise<void> {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      // Delivery status updates for messages we sent.
      for (const status of value.statuses ?? []) {
        await messages.updateStatusByProviderId({
          providerMessageId: status.id,
          status: mapStatus(status.status),
          at: status.timestamp ? new Date(Number(status.timestamp) * 1000) : undefined,
        });
      }

      // Inbound support messages — logged for now; the shared inbox UI is a
      // later phase. This is where an auto-reply / routing would hook in.
      for (const message of value.messages ?? []) {
        logger.info("Inbound WhatsApp message", {
          from: message.from,
          type: message.type,
        });
      }
    }
  }
}

function mapStatus(status: string): "sent" | "delivered" | "read" | "failed" {
  switch (status) {
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
      return "failed";
    default:
      return "sent";
  }
}

// Minimal shape of the parts of the payload we consume.
interface WhatsAppWebhookBody {
  entry?: {
    changes?: {
      value: {
        statuses?: { id: string; status: string; timestamp?: string }[];
        messages?: { from: string; type: string }[];
      };
    }[];
  }[];
}
