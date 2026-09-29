import { createHmac } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/helpers/crypto";
import { siteUrl } from "@/lib/helpers/site-url";
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

/** Withdraw consent. Returns whether an active subscription was ended. */
export async function unsubscribe(rawEmail: string): Promise<boolean> {
  const now = new Date();
  const ended = await db
    .update(newsletterSubscriber)
    .set({ status: "unsubscribed", unsubscribedAt: now, updatedAt: now })
    .where(
      and(
        eq(newsletterSubscriber.email, normalize(rawEmail)),
        eq(newsletterSubscriber.status, "subscribed"),
      ),
    )
    .returning({ id: newsletterSubscriber.id });
  return ended.length > 0;
}

function normalize(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

/*
 * The unsubscribe link proves the address without an account: an HMAC of the
 * address under a server secret, separated by purpose from the secret's other
 * use. Anyone holding the link may unsubscribe that one address, never
 * another, and never read anything.
 */
function unsubscribeSecret(): string | null {
  const base = env.ACCESS_CODE_ENCRYPTION_KEY ?? env.CRON_SECRET;
  return base ? `newsletter-unsubscribe:${base}` : null;
}

export function unsubscribeToken(rawEmail: string): string | null {
  const secret = unsubscribeSecret();
  if (!secret) return null;
  return createHmac("sha256", secret)
    .update(normalize(rawEmail))
    .digest("base64url")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(
  rawEmail: string,
  token: string,
): boolean {
  const expected = unsubscribeToken(rawEmail);
  return Boolean(expected && token && safeEqual(expected, token));
}

/** The personal link to put into every newsletter sent to this address. */
export function unsubscribeUrl(rawEmail: string): string | null {
  const token = unsubscribeToken(rawEmail);
  if (!token) return null;
  return siteUrl(
    `/newsletter/odhlaseni?${new URLSearchParams({ e: normalize(rawEmail), t: token })}`,
  );
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
