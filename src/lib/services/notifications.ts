import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, messageDelivery } from "@/lib/db/schema";
import type { MessageDelivery } from "@/lib/db/types";
import { formatDateTime } from "@/lib/helpers/format";
import { sendEmail } from "@/lib/integrations/resend";
import {
  sendTemplateMessage,
  sendTextMessage,
} from "@/lib/integrations/whatsapp";
import { sendSms } from "@/lib/integrations/gosms";
import { getSetting } from "./cms";
import {
  DEFAULT_SMS_ACCESS_TEMPLATE,
  SMS_ACCESS_TEMPLATE_KEY,
  renderTemplate,
} from "@/lib/config/branding";

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

  // Email : always attempted when we have an address.
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

  // WhatsApp : opt-in (default on) and requires a phone number.
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

  // SMS : strictly opt-in fallback. Body is admin-configurable.
  if (ctx.notifyBySms && ctx.phone) {
    const template = await getSetting<string>(SMS_ACCESS_TEMPLATE_KEY);
    const message = renderTemplate(template ?? DEFAULT_SMS_ACCESS_TEMPLATE, {
      code: ctx.code,
      time: when,
    });
    const result = await sendSms({ to: ctx.phone, message });
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

/**
 * Notify a member that their reservation was cancelled because the gym is
 * closing that slot (maintenance, holiday, admin decision). Sends email and,
 * when the member opted in, a WhatsApp text; records each attempt.
 */
export async function sendReservationClosure(params: {
  userId: string | null;
  reservationId: string;
  startsAt: Date;
  email?: string | null;
  phone?: string | null;
  notifyByWhatsapp?: boolean;
  reason?: string;
}): Promise<void> {
  const when = formatDateTime(params.startsAt);
  const base = {
    userId: params.userId,
    reservationId: params.reservationId,
    kind: "reservation_cancellation" as const,
  };

  if (params.email) {
    const result = await sendEmail({
      to: params.email,
      subject: `Zrušení rezervace – ${when}`,
      html: closureEmailHtml(when, params.reason),
      text: `Vaše rezervace na ${when} byla bohužel zrušena${
        params.reason ? ` (${params.reason})` : ""
      }. Omlouváme se za komplikace. Vyberte si prosím jiný termín.`,
    });
    await record(
      { ...base, channel: "email", recipient: params.email },
      result,
    );
  }

  if (params.notifyByWhatsapp !== false && params.phone) {
    const result = await sendTextMessage({
      to: params.phone,
      body: `Vaše rezervace na ${when} byla zrušena${
        params.reason ? ` (${params.reason})` : ""
      }. Omlouváme se, vyberte si prosím jiný termín.`,
    });
    await record(
      { ...base, channel: "whatsapp", recipient: params.phone },
      result,
    );
  }
}

function closureEmailHtml(when: string, reason?: string): string {
  return `<div style="font-family:sans-serif">
    <h2>Rezervace byla zrušena</h2>
    <p>Vaše rezervace na <strong>${when}</strong> byla bohužel zrušena${
      reason ? ` (${reason})` : ""
    }.</p>
    <p>Omlouváme se za komplikace. Vyberte si prosím jiný volný termín na webu.</p>
  </div>`;
}

/** Load member contact + channel prefs for building an AccessCodeMessageContext. */
export async function loadMemberChannels(userId: string): Promise<{
  notifyByWhatsapp: boolean;
  notifyBySms: boolean;
  phone: string | null;
} | null> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!profile) return null;
  return {
    notifyByWhatsapp: profile.notifyByWhatsapp,
    notifyBySms: profile.notifyBySms,
    phone: profile.phone,
  };
}

/** Minimal inline email template (design comes later : see the task brief). */
function accessCodeEmailHtml(code: string, when: string): string {
  return `<div style="font-family:sans-serif">
    <h2>Váš vstupní kód</h2>
    <p style="font-size:28px;letter-spacing:4px;font-weight:bold">${code}</p>
    <p>Platí pro rezervaci: <strong>${when}</strong>.</p>
    <p>Kód zadejte na klávesnici u dveří v čase vaší rezervace.</p>
  </div>`;
}
