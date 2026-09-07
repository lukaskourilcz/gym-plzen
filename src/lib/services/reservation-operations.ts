import { randomUUID } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhookEvent } from "@/lib/db/schema";
import { ActionError } from "@/lib/helpers/action";

/**
 * A recoverable lease shared by fulfillment, cancellation and rescheduling.
 * Reuses the unique provider/event ledger in a separate internal namespace.
 * No network call holds a database transaction or pooler connection open.
 * The ten-minute lease exceeds the five-minute function execution limit.
 */
export async function withReservationOperation<T>(
  reservationId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const token = randomUUID();
  const now = new Date();
  const [claimed] = await db
    .insert(webhookEvent)
    .values({
      id: token,
      provider: "internal:reservation-operation",
      eventId: reservationId,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [webhookEvent.provider, webhookEvent.eventId],
      set: { id: token, createdAt: now },
      setWhere: lt(
        webhookEvent.createdAt,
        new Date(now.getTime() - 10 * 60_000),
      ),
    })
    .returning({ id: webhookEvent.id });
  if (!claimed) {
    throw new ActionError(
      "Rezervace se právě zpracovává. Zkuste to prosím za chvíli znovu.",
    );
  }
  try {
    return await operation();
  } finally {
    await db
      .delete(webhookEvent)
      .where(
        and(
          eq(webhookEvent.id, token),
          eq(webhookEvent.provider, "internal:reservation-operation"),
        ),
      );
  }
}
