import { deliverySummary } from "@/lib/helpers/delivery";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, messageDelivery } from "@/lib/db/schema";
import type { MessageDelivery } from "@/lib/db/types";
import {
  formatDateTime,
  formatMoney,
  formatTimeRange,
} from "@/lib/helpers/format";
import type { BookingOrder, Reservation } from "@/lib/db/types";
import {
  sendTemplateMessage,
  sendTextMessage,
} from "@/lib/integrations/whatsapp";
import { sendSms } from "@/lib/integrations/gosms";
import { getSetting, getText } from "./cms";
import {
  getLoyaltyStatus,
  loyaltyProgressSentence,
  orderLoyaltySentence,
} from "./loyalty";
import { buildIcs, reservationCalendarEvent } from "@/lib/helpers/ics";
import { publicAddress } from "@/lib/content/site";
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
  accessCodeId?: string;
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
  emailDelivered: boolean;
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
      idempotencyKey: ctx.accessCodeId
        ? `access-code/${ctx.accessCodeId}`
        : undefined,
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

  // WhatsApp : strictly opt-in and requires a phone number.
  if (ctx.notifyByWhatsapp === true && ctx.phone) {
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
    ...deliverySummary(deliveries),
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

  if (params.notifyByWhatsapp === true && params.phone) {
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
  /** Set when the entry is the member's free loyalty entry. */
  loyaltyReward?: number | null;
  email?: string | null;
}): Promise<boolean> {
  if (!params.email) return true;

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
  if (alreadySent) return true;

  /*
   * Loyalty is members-only: a guest booking has no account to count against,
   * so the variable resolves to an empty string and the renderer collapses the
   * paragraph. By the time fulfillment runs, this reservation is already
   * confirmed, so the count includes it : "this was your Nth visit".
   */
  const loyalty = params.userId
    ? loyaltyProgressSentence(
        await getLoyaltyStatus(params.userId),
        Boolean(params.loyaltyReward),
      )
    : "";

  /*
   * The confirmation carries the slot as a calendar file, so it lands in the
   * customer's calendar straight from the inbox. It holds the slot only: an
   * access code must never travel into a synced calendar.
   */
  const ics = buildIcs(
    reservationCalendarEvent({
      reservationId: params.reservationId,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      address: publicAddress(await getText("contact.address").catch(() => "")),
    }),
  );

  const result = await sendTransactionalEmail({
    id: "reservation_confirmation",
    to: params.email,
    // An answer lost after Resend accepted the mail must not send it twice.
    idempotencyKey: `confirmation/${params.reservationId}`,
    attachments: [
      {
        filename: "rezervace.ics",
        content: Buffer.from(ics, "utf8").toString("base64"),
      },
    ],
    variables: {
      name: params.name || "zákazníku",
      loyalty,
      time: formatDateTime(params.startsAt),
      duration: `${Math.round(
        (params.endsAt.getTime() - params.startsAt.getTime()) / 60_000,
      )} minut`,
      // A free entry is either the loyalty reward or a voucher that covered
      // the whole price; the e-mail must not call one the other.
      price:
        params.priceCents === 0
          ? params.loyaltyReward
            ? "zdarma (věrnostní vstup)"
            : "zdarma (voucher)"
          : params.priceCents === null
            ? "v ceně členství"
            : formatMoney(params.priceCents),
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
  return result.sent;
}

/** "středa 1. 10. 10:00 – 11:15 · 229 Kč", one line of an order e-mail. */
export function orderSlotLine(slot: Reservation): string {
  const day = new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/Prague",
  }).format(slot.startsAt);
  const price = !slot.priceCents
    ? slot.loyaltyReward
      ? "zdarma (věrnostní vstup)"
      : "zdarma (voucher)"
    : formatMoney(slot.priceCents, slot.currency);
  return `• ${day} ${formatTimeRange(slot.startsAt, slot.endsAt)} · ${price}`;
}

/** "3 termíny" / "5 termínů" for the order e-mail. */
function termCount(n: number): string {
  if (n === 1) return "1 termín";
  if (n >= 2 && n <= 4) return `${n} termíny`;
  return `${n} termínů`;
}

/**
 * The one confirmation of a paid multi-slot order: every slot with its price,
 * the total, and a calendar file with one event per slot. Sent once per
 * order; the delivery is filed under the order's first slot with the order's
 * dedupe key. Like the single confirmation, it never holds back a PIN.
 */
export async function sendOrderConfirmation(params: {
  order: BookingOrder;
  slots: Reservation[];
}): Promise<boolean> {
  const { order, slots } = params;
  const email = order.contactEmail;
  const first = slots[0];
  if (!email || !first) return true;
  const dedupeKey = `order-confirmation/${order.id}`;
  const [alreadySent] = await db
    .select({ id: messageDelivery.id })
    .from(messageDelivery)
    .where(eq(messageDelivery.dedupeKey, dedupeKey))
    .limit(1);
  if (alreadySent) return true;

  const loyalty = order.userId
    ? orderLoyaltySentence(
        await getLoyaltyStatus(order.userId),
        slots.filter((slot) => slot.loyaltyReward).length,
      )
    : "";
  const address = publicAddress(
    await getText("contact.address").catch(() => ""),
  );
  const ics = buildIcs(
    slots.map((slot) =>
      reservationCalendarEvent({
        reservationId: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        address,
      }),
    ),
  );
  const result = await sendTransactionalEmail({
    id: "order_confirmation",
    to: email,
    idempotencyKey: dedupeKey,
    attachments: [
      {
        filename: "rezervace.ics",
        content: Buffer.from(ics, "utf8").toString("base64"),
      },
    ],
    variables: {
      name: order.contactName || "zákazníku",
      count: termCount(slots.length),
      slots: slots.map(orderSlotLine).join("\n"),
      total:
        order.totalCents === 0
          ? "zdarma"
          : formatMoney(order.totalCents, order.currency),
      loyalty,
    },
  });
  await db.insert(messageDelivery).values({
    userId: order.userId,
    reservationId: first.id,
    channel: "email",
    kind: "reservation_confirmation",
    recipient: email,
    status: result.sent ? "sent" : "failed",
    providerMessageId: result.providerMessageId,
    failureReason: result.error,
    sentAt: result.sent ? new Date() : null,
    // Only a delivered confirmation closes the order; a failure is retried.
    dedupeKey: result.sent ? dedupeKey : null,
  });
  return result.sent;
}

/**
 * Confirmation of a customer-initiated term change. The booking confirmation
 * is sent once per reservation, so after a reschedule it would say nothing;
 * this one is sent for every change (there is at most one) so the customer
 * holds the new time in writing. The attached .ics keeps the reservation's
 * UID, so a calendar that imported the original entry updates it in place.
 */
export async function sendRescheduleConfirmation(params: {
  userId: string | null;
  reservationId: string;
  name?: string | null;
  previousStartsAt: Date;
  startsAt: Date;
  endsAt: Date;
  email?: string | null;
}): Promise<void> {
  if (!params.email) return;

  const ics = buildIcs(
    reservationCalendarEvent({
      reservationId: params.reservationId,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      address: publicAddress(await getText("contact.address").catch(() => "")),
      // One change is allowed; revision 1 replaces the original entry.
      sequence: 1,
    }),
  );

  const result = await sendTransactionalEmail({
    id: "reservation_rescheduled",
    to: params.email,
    attachments: [
      {
        filename: "rezervace.ics",
        content: Buffer.from(ics, "utf8").toString("base64"),
      },
    ],
    variables: {
      name: params.name || "zákazníku",
      previous_time: formatDateTime(params.previousStartsAt),
      time: formatDateTime(params.startsAt),
      duration: `${Math.round(
        (params.endsAt.getTime() - params.startsAt.getTime()) / 60_000,
      )} minut`,
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
