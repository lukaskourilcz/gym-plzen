import { lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailArchive } from "@/lib/db/schema";
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
  const deleted = await db
    .delete(emailArchive)
    .where(lte(emailArchive.sentAt, emailRetentionCutoff(now)))
    .returning({ id: emailArchive.id });
  return deleted.length;
}
