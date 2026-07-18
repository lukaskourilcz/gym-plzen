import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messageDelivery } from "@/lib/db/schema";
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
