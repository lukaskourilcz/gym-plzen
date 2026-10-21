import { and, asc, eq, gt, inArray, like, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { messageDelivery, reservation } from "@/lib/db/schema";
import { withReservationLock } from "./operation-lock";
import { sendEmail, type SendEmailParams } from "@/lib/integrations/resend";
import { z } from "zod";
import {
  prepareTransactionalEmail,
  sendTransactionalEmail,
} from "./email-templates";
import { formatDateTime } from "@/lib/helpers/format";
import { raiseAlert, resolveAlert } from "./alerts";

const customerIntentSchema = z.object({
  version: z.literal(1),
  templateId: z.literal("customer_reservation_cancellation"),
  variables: z.object({
    name: z.string(),
    time: z.string(),
    price: z.string(),
    refund_note: z.string(),
  }),
  email: z
    .object({
      to: z.string(),
      subject: z.string(),
      html: z.string(),
      text: z.string().optional(),
    })
    .optional(),
});
const CUSTOMER_SAFE_WINDOW_MS = 23 * 3_600_000;
const MANUAL_REASON = "customer_cancellation_reconcile_required";

/** Persisted atomically with cancellation; provider key survives worker crashes. */
export async function deliverCancellation(reservationId: string) {
  return withReservationLock(reservationId, async () => {
    const [stored] = await db
      .select({
        message: messageDelivery,
        ageMs: sql<number>`extract(epoch from (clock_timestamp() - ${messageDelivery.createdAt})) * 1000`,
      })
      .from(messageDelivery)
      .where(eq(messageDelivery.dedupeKey, `cancellation/${reservationId}`))
      .limit(1);
    const message = stored?.message;
    if (!message || !["queued", "failed"].includes(message.status)) return;
    const [booking] = await db
      .select()
      .from(reservation)
      .where(eq(reservation.id, reservationId))
      .limit(1);
    if (!booking || booking.status !== "cancelled") return;
    const metadata = message.providerResponse as {
      cancellation?: unknown;
      submitted?: boolean;
    } | null;
    const customer = metadata?.cancellation !== undefined;
    const intent = customerIntentSchema.safeParse(metadata?.cancellation);
    if (
      customer &&
      (!intent.success ||
        Number(stored!.ageMs) >= CUSTOMER_SAFE_WINDOW_MS ||
        Number(stored!.ageMs) < 0 ||
        message.failureReason === MANUAL_REASON)
    ) {
      await db
        .update(messageDelivery)
        .set({
          status: "failed",
          failureReason: MANUAL_REASON,
          updatedAt: new Date(),
        })
        .where(eq(messageDelivery.id, message.id));
      await raiseAlert({
        dedupeKey: `cancellation-email:${reservationId}`,
        title: "Potvrzení zákaznického storna vyžaduje ověření",
        body: "Rezervace zůstává zrušená. Před dalším odesláním ověřte doručení v Resend, aby zákazník nedostal zprávu dvakrát.",
        context: { reservationId },
      });
      return;
    }
    let result: { sent: boolean; providerMessageId?: string; error?: string };
    try {
      if (customer && intent.success) {
        const email: SendEmailParams =
          intent.data.email ??
          (await prepareTransactionalEmail({
            id: intent.data.templateId,
            to: message.recipient,
            variables: intent.data.variables,
          }));
        // Freeze exact text/HTML before contacting the provider. Editing the
        // template while an uncertain request retries cannot change its bytes.
        await db
          .update(messageDelivery)
          .set({
            providerResponse: {
              cancellation: { ...intent.data, email },
              submitted: true,
            },
            updatedAt: new Date(),
          })
          .where(eq(messageDelivery.id, message.id));
        result = await sendEmail({
          ...email,
          to: message.recipient,
          idempotencyKey: `cancellation/${reservationId}`,
        });
      } else {
        // Rows created before this change retain the original admin template.
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
      }
    } catch {
      result = { sent: false, error: "cancellation_email_unconfirmed" };
    }
    await db
      .update(messageDelivery)
      .set({
        status: result.sent ? "sent" : "failed",
        ...(customer && result.sent
          ? {
              providerResponse: {
                cancellation: {
                  version: 1,
                  templateId: "customer_reservation_cancellation",
                },
                submitted: true,
              },
            }
          : {}),
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
        sql`${messageDelivery.failureReason} is distinct from ${MANUAL_REASON}`,
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
