import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhookEvent } from "@/lib/db/schema";

/**
 * Webhook idempotency ledger. Providers retry deliveries, so every handler
 * records each event id once and skips events it has already processed.
 */

/**
 * Record a provider event. Returns `false` when the event was already seen
 * (the caller should then no-op). Relies on the unique (provider, eventId)
 * index to make the check atomic.
 */
export async function recordWebhookEvent(params: {
  provider: string;
  eventId: string;
  payload?: unknown;
}): Promise<{ isNew: boolean }> {
  const inserted = await db
    .insert(webhookEvent)
    .values({
      provider: params.provider,
      eventId: params.eventId,
      payload: params.payload,
      processedAt: null,
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvent.id });

  return { isNew: inserted.length > 0 };
}

export async function markWebhookProcessed(provider: string, eventId: string) {
  await db
    .update(webhookEvent)
    .set({ processedAt: new Date() })
    .where(
      and(
        eq(webhookEvent.provider, provider),
        eq(webhookEvent.eventId, eventId),
      ),
    );
}

/** Remove a failed claim so the provider retry can process the event again. */
export async function releaseWebhookClaim(provider: string, eventId: string) {
  await db
    .delete(webhookEvent)
    .where(
      and(
        eq(webhookEvent.provider, provider),
        eq(webhookEvent.eventId, eventId),
      ),
    );
}
