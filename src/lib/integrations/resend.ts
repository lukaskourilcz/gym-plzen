import { Resend } from "resend";
import { hasEnv, requireEnv } from "@/lib/env";
import { logger } from "@/lib/helpers/logger";

/**
 * Resend adapter for transactional email (codes, confirmations) and marketing
 * campaigns. Created lazily; when unconfigured, `sendEmail` logs and returns a
 * "skipped" result instead of throwing, so local development works offline.
 */

let cached: Resend | null = null;

function isResendConfigured(): boolean {
  return hasEnv("RESEND_API_KEY", "RESEND_FROM_EMAIL");
}

function client(): Resend {
  if (cached) return cached;
  const { RESEND_API_KEY } = requireEnv("RESEND_API_KEY");
  cached = new Resend(RESEND_API_KEY);
  return cached;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
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
  try {
    const { data, error } = await client().emails.send({
      from: RESEND_FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });
    if (error) {
      logger.error(error, { where: "resend.sendEmail" });
      return { sent: false, error: error.message };
    }
    return { sent: true, providerMessageId: data?.id };
  } catch (e) {
    logger.error(e, { where: "resend.sendEmail" });
    return { sent: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
