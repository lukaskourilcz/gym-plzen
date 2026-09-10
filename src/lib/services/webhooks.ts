import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhookEvent } from "@/lib/db/schema";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Ledger and business writes commit together. A killed worker rolls both
 * back; legacy unprocessed rows are reclaimed on the next delivery.
 * Handler must contain DB writes only, using the supplied transaction.
 * External calls belong before this transaction or in the durable pipeline. */
export async function processWebhookEvent(
  event: { provider: string; eventId: string; payload?: unknown },
  handler: (tx: Transaction) => Promise<void>,
): Promise<{ duplicate: boolean }> {
  return db.transaction(async (tx) => {
    await tx.insert(webhookEvent).values(event).onConflictDoNothing();
    const predicate = and(
      eq(webhookEvent.provider, event.provider),
      eq(webhookEvent.eventId, event.eventId),
    );
    const [row] = await tx
      .select()
      .from(webhookEvent)
      .where(predicate)
      .for("update");
    if (!row) throw new Error("Webhook ledger row missing");
    if (row.processedAt) return { duplicate: true };
    await handler(tx);
    await tx
      .update(webhookEvent)
      .set({ processedAt: new Date() })
      .where(predicate);
    return { duplicate: false };
  });
}
