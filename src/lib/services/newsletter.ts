import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { newsletterSubscriber } from "@/lib/db/schema";
import type { NewsletterSubscriber } from "@/lib/db/types";

export async function subscribe(
  rawEmail: string,
  source = "homepage",
): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const now = new Date();
  await db
    .insert(newsletterSubscriber)
    .values({ email, source, consentedAt: now })
    .onConflictDoUpdate({
      target: newsletterSubscriber.email,
      set: {
        status: "subscribed",
        source,
        consentedAt: now,
        unsubscribedAt: null,
        updatedAt: now,
      },
    });
}

export async function listSubscribers(
  limit = 500,
): Promise<NewsletterSubscriber[]> {
  return db
    .select()
    .from(newsletterSubscriber)
    .orderBy(desc(newsletterSubscriber.createdAt))
    .limit(limit);
}
