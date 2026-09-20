import { emailRetentionCutoff } from "@/lib/helpers/email-retention";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailArchive, messageDelivery } from "@/lib/db/schema";
import type { MessageDelivery } from "@/lib/db/types";

/**
 * Message-delivery queries for the administration's "přehled doručených zpráv".
 * Writing deliveries happens in notifications.ts; this module is read-side plus
 * provider-webhook status updates.
 */

/** All delivery attempts for a reservation, newest first. */
export async function listForReservation(
  reservationId: string,
): Promise<MessageDelivery[]> {
  return db
    .select()
    .from(messageDelivery)
    .where(eq(messageDelivery.reservationId, reservationId))
    .orderBy(desc(messageDelivery.createdAt));
}

/** Every delivery attempt addressed to one member, newest first. */
export async function listForUser(
  userId: string,
  limit = 100,
): Promise<MessageDelivery[]> {
  return db
    .select()
    .from(messageDelivery)
    .where(eq(messageDelivery.userId, userId))
    .orderBy(desc(messageDelivery.createdAt))
    .limit(limit);
}

/** Recent deliveries across all reservations (admin overview). */
export async function listRecent(limit = 200): Promise<MessageDelivery[]> {
  return db
    .select()
    .from(messageDelivery)
    .orderBy(desc(messageDelivery.createdAt))
    .limit(limit);
}

/**
 * Update a delivery's status from a provider status webhook (Resend/WhatsApp).
 * Matched by the provider's message id.
 */
export async function updateStatusByProviderId(params: {
  providerMessageId: string;
  status: MessageDelivery["status"];
  at?: Date;
}): Promise<void> {
  const timestampField =
    params.status === "delivered"
      ? { deliveredAt: params.at ?? new Date() }
      : params.status === "read"
        ? { readAt: params.at ?? new Date() }
        : {};

  await db
    .update(messageDelivery)
    .set({ status: params.status, ...timestampField, updatedAt: new Date() })
    .where(eq(messageDelivery.providerMessageId, params.providerMessageId));
}

/** Metadata only: never load hundreds of HTML bodies for the list page. */
export async function listAdminEmails() {
  const { assertAdmin } = await import("@/lib/auth/guards");
  await assertAdmin();
  return db
    .select({
      id: emailArchive.id,
      subject: emailArchive.subject,
      recipient: emailArchive.recipient,
      sentAt: emailArchive.sentAt,
    })
    .from(emailArchive)
    .where(gt(emailArchive.sentAt, emailRetentionCutoff()))
    .orderBy(desc(emailArchive.sentAt))
    .limit(200);
}

export async function getAdminEmail(id: string) {
  const { assertAdmin } = await import("@/lib/auth/guards");
  await assertAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [email] = await db
    .select()
    .from(emailArchive)
    .where(
      and(
        eq(emailArchive.id, id),
        gt(emailArchive.sentAt, emailRetentionCutoff()),
      ),
    )
    .limit(1);
  return email ?? null;
}

/** Attempts without a retained body, including SMS/WhatsApp and send failures. */
export async function listUnarchivedRecent(limit = 200) {
  const { assertAdmin } = await import("@/lib/auth/guards");
  await assertAdmin();
  const rows = await db
    .select({ message: messageDelivery })
    .from(messageDelivery)
    .leftJoin(
      emailArchive,
      eq(emailArchive.providerMessageId, messageDelivery.providerMessageId),
    )
    .where(
      and(
        isNull(emailArchive.id),
        gt(messageDelivery.createdAt, emailRetentionCutoff()),
      ),
    )
    .orderBy(desc(messageDelivery.createdAt))
    .limit(limit);
  return rows.map((r) => r.message);
}
