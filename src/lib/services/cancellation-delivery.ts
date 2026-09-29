import { and, asc, eq, gt, inArray, like, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { messageDelivery, reservation } from "@/lib/db/schema";
import { withReservationLock } from "./operation-lock";
import { sendTransactionalEmail } from "./email-templates";
import { formatDateTime } from "@/lib/helpers/format";
import { raiseAlert, resolveAlert } from "./alerts";

/** Persisted atomically with cancellation; provider key survives worker crashes. */
export async function deliverCancellation(reservationId: string) {
  return withReservationLock(reservationId, async () => {
    const [message] = await db
      .select()
      .from(messageDelivery)
      .where(eq(messageDelivery.dedupeKey, `cancellation/${reservationId}`))
      .limit(1);
    if (!message || !["queued", "failed"].includes(message.status)) return;
    const [booking] = await db
      .select()
      .from(reservation)
      .where(eq(reservation.id, reservationId))
      .limit(1);
    if (!booking || booking.status !== "cancelled") return;
    let result: { sent: boolean; providerMessageId?: string; error?: string };
    try {
      result = await sendTransactionalEmail({
        id: "reservation_cancellation",
        to: message.recipient,
        idempotencyKey: `cancellation/${reservationId}`,
        variables: {
          name: booking.contactName || "zákazníku",
          time: formatDateTime(booking.startsAt),
          reason: booking.cancelReason || "Rezervace byla zrušena.",
        },
      });
    } catch {
      result = { sent: false, error: "cancellation_email_unconfirmed" };
    }
    await db
      .update(messageDelivery)
      .set({
        status: result.sent ? "sent" : "failed",
        providerMessageId: result.providerMessageId ?? null,
        failureReason: result.sent ? null : result.error,
        sentAt: result.sent ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(messageDelivery.id, message.id));
    if (result.sent) await resolveAlert(`cancellation-email:${reservationId}`);
    else
      await raiseAlert({
        dedupeKey: `cancellation-email:${reservationId}`,
        title: "Storno e-mail čeká na odeslání",
        body: "Rezervace je zrušena. Odeslání e-mailu se automaticky zopakuje.",
        context: { reservationId },
      });
  });
}
export async function retryCancellationEmails() {
  const due = await db
    .select({ reservationId: messageDelivery.reservationId })
    .from(messageDelivery)
    .where(
      and(
        like(messageDelivery.dedupeKey, "cancellation/%"),
        inArray(messageDelivery.status, ["queued", "failed"]),
        lte(messageDelivery.updatedAt, new Date(Date.now() - 5 * 60_000)),
        // Retries stop after a day, inside Resend's idempotency window: an
        // address that still bounces is left to the operator's open alert,
        // and an earlier send that did land can never be repeated.
        gt(messageDelivery.createdAt, new Date(Date.now() - 24 * 3_600_000)),
      ),
    )
    .orderBy(asc(messageDelivery.updatedAt))
    .limit(5);
  for (const row of due)
    if (row.reservationId) await deliverCancellation(row.reservationId);
  return due.length;
}
