import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhookEvent } from "@/lib/db/schema";

/**
 * Webhook idempotency ledger. Providers retry deliveries, so every handler
 * records each event id once and skips events it has already processed.
 */

/**
 * Atomically claim a provider event. Existing completed events are safe to
 * acknowledge; an existing unprocessed claim must be retried rather than
 * silently accepted while its first handler may still fail.
 */
export async function recordWebhookEvent(params: {
  provider: string;
  eventId: string;
  payload?: unknown;
}): Promise<{ isNew: boolean; processed: boolean }> {
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

  if (inserted.length > 0) return { isNew: true, processed: false };

  const [existing] = await db
    .select({ processedAt: webhookEvent.processedAt })
    .from(webhookEvent)
    .where(
      and(
        eq(webhookEvent.provider, params.provider),
        eq(webhookEvent.eventId, params.eventId),
      ),
    )
    .limit(1);
  return { isNew: false, processed: Boolean(existing?.processedAt) };
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
