import { withReservationLock } from "./operation-lock";
import { recoverAccessCode } from "./access-codes";
import { raiseAlert, resolveAlert } from "./alerts";
import { and, asc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  messageDelivery,
  accessCode,
  profiles,
  reservation,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/helpers/format";
import { toE164 } from "@/lib/helpers/phone";
import {
  readZernioDelivery,
  sendZernioAccessCode,
} from "@/lib/integrations/zernio";

/**
 * The door PIN over WhatsApp (Zernio), sent with the mandatory e-mail an hour
 * before the booking to every member who ticked "Také přes WhatsApp" in their
 * profile and has a phone there. Guests and members without the choice stay
 * on e-mail only; e-mail never depends on this channel.
 */
type WhatsAppInput = {
  reservationId: string;
  accessCodeId: string;
  userId: string | null;
  pin: string;
  startsAt: Date;
  validFrom: Date;
  validUntil: Date;
};

const DEFINITE_REJECTIONS = new Set(
  [400, 401, 403, 404, 422, 429].map((status) => `zernio_http_${status}`),
);

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.ZERNIO_API_KEY && env.ZERNIO_ACCOUNT_ID);
}

/** The member's WhatsApp number, if they asked for PINs there. */
export async function whatsAppRecipient(
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const [profile] = await db
    .select({ phone: profiles.phone, optedIn: profiles.notifyByWhatsapp })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!profile?.optedIn || !profile.phone) return null;
  return toE164(profile.phone);
}

export async function sendReservationWhatsApp(input: WhatsAppInput) {
  return withReservationLock(input.reservationId, () => sendLocked(input));
}
async function sendLocked(input: WhatsAppInput) {
  if (!isWhatsAppConfigured()) return;
  const phone = await whatsAppRecipient(input.userId);
  if (!phone) return;
  const key = `zernio-access/${input.accessCodeId}`;
  await db
    .insert(messageDelivery)
    .values({
      reservationId: input.reservationId,
      userId: input.userId,
      channel: "whatsapp",
      kind: "access_code",
      recipient: phone,
      status: "queued",
      dedupeKey: key,
      providerResponse: { attempts: 0, submitted: false },
    })
    .onConflictDoNothing();
  const [claim] = await db
    .select()
    .from(messageDelivery)
    .where(eq(messageDelivery.dedupeKey, key));
  if (!claim || ["sent", "delivered", "read"].includes(claim.status)) return;
  const state = claim.providerResponse as {
    attempts?: number;
    submitted?: boolean;
    retrySafe?: boolean;
    conversationId?: string;
  } | null;
  // A crash/timeout after submission is ambiguous. Never blindly resend a PIN.
  if (
    !state ||
    (state.submitted && !state.retrySafe) ||
    (state.attempts ?? 0) >= 3
  )
    return;
  if (
    claim.status === "failed" &&
    Date.now() - claim.updatedAt.getTime() < 15 * 60_000
  )
    return;
  const attempts = (state.attempts ?? 0) + 1;
  await db
    .update(messageDelivery)
    .set({
      status: "queued",
      recipient: phone,
      updatedAt: new Date(),
      providerResponse: { attempts, submitted: true, retrySafe: false },
    })
    .where(eq(messageDelivery.id, claim.id));
  const result = await sendZernioAccessCode({
    phone,
    pin: input.pin,
    reservationTime: formatDateTime(input.startsAt),
    validFrom: formatDateTime(input.validFrom),
    validUntil: formatDateTime(input.validUntil),
  });
  await db
    .update(messageDelivery)
    .set({
      providerResponse: {
        attempts,
        submitted: true,
        conversationId: result.sent ? result.conversationId : null,
        // A definite rejection (bad account or template, rate limit) means
        // nothing reached the customer, so a later attempt cannot duplicate
        // the PIN; a network error or an unconfirmed answer stays ambiguous.
        retrySafe: !result.sent && DEFINITE_REJECTIONS.has(result.error),
      },
      status: result.sent ? "sent" : "failed",
      providerMessageId: result.sent ? result.providerMessageId : null,
      failureReason: result.sent ? null : result.error,
      sentAt: result.sent ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(messageDelivery.id, claim.id));
  if (!result.sent)
    await raiseAlert({
      dedupeKey: `whatsapp:${input.reservationId}`,
      title: "WhatsApp čeká na ověření odeslání",
      body: "E-mail s kódem se odesílá nezávisle. Zkontrolujte stav v Zernio; nejasný výsledek se automaticky neopakuje.",
      context: { reservationId: input.reservationId, reason: result.error },
    });
}

/**
 * Watchdog step: read back the delivery status of sent PINs, and send the
 * PIN to opted-in members whose booking starts within the hour but whose
 * WhatsApp has not gone yet (a later opt-in, or a failed run). Independent
 * from the mandatory e-mail.
 */
export async function reconcileReservationWhatsApp() {
  if (!isWhatsAppConfigured()) return;
  const pending = await db
    .select()
    .from(messageDelivery)
    .where(
      and(
        eq(messageDelivery.channel, "whatsapp"),
        eq(messageDelivery.kind, "access_code"),
        sql`${messageDelivery.dedupeKey} like 'zernio-access/%'`,
        inArray(messageDelivery.status, ["sent", "queued"]),
        lte(messageDelivery.updatedAt, new Date(Date.now() - 5 * 60_000)),
      ),
    )
    .orderBy(asc(messageDelivery.updatedAt))
    .limit(10);
  for (const message of pending) {
    if (
      !message.dedupeKey?.startsWith("zernio-access/") ||
      !message.reservationId
    )
      continue;
    const metadata = message.providerResponse as {
      conversationId?: string;
      attempts?: number;
    } | null;
    if (!metadata?.conversationId || !message.providerMessageId) {
      await raiseAlert({
        dedupeKey: `whatsapp:${message.reservationId}`,
        title: "Výsledek odeslání WhatsAppu nelze ověřit",
        body: "Zkontrolujte konverzaci v Zernio. Nejasný pokus se neopakuje, e-mail s kódem běží nezávisle.",
        context: { reservationId: message.reservationId },
      });
      await db
        .update(messageDelivery)
        .set({ updatedAt: new Date() })
        .where(eq(messageDelivery.id, message.id));
      continue;
    }
    try {
      await withReservationLock(message.reservationId, async () => {
        const result = await readZernioDelivery(
          metadata.conversationId!,
          message.providerMessageId!,
        );
        await db
          .update(messageDelivery)
          .set({
            status: result.status === "unknown" ? "sent" : result.status,
            deliveredAt: ["delivered", "read"].includes(result.status)
              ? new Date()
              : undefined,
            readAt: result.status === "read" ? new Date() : undefined,
            failureReason:
              result.status === "failed"
                ? `zernio_delivery_failed_${result.errorCode ?? "unknown"}`
                : null,
            providerResponse: {
              ...metadata,
              submitted: true,
              retrySafe:
                result.status === "failed" && result.errorCode !== 131042,
            },
            updatedAt: new Date(),
          })
          .where(eq(messageDelivery.id, message.id));
        if (result.status === "failed")
          await raiseAlert({
            dedupeKey: `whatsapp:${message.reservationId}`,
            title: "WhatsApp nedoručil vstupní kód",
            body: "Zkontrolujte Zernio a účet WhatsApp. E-mailové doručení běží nezávisle.",
            context: {
              reservationId: message.reservationId,
              providerCode: result.errorCode,
            },
          });
        if (["delivered", "read"].includes(result.status))
          await resolveAlert(`whatsapp:${message.reservationId}`);
      });
    } catch {
      /* Read failure is not proof of delivery failure; retry the read. */
      await db
        .update(messageDelivery)
        .set({ updatedAt: new Date() })
        .where(eq(messageDelivery.id, message.id));
    }
  }
  const candidates = await db
    .select({ booking: reservation, code: accessCode })
    .from(reservation)
    .innerJoin(accessCode, eq(accessCode.reservationId, reservation.id))
    .innerJoin(profiles, eq(profiles.id, reservation.userId))
    .where(
      and(
        eq(reservation.status, "confirmed"),
        eq(profiles.notifyByWhatsapp, true),
        sql`${profiles.phone} is not null`,
        lte(reservation.startsAt, new Date(Date.now() + 60 * 60_000)),
        gt(reservation.endsAt, new Date()),
        inArray(accessCode.status, ["scheduled", "active"]),
      ),
    )
    .orderBy(asc(reservation.startsAt))
    .limit(10);
  for (const { booking, code } of candidates) {
    await withReservationLock(booking.id, async () => {
      const [current] = await db
        .select()
        .from(reservation)
        .where(eq(reservation.id, booking.id));
      if (current?.status !== "confirmed") return;
      const [delivery] = await db
        .select()
        .from(messageDelivery)
        .where(eq(messageDelivery.dedupeKey, `zernio-access/${code.id}`));
      if (
        delivery &&
        (["sent", "delivered", "read"].includes(delivery.status) ||
          ((delivery.providerResponse as { submitted?: boolean })?.submitted !==
            false &&
            !(delivery.providerResponse as { retrySafe?: boolean })?.retrySafe))
      )
        return;
      const pin = await recoverAccessCode(code);
      if (pin)
        await sendReservationWhatsApp({
          reservationId: booking.id,
          accessCodeId: code.id,
          userId: booking.userId,
          pin,
          startsAt: booking.startsAt,
          validFrom: code.validFrom,
          validUntil: code.validUntil,
        });
    });
  }
}
