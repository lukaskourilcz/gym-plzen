import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, messageDelivery } from "@/lib/db/schema";
import type { MessageDelivery } from "@/lib/db/types";
import { formatDateTime } from "@/lib/helpers/format";
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
import { sendTransactionalEmail } from "./email-templates";

/**
 * Multi-channel notification dispatch. The access code is sent over every
 * enabled channel at once so a single channel's failure doesn't block delivery
 * (the plan's core reliability guarantee). Each attempt is recorded as a
 * `messageDelivery` row so the admin can see per-channel status.
 */

type NotifyChannel = "email" | "whatsapp" | "sms";

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
  name?: string | null;
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
    const result = await sendTransactionalEmail({
      id: "access_code",
      to: ctx.email,
      variables: {
        name: ctx.name || "zákazníku",
        code: ctx.code,
        time: when,
      },
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
  name?: string | null;
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
    const result = await sendTransactionalEmail({
      id: "reservation_cancellation",
      to: params.email,
      variables: {
        name: params.name || "zákazníku",
        time: when,
        reason: params.reason || "Změna provozní doby",
      },
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

/**
 * Send the booking confirmation once per reservation. It intentionally does
 * not participate in the access-code pipeline: confirmation failure must
 * never prevent a paid customer from receiving their entry code.
 */
export async function sendReservationConfirmation(params: {
  userId: string | null;
  reservationId: string;
  name?: string | null;
  startsAt: Date;
  endsAt: Date;
  priceCents: number | null;
  email?: string | null;
}): Promise<void> {
  if (!params.email) return;

  const [alreadySent] = await db
    .select({ id: messageDelivery.id })
    .from(messageDelivery)
    .where(
      and(
        eq(messageDelivery.reservationId, params.reservationId),
        eq(messageDelivery.channel, "email"),
        eq(messageDelivery.kind, "reservation_confirmation"),
        eq(messageDelivery.status, "sent"),
      ),
    )
    .limit(1);
  if (alreadySent) return;

  const result = await sendTransactionalEmail({
    id: "reservation_confirmation",
    to: params.email,
    variables: {
      name: params.name || "zákazníku",
      time: formatDateTime(params.startsAt),
      duration: `${Math.round(
        (params.endsAt.getTime() - params.startsAt.getTime()) / 60_000,
      )} minut`,
      price:
        params.priceCents === 0
          ? "zdarma (věrnostní vstup)"
          : params.priceCents === null
            ? "v ceně členství"
            : `${Math.round(params.priceCents / 100)} Kč`,
    },
  });
  await record(
    {
      userId: params.userId,
      reservationId: params.reservationId,
      channel: "email",
      kind: "reservation_confirmation",
      recipient: params.email,
    },
    result,
  );
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
