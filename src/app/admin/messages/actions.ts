"use server";

import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { emailArchive, messageDelivery } from "@/lib/db/schema";
import {
  emailRetentionCutoff,
  isEmailRetained,
} from "@/lib/helpers/email-retention";
import { requireEnv } from "@/lib/env";
import { archiveSentEmail } from "@/lib/services/email-archive";

/** Only retrieve IDs already recorded by this application, never another project. */
export async function importRecentEmails() {
  await assertAdmin();
  const { RESEND_API_KEY } = requireEnv("RESEND_API_KEY");
  const pending = await db
    .selectDistinct({ providerId: messageDelivery.providerMessageId })
    .from(messageDelivery)
    .leftJoin(
      emailArchive,
      eq(emailArchive.providerMessageId, messageDelivery.providerMessageId),
    )
    .where(
      and(
        eq(messageDelivery.channel, "email"),
        isNotNull(messageDelivery.providerMessageId),
        isNull(emailArchive.id),
        gt(messageDelivery.createdAt, emailRetentionCutoff()),
      ),
    )
    .limit(50);
  let imported = 0;
  let unavailable = 0;
  for (const row of pending) {
    const response = await fetch(
      `https://api.resend.com/emails/${encodeURIComponent(row.providerId!)}`,
      {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (response.status === 401 || response.status === 403) {
      redirect("/admin/messages?import=permissions");
    }
    if (response.status === 429) break;
    if (!response.ok) {
      unavailable++;
      continue;
    }
    const email = (await response.json()) as {
      id: string;
      from: string;
      to: string[];
      subject: string;
      html?: string;
      text?: string;
      created_at: string;
    };
    const sentAt = new Date(email.created_at);
    if (
      email.id !== row.providerId ||
      !email.html ||
      !isEmailRetained(sentAt)
    ) {
      unavailable++;
      continue;
    }
    await archiveSentEmail({
      providerMessageId: email.id,
      sender: email.from,
      recipient: email.to.join(", "),
      subject: email.subject,
      html: email.html,
      bodyText: email.text,
      sentAt,
    });
    imported++;
    // Stay below Resend's shared two requests per second limit.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  redirect(`/admin/messages?imported=${imported}&unavailable=${unavailable}`);
}
