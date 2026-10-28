import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailArchive, messageDelivery } from "@/lib/db/schema";
import {
  emailRetentionCutoff,
  isEmailRetained,
} from "@/lib/helpers/email-retention";

/** Called only after Resend accepts a send; never replaces existing content on retry. */
export async function archiveSentEmail(
  email: typeof emailArchive.$inferInsert,
) {
  if (email.sentAt && !isEmailRetained(email.sentAt)) return;
  await db.insert(emailArchive).values(email).onConflictDoNothing({
    target: emailArchive.providerMessageId,
  });
}

/** Keep delivery/dedupe records: deleting those could resend reservation emails. */
export async function purgeExpiredEmails(now = new Date()) {
  const cutoff = emailRetentionCutoff(now);
  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(emailArchive)
      .where(lte(emailArchive.sentAt, cutoff))
      .returning({ id: emailArchive.id });
    // Failed email outboxes can hold the same body (including attachments).
    // Their 23-hour retry windows have long expired. Keep delivery identity,
    // status and dedupe keys; other channels may still need reconciliation IDs.
    await tx
      .update(messageDelivery)
      .set({ providerResponse: null })
      .where(
        and(
          eq(messageDelivery.channel, "email"),
          lte(messageDelivery.createdAt, cutoff),
          isNotNull(messageDelivery.providerResponse),
        ),
      );
    return deleted.length;
  });
}
