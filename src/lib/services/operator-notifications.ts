import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { messageDelivery } from "@/lib/db/schema";
import type {
  BookingOrder,
  MessageDelivery,
  Reservation,
  SystemAlert,
} from "@/lib/db/types";
import {
  DEFAULT_OPERATOR_NOTIFICATIONS,
  OPERATOR_NOTIFICATIONS_SETTING_KEY,
  operatorEventDefinition,
  operatorNotificationsSchema,
  parseRecipients,
  type OperatorEventId,
  type OperatorNotifications,
} from "@/lib/config/operator-notifications";
import { SITE_DEFAULTS } from "@/lib/content/site";
import {
  formatDateTime,
  formatMoney,
  formatSeverity,
} from "@/lib/helpers/format";
import { logger } from "@/lib/helpers/logger";
import { siteUrl } from "@/lib/helpers/site-url";
import { sendEmail, type SendEmailParams } from "@/lib/integrations/resend";
import { getSetting, getText, setSetting } from "./cms";
import { prepareTransactionalEmail } from "./email-templates";
import { withOperationLock } from "./operation-lock";

/**
 * What the people who run the gym are told by e-mail: a booking arrived, a
 * customer moved their time, something needs their attention. Nothing here is
 * ever sent to a customer.
 *
 * Every entry point is safe to call from the middle of a booking: a failure to
 * inform the operator is logged and swallowed, because it must never undo the
 * reservation it is reporting. Each notice carries a scope, and a scope is
 * claimed once per address, so a fulfillment run retried by the watchdog
 * cannot send the same notice twice.
 */

/** The address the site publishes, when nothing has been configured yet. */
async function siteContactEmail(): Promise<string> {
  try {
    return (
      await getText("contact.email", {
        fallback: SITE_DEFAULTS["contact.email"],
      })
    ).trim();
  } catch (error) {
    logger.error(error, { where: "operator-notifications.siteContactEmail" });
    return "";
  }
}

/**
 * The stored configuration, or the sensible starting point: a new booking
 * reaches the operator at the site's own contact address from the first day,
 * without anybody having opened the administration.
 */
export async function getOperatorNotifications(): Promise<OperatorNotifications> {
  const parsed = operatorNotificationsSchema.safeParse(
    await getSetting(OPERATOR_NOTIFICATIONS_SETTING_KEY),
  );
  if (parsed.success) return parsed.data;
  return {
    ...DEFAULT_OPERATOR_NOTIFICATIONS,
    recipients: await siteContactEmail(),
  };
}

export async function saveOperatorNotifications(
  input: OperatorNotifications,
  adminId: string,
): Promise<void> {
  await setSetting(OPERATOR_NOTIFICATIONS_SETTING_KEY, input, adminId);
}

export interface OperatorNotice {
  event: OperatorEventId;
  /**
   * What happened, in the operator's words. One Czech sentence, or several
   * paragraphs separated by a blank line: free text belongs here, because the
   * detail rows below are a table and a sentence would break it apart.
   */
  summary: string;
  /**
   * The "Termín: …" rows of the e-mail. Short facts only (a value over 60
   * characters or ending in a full stop stops being a row), and empty values
   * are left out.
   */
  details?: readonly (readonly [string, string | null | undefined])[];
  /**
   * What makes this notice unique. The same event and scope is sent to an
   * address once and never again, so a retry cannot duplicate it. Without a
   * scope every call sends.
   */
  scope?: string | null;
  /**
   * The booking this is about, so the delivery is filed with it. There is
   * deliberately no member: `message_delivery.user_id` means "sent to this
   * member", and the administration lists a member's own mail by it.
   */
  reservationId?: string | null;
  /** Where in the administration the recipient continues. */
  path?: string;
}

/** Send one notice, if the operator asked for this event. Never throws. */
export async function notify(notice: OperatorNotice): Promise<boolean> {
  try {
    const settings = await getOperatorNotifications();
    if (!settings.events[notice.event]) return true;

    const recipients = parseRecipients(settings.recipients);
    if (recipients.length === 0) return true;

    const definition = operatorEventDefinition(notice.event);
    const detail = (notice.details ?? [])
      .map(([label, value]) => [label, value?.trim()] as const)
      .filter(([, value]) => Boolean(value))
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n");

    let delivered = true;
    for (const recipient of recipients)
      delivered =
        (await sendToRecipient(notice, definition.label, detail, recipient)) &&
        delivered;
    return delivered;
  } catch (error) {
    logger.error(error, {
      where: "operator-notifications.notify",
      event: notice.event,
    });
    return false;
  }
}

async function sendToRecipient(
  notice: OperatorNotice,
  event: string,
  detail: string,
  recipient: string,
): Promise<boolean> {
  const dedupeKey = notice.scope
    ? `${notice.event}:${notice.scope}:${recipient.toLowerCase()}`
    : null;
  if (dedupeKey) {
    const [existing] = await db
      .select({ id: messageDelivery.id })
      .from(messageDelivery)
      .where(eq(messageDelivery.dedupeKey, dedupeKey))
      .limit(1);
    if (existing) return sendPreparedDelivery(existing.id);
  }

  const email = await prepareTransactionalEmail({
    id: "operator_notice",
    to: recipient,
    actionUrl: siteUrl(notice.path ?? "/admin"),
    variables: { event, summary: notice.summary, detail },
  });
  const claimed = await claim(notice, recipient, dedupeKey, email);
  if (!claimed) {
    const [existing] = await db
      .select()
      .from(messageDelivery)
      .where(eq(messageDelivery.dedupeKey, dedupeKey!))
      .limit(1);
    if (!existing) return false;
    return sendPreparedDelivery(existing.id);
  }
  return sendPreparedDelivery(claimed.id, true);
}

const RETRY_AFTER_MS = 5 * 60_000;
// Resend accepts the same idempotency key for 24 hours. Leave one hour of
// margin for clock skew and queue delay; after that, ask an operator to check.
const SAFE_WINDOW_MS = 23 * 60 * 60_000;

type PreparedNotice = {
  event: OperatorEventId;
  email: SendEmailParams;
};

function preparedNotice(row: MessageDelivery): PreparedNotice | null {
  const value = row.providerResponse as Partial<PreparedNotice> | null;
  if (
    !value ||
    !value.event ||
    !value.email ||
    typeof value.email.to !== "string" ||
    value.email.to !== row.recipient ||
    typeof value.email.subject !== "string" ||
    typeof value.email.html !== "string"
  )
    return null;
  return value as PreparedNotice;
}

/** Retry only a durable, unchanged payload with the row's stable provider key. */
async function sendPreparedDelivery(
  id: string,
  immediate = false,
): Promise<boolean> {
  return withOperationLock(`operator-notice:${id}`, async () => {
    const [row] = await db
      .select()
      .from(messageDelivery)
      .where(eq(messageDelivery.id, id))
      .limit(1);
    if (!row) return false;
    if (["sent", "delivered", "read"].includes(row.status)) return true;
    const age = Date.now() - row.createdAt.getTime();
    if (age >= SAFE_WINDOW_MS || age < 0) return false;
    if (
      row.status === "queued" &&
      !immediate &&
      Date.now() - row.updatedAt.getTime() < RETRY_AFTER_MS
    )
      return false;
    const prepared = preparedNotice(row);
    if (!prepared) return false; // Legacy ambiguous rows need human review.
    const settings = await getOperatorNotifications();
    if (
      !settings.events[prepared.event] ||
      !parseRecipients(settings.recipients).some(
        (recipient) => recipient.toLowerCase() === row.recipient.toLowerCase(),
      )
    )
      return false;
    const result = await sendEmail({
      ...prepared.email,
      idempotencyKey: `operator-notice/${row.id}`,
    });
    await db
      .update(messageDelivery)
      .set({
        status: result.sent ? "sent" : "failed",
        providerMessageId: result.providerMessageId ?? null,
        providerResponse: result.sent ? null : row.providerResponse,
        failureReason: result.error ?? null,
        sentAt: result.sent ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(messageDelivery.id, id));
    return result.sent;
  });
}

/** Watchdog recovery, including notices without a scope or original caller. */
export async function retryPendingOperatorNotices(limit = 20): Promise<number> {
  const pending = await db
    .select()
    .from(messageDelivery)
    .where(
      and(
        eq(messageDelivery.channel, "email"),
        eq(messageDelivery.kind, "operator_notice"),
        inArray(messageDelivery.status, ["queued", "failed"]),
        lte(messageDelivery.updatedAt, new Date(Date.now() - RETRY_AFTER_MS)),
        or(
          isNull(messageDelivery.failureReason),
          ne(
            messageDelivery.failureReason,
            "operator_notice_reconcile_required",
          ),
        ),
      ),
    )
    .orderBy(asc(messageDelivery.updatedAt))
    .limit(limit);
  let sent = 0;
  for (const row of pending) {
    if (
      Date.now() - row.createdAt.getTime() >= SAFE_WINDOW_MS ||
      !preparedNotice(row)
    ) {
      if (row.status === "queued" || preparedNotice(row)) {
        const { raiseAlert } = await import("./alerts");
        await raiseAlert({
          title: "Provozní e-mail vyžaduje ruční ověření",
          body: "Pokus už nelze bezpečně automaticky opakovat. Zkontrolujte doručení v Resend a vyřešte upozornění podle výsledku.",
          dedupeKey: `operator-notice:ambiguous:${row.id}`,
          context: { deliveryId: row.id },
        });
      }
      await db
        .update(messageDelivery)
        .set({
          status: "failed",
          providerResponse: null,
          failureReason: "operator_notice_reconcile_required",
          updatedAt: new Date(),
        })
        .where(eq(messageDelivery.id, row.id));
      continue;
    }
    if (await sendPreparedDelivery(row.id)) sent++;
  }
  return sent;
}

/**
 * Take the delivery row before sending. Two runs racing for the same scope
 * both insert; the unique key lets exactly one of them through, and the other
 * gets nothing back and sends nothing.
 */
async function claim(
  notice: OperatorNotice,
  recipient: string,
  dedupeKey: string | null,
  email: SendEmailParams,
): Promise<MessageDelivery | null> {
  const id = randomUUID();
  const [row] = await db
    .insert(messageDelivery)
    .values({
      id,
      userId: null,
      reservationId: notice.reservationId ?? null,
      channel: "email",
      kind: "operator_notice",
      status: "queued",
      recipient,
      dedupeKey,
      providerResponse: { event: notice.event, email },
    })
    .onConflictDoNothing({ target: messageDelivery.dedupeKey })
    .returning();
  return row ?? null;
}

/** "75 minut" for the slot between two instants. */
function durationText(startsAt: Date, endsAt: Date): string {
  return `${Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000)} minut`;
}

/** What the customer paid, in the words the administration uses. */
function priceText(reservation: Reservation): string {
  if (reservation.priceCents === null) return "v ceně členství";
  if (reservation.priceCents === 0)
    return reservation.loyaltyReward
      ? "zdarma (věrnostní vstup)"
      : "zdarma (voucher)";
  return formatMoney(reservation.priceCents, reservation.currency);
}

function customerDetails(
  reservation: Reservation,
): readonly (readonly [string, string | null | undefined])[] {
  return [
    ["Zákazník", reservation.contactName],
    ["E-mail", reservation.contactEmail],
    ["Telefon", reservation.contactPhone],
    ["Účet", reservation.userId ? "registrovaný člen" : "bez registrace"],
  ];
}

/** Where the administration shows this reservation's customer. */
function reservationPath(reservation: Reservation): string {
  return reservation.userId
    ? `/admin/members/${reservation.userId}`
    : "/admin/reservations";
}

/** A booking became real: paid, covered by a voucher, or a loyalty entry. */
export async function notifyReservationConfirmed(
  reservation: Reservation,
): Promise<void> {
  await notify({
    event: "reservationConfirmed",
    scope: reservation.id,
    reservationId: reservation.id,
    path: reservationPath(reservation),
    summary: `${reservation.contactName?.trim() || "Zákazník"} má potvrzenou rezervaci na ${formatDateTime(reservation.startsAt)}.`,
    details: [
      ["Termín", formatDateTime(reservation.startsAt)],
      ["Délka", durationText(reservation.startsAt, reservation.endsAt)],
      ...customerDetails(reservation),
      ["Cena", priceText(reservation)],
    ],
  });
}

/** A multi-slot order became real: one notice for all of its slots. */
export async function notifyOrderConfirmed(params: {
  order: BookingOrder;
  slots: Reservation[];
}): Promise<void> {
  const { order, slots } = params;
  const first = slots[0];
  if (!first) return;
  await notify({
    event: "reservationConfirmed",
    scope: `order:${order.id}`,
    reservationId: first.id,
    path: reservationPath(first),
    summary: `${order.contactName?.trim() || "Zákazník"} má potvrzenou objednávku ${slots.length} termínů za ${order.totalCents === 0 ? "0 Kč" : formatMoney(order.totalCents, order.currency)}.`,
    details: [
      ...slots.map(
        (slot, index) =>
          [
            `Termín ${index + 1}`,
            `${formatDateTime(slot.startsAt)}, ${priceText(slot)}`,
          ] as const,
      ),
      ...customerDetails(first),
      ["Celkem", formatMoney(order.totalCents, order.currency)],
    ],
  });
}

/** The customer moved an existing booking to another time. */
export async function notifyReservationRescheduled(params: {
  reservation: Reservation;
  previousStartsAt: Date;
}): Promise<void> {
  const { reservation, previousStartsAt } = params;
  await notify({
    event: "reservationRescheduled",
    // A reservation can be moved more than once, so the new time is part of
    // what makes the notice unique.
    scope: `${reservation.id}:${reservation.startsAt.toISOString()}`,
    reservationId: reservation.id,
    path: reservationPath(reservation),
    summary: `${reservation.contactName?.trim() || "Zákazník"} si přesunul rezervaci na ${formatDateTime(reservation.startsAt)}.`,
    details: [
      ["Původní termín", formatDateTime(previousStartsAt)],
      ["Nový termín", formatDateTime(reservation.startsAt)],
      ["Délka", durationText(reservation.startsAt, reservation.endsAt)],
      ...customerDetails(reservation),
    ],
  });
}

/** A confirmed booking disappeared from the calendar. */
export async function notifyReservationCancelled(params: {
  reservation: Reservation;
  reason?: string | null;
}): Promise<void> {
  const { reservation } = params;
  await notify({
    event: "reservationCancelled",
    scope: reservation.id,
    reservationId: reservation.id,
    path: reservationPath(reservation),
    // The reason is whatever the operator typed, so it stays prose.
    summary: `Rezervace na ${formatDateTime(reservation.startsAt)} byla zrušena.${
      params.reason?.trim() ? `\n\nDůvod: ${params.reason.trim()}` : ""
    }`,
    details: [
      ["Termín", formatDateTime(reservation.startsAt)],
      ...customerDetails(reservation),
      ["Cena", priceText(reservation)],
    ],
  });
}

/** Somebody finished registering: a confirmed e-mail or a Google sign-in. */
export async function notifyNewMember(params: {
  userId: string;
  email?: string | null;
  name?: string | null;
}): Promise<void> {
  const name = params.name?.trim();
  await notify({
    event: "memberRegistered",
    scope: params.userId,
    path: `/admin/members/${params.userId}`,
    summary: `${name || params.email?.trim() || "Nový zákazník"} dokončil registraci.`,
    details: [
      ["Jméno", name],
      ["E-mail", params.email],
      ["Registrace", formatDateTime(new Date())],
    ],
  });
}

/** An operational alert, which otherwise only reaches the WhatsApp group. */
export async function notifyAlert(alert: SystemAlert): Promise<boolean> {
  return notify({
    event: "systemAlert",
    scope: alert.id,
    path: "/admin/alerts",
    // The alert's own body is a sentence to the operator, so it is prose too.
    summary: alert.body?.trim()
      ? `${alert.title}\n\n${alert.body.trim()}`
      : alert.title,
    details: [
      ["Závažnost", formatSeverity(alert.severity)],
      ["Kdy", formatDateTime(alert.createdAt)],
    ],
  });
}
