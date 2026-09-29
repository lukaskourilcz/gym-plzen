import { archiveSentEmail } from "@/lib/services/email-archive";
import { createResendSender } from "./resend-transport";
import { brandedSender } from "@/lib/config/email-templates";
import { hasEnv, requireEnv } from "@/lib/env";
import { logger } from "@/lib/helpers/logger";

/**
 * Resend adapter for transactional email (codes, confirmations) and marketing
 * campaigns. Created lazily; when unconfigured, `sendEmail` logs and returns a
 * "skipped" result instead of throwing, so local development works offline.
 */

export function isResendConfigured(): boolean {
  return hasEnv("RESEND_API_KEY", "RESEND_FROM_EMAIL");
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

  const { RESEND_FROM_EMAIL, RESEND_API_KEY } = requireEnv(
    "RESEND_FROM_EMAIL",
    "RESEND_API_KEY",
  );
  const sender = brandedSender(RESEND_FROM_EMAIL);
  const result = await createResendSender({
    apiKey: RESEND_API_KEY,
    from: sender,
    baseUrl: process.env.RESEND_BASE_URL,
  })(params);
  if (!result.sent) {
    logger.warn("Resend did not confirm email acceptance", {
      reason: result.error,
    });
    return result;
  }
  if (result.providerMessageId) {
    try {
      await archiveSentEmail({
        providerMessageId: result.providerMessageId,
        sender,
        recipient: Array.isArray(params.to) ? params.to.join(", ") : params.to,
        subject: params.subject,
        html: params.html,
        bodyText: params.text,
        attachmentNames: params.attachments?.map((a) => a.filename) ?? [],
      });
    } catch {
      // A storage failure must never turn an accepted send into a retry.
      logger.error("Email archive write failed", {
        where: "resend.archive",
        providerMessageId: result.providerMessageId,
      });
    }
  }
  return result;
}
