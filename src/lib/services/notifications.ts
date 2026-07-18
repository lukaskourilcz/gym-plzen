import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberProfile, messageDelivery } from "@/lib/db/schema";
import type { MessageDelivery } from "@/lib/db/types";
import { formatDateTime } from "@/lib/helpers/format";
import { sendEmail } from "@/lib/integrations/resend";
import { sendTemplateMessage } from "@/lib/integrations/whatsapp";
import { sendSms } from "@/lib/integrations/gosms";

/**
 * Multi-channel notification dispatch. The access code is sent over every
 * enabled channel at once so a single channel's failure doesn't block delivery
 * (the plan's core reliability guarantee). Each attempt is recorded as a
 * `messageDelivery` row so the admin can see per-channel status.
 */

export type NotifyChannel = "email" | "whatsapp" | "sms";

interface RecordParams {
  userId: string | null;
  reservationId: string;
  channel: NotifyChannel;
  kind: MessageDelivery["kind"];
  recipient: string;
}

async function record(
  params: RecordParams,
  result: { sent: boolean; providerMessageId?: string; error?: string },
): Promise<MessageDelivery> {
  const [row] = await db
    .insert(messageDelivery)
    .values({
      userId: params.userId,
      reservationId: params.reservationId,
      channel: params.channel,
      kind: params.kind,
      recipient: params.recipient,
      status: result.sent ? "sent" : "failed",
      providerMessageId: result.providerMessageId,
      failureReason: result.error,
      sentAt: result.sent ? new Date() : null,
    })
    .returning();
  return row!;
}

export interface AccessCodeMessageContext {
  userId: string | null;
  reservationId: string;
  code: string;
  startsAt: Date;
  email?: string | null;
  phone?: string | null;
  /** Member channel preferences; email always on, others opt-in. */
  notifyByWhatsapp?: boolean;
  notifyBySms?: boolean;
}

export interface DispatchOutcome {
  anyDelivered: boolean;
  deliveries: MessageDelivery[];
}

/**
 * Send the access code across all enabled channels. Returns whether at least
 * one channel succeeded (the pipeline treats that as "delivered").
 */
export async function dispatchAccessCode(
  ctx: AccessCodeMessageContext,
): Promise<DispatchOutcome> {
  const when = formatDateTime(ctx.startsAt);
  const deliveries: MessageDelivery[] = [];

  // Email — always attempted when we have an address.
  if (ctx.email) {
    const result = await sendEmail({
      to: ctx.email,
      subject: `Váš vstupní kód – ${when}`,
      html: accessCodeEmailHtml(ctx.code, when),
      text: `Váš vstupní kód je ${ctx.code}. Platí pro rezervaci ${when}.`,
    });
    deliveries.push(
      await record(
        { ...channelBase(ctx), channel: "email", recipient: ctx.email },
        result,
      ),
    );
  }

  // WhatsApp — opt-in (default on) and requires a phone number.
  if (ctx.notifyByWhatsapp !== false && ctx.phone) {
    const result = await sendTemplateMessage({
      to: ctx.phone,
      templateName: "access_code",
      languageCode: "cs",
      bodyParams: [ctx.code, when],
    });
    deliveries.push(
      await record(
        { ...channelBase(ctx), channel: "whatsapp", recipient: ctx.phone },
        result,
      ),
    );
  }

  // SMS — strictly opt-in fallback.
  if (ctx.notifyBySms && ctx.phone) {
    const result = await sendSms({
      to: ctx.phone,
      message: `Vstupni kod: ${ctx.code} (${when}). Gym Plzen`,
    });
    deliveries.push(
      await record(
        { ...channelBase(ctx), channel: "sms", recipient: ctx.phone },
        result,
      ),
    );
  }

  return {
    anyDelivered: deliveries.some((d) => d.status === "sent"),
    deliveries,
  };
}

function channelBase(ctx: AccessCodeMessageContext) {
  return {
    userId: ctx.userId,
    reservationId: ctx.reservationId,
    kind: "access_code" as const,
  };
}

/** Load member contact + channel prefs for building an AccessCodeMessageContext. */
export async function loadMemberChannels(userId: string): Promise<{
  notifyByWhatsapp: boolean;
  notifyBySms: boolean;
  phone: string | null;
} | null> {
  const [profile] = await db
    .select()
    .from(memberProfile)
    .where(eq(memberProfile.userId, userId))
    .limit(1);
  if (!profile) return null;
  return {
    notifyByWhatsapp: profile.notifyByWhatsapp,
    notifyBySms: profile.notifyBySms,
    phone: profile.phone,
  };
}

/** Minimal inline email template (design comes later — see the task brief). */
function accessCodeEmailHtml(code: string, when: string): string {
  return `<div style="font-family:sans-serif">
    <h2>Váš vstupní kód</h2>
    <p style="font-size:28px;letter-spacing:4px;font-weight:bold">${code}</p>
    <p>Platí pro rezervaci: <strong>${when}</strong>.</p>
    <p>Kód zadejte na klávesnici u dveří v čase vaší rezervace.</p>
  </div>`;
}
