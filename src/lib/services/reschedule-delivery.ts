import { and, asc, eq, inArray, isNull, like, lte, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  messageDelivery,
  reservation,
  reservationReschedule,
} from "@/lib/db/schema";
import type { SendEmailParams } from "@/lib/integrations/resend";
import { sendEmail } from "@/lib/integrations/resend";
import { logger } from "@/lib/helpers/logger";
import { raiseAlert, resolveAlert } from "./alerts";
import { withReservationLock } from "./operation-lock";
import { prepareRescheduleConfirmation } from "./notifications";

const RETRY_AFTER_MS = 5 * 60_000;
const SAFE_WINDOW_MS = 23 * 60 * 60_000;
const manualReason = "reschedule_email_reconcile_required";

type SavedPayload = { email?: SendEmailParams; submitted?: boolean };

function savedEmail(value: unknown, recipient: string): SendEmailParams | null {
  const state = value as SavedPayload | null;
  const email = state?.email;
  return email &&
    email.to === recipient &&
    typeof email.subject === "string" &&
    typeof email.html === "string"
    ? email
    : null;
}

/** The transactional intent is created by rescheduling before this provider call. */
export async function deliverRescheduleConfirmation(reservationId: string) {
  return withReservationLock(reservationId, async () => {
    const key = `reschedule-confirmation/${reservationId}`;
    const [message] = await db
      .select()
      .from(messageDelivery)
      .where(eq(messageDelivery.dedupeKey, key))
      .limit(1);
    if (!message || ["sent", "delivered", "read"].includes(message.status))
      return;
    if (message.failureReason === manualReason) return;
    const age = Date.now() - message.createdAt.getTime();
    if (age >= SAFE_WINDOW_MS || age < 0) {
      await db
        .update(messageDelivery)
        .set({
          status: "failed",
          providerResponse: null,
          failureReason: manualReason,
          updatedAt: new Date(),
        })
        .where(eq(messageDelivery.id, message.id));
      await raiseAlert({
        dedupeKey: `reschedule-email:${reservationId}`,
        title: "Potvrzení změny termínu vyžaduje ruční ověření",
        body: "Automatické opakování už není bezpečné. Ověřte doručení v Resend a zákazníkovi případně potvrďte nový termín.",
        context: { reservationId },
      });
      return;
    }
    const [booking] = await db
      .select()
      .from(reservation)
      .where(eq(reservation.id, reservationId))
      .limit(1);
    if (!booking || booking.status === "cancelled") {
      await db
        .update(messageDelivery)
        .set({
          status: "failed",
          providerResponse: null,
          failureReason: "reschedule_email_superseded",
          updatedAt: new Date(),
        })
        .where(eq(messageDelivery.id, message.id));
      await resolveAlert(`reschedule-email:${reservationId}`);
      return;
    }
    let email = savedEmail(message.providerResponse, message.recipient);
    if (!email) {
      const [history] = await db
        .select()
        .from(reservationReschedule)
        .where(eq(reservationReschedule.reservationId, reservationId))
        .limit(1);
      if (!history) return;
      email = await prepareRescheduleConfirmation({
        userId: booking.userId,
        reservationId,
        name: booking.contactName,
        previousStartsAt: history.previousStartsAt,
        startsAt: history.newStartsAt,
        endsAt: history.newEndsAt,
        email: message.recipient,
      });
      if (!email) return;
      // Persist exact template/ICS bytes before any external side effect.
      await db
        .update(messageDelivery)
        .set({
          providerResponse: { email, submitted: false },
          updatedAt: new Date(),
        })
        .where(eq(messageDelivery.id, message.id));
    }
    await db
      .update(messageDelivery)
      .set({
        providerResponse: { email, submitted: true },
        updatedAt: new Date(),
      })
      .where(eq(messageDelivery.id, message.id));
    const result = await sendEmail({ ...email, idempotencyKey: key });
    await db
      .update(messageDelivery)
      .set({
        status: result.sent ? "sent" : "failed",
        providerMessageId: result.providerMessageId ?? null,
        providerResponse: result.sent ? null : { email, submitted: true },
        failureReason: result.error ?? null,
        sentAt: result.sent ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(messageDelivery.id, message.id));
    if (result.sent) await resolveAlert(`reschedule-email:${reservationId}`);
    else
      await raiseAlert({
        dedupeKey: `reschedule-email:${reservationId}`,
        title: "Potvrzení změny termínu čeká na odeslání",
        body: "Změna termínu je uložená. Potvrzovací e-mail se bezpečně zopakuje; zkontrolujte stav doručení.",
        context: { reservationId },
      });
  });
}

export async function retryRescheduleConfirmations(limit = 10) {
  const due = await db
    .select({ reservationId: messageDelivery.reservationId })
    .from(messageDelivery)
    .where(
      and(
        eq(messageDelivery.channel, "email"),
        eq(messageDelivery.kind, "reservation_confirmation"),
        like(messageDelivery.dedupeKey, "reschedule-confirmation/%"),
        inArray(messageDelivery.status, ["queued", "failed"]),
        lte(messageDelivery.updatedAt, new Date(Date.now() - RETRY_AFTER_MS)),
        or(
          isNull(messageDelivery.failureReason),
          ne(messageDelivery.failureReason, manualReason),
        ),
        or(
          isNull(messageDelivery.failureReason),
          ne(messageDelivery.failureReason, "reschedule_email_superseded"),
        ),
      ),
    )
    .orderBy(asc(messageDelivery.updatedAt))
    .limit(limit);
  let processed = 0;
  for (const row of due) {
    if (!row.reservationId) continue;
    try {
      await deliverRescheduleConfirmation(row.reservationId);
      processed++;
    } catch (error) {
      logger.error(error, {
        where: "reschedule-email.retry",
        reservationId: row.reservationId,
      });
    }
  }
  return processed;
}
