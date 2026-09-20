import { archiveSentEmail } from "@/lib/services/email-archive";
import { Resend } from "resend";
import { brandedSender } from "@/lib/config/email-templates";
import { hasEnv, requireEnv } from "@/lib/env";
import { logger } from "@/lib/helpers/logger";

/**
 * Resend adapter for transactional email (codes, confirmations) and marketing
 * campaigns. Created lazily; when unconfigured, `sendEmail` logs and returns a
 * "skipped" result instead of throwing, so local development works offline.
 */

let cached: Resend | null = null;

export function isResendConfigured(): boolean {
  return hasEnv("RESEND_API_KEY", "RESEND_FROM_EMAIL");
}

function client(): Resend {
  if (cached) return cached;
  const { RESEND_API_KEY } = requireEnv("RESEND_API_KEY");
  cached = new Resend(RESEND_API_KEY);
  return cached;
}

/** A file sent with the message. `content` is base64, as Resend expects. */
export interface EmailAttachment {
  filename: string;
  content: string;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  idempotencyKey?: string;
}

export interface SendEmailResult {
  sent: boolean;
  providerMessageId?: string;
  error?: string;
}

export async function sendEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    logger.warn("Resend not configured : email not sent", {
      to: params.to,
      subject: params.subject,
    });
    return { sent: false, error: "resend_not_configured" };
  }

  const { RESEND_FROM_EMAIL } = requireEnv("RESEND_FROM_EMAIL");
  const payload = {
    from: brandedSender(RESEND_FROM_EMAIL),
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
    attachments: params.attachments?.length ? params.attachments : undefined,
  };
  try {
    let { data, error } = await client().emails.send(payload, {
      idempotencyKey: params.idempotencyKey,
    });
    // Resend allows a couple of requests per second, and one confirmed
    // booking sends the customer's confirmation, the operator's notice and
    // sometimes a document within the same moment. A refusal for that reason
    // is not a failure yet: wait out the window and send it once more.
    if (error && error.name === "rate_limit_exceeded") {
      logger.warn("Resend rate limit reached : retrying once", {
        subject: params.subject,
      });
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_PAUSE_MS));
      ({ data, error } = await client().emails.send(payload, {
        idempotencyKey: params.idempotencyKey,
      }));
    }
    if (error) {
      logger.error(error, { where: "resend.sendEmail" });
      return { sent: false, error: error.message };
    }
    if (data?.id) {
      try {
        await archiveSentEmail({
          providerMessageId: data.id,
          sender: payload.from,
          recipient: Array.isArray(params.to)
            ? params.to.join(", ")
            : params.to,
          subject: params.subject,
          html: params.html,
          bodyText: params.text,
          attachmentNames: params.attachments?.map((a) => a.filename) ?? [],
        });
      } catch {
        // A storage failure must never turn an accepted send into a retry.
        logger.error("Email archive write failed", {
          where: "resend.archive",
          providerMessageId: data.id,
        });
      }
    }
    return { sent: true, providerMessageId: data?.id };
  } catch (e) {
    logger.error(e, { where: "resend.sendEmail" });
    return { sent: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

/** Long enough for Resend's per-second window to reopen. */
const RATE_LIMIT_PAUSE_MS = 1_100;
