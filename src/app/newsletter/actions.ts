"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { defineAction, ActionError } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  newsletterSignupSchema,
  type NewsletterSignupValues,
} from "@/lib/validations/newsletter";
import { activity, newsletter } from "@/lib/services";
import { takeRateLimit } from "@/lib/security/rate-limit";

const subscribeImpl = defineAction({
  schema: newsletterSignupSchema,
  handler: async (input) => {
    // Bots receive the same success response, but no address is stored.
    if (input.website) return;
    const requestHeaders = await headers();
    const source =
      requestHeaders.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (
      !takeRateLimit("newsletter", source, {
        limit: 8,
        windowMs: 60 * 60 * 1000,
      })
    ) {
      throw new ActionError("Příliš mnoho pokusů. Zkuste to prosím později.");
    }
    await newsletter.subscribe(input.email, "homepage");
  },
});

export async function subscribeNewsletterAction(
  input: NewsletterSignupValues,
): Promise<Result<unknown>> {
  return subscribeImpl(input);
}

const unsubscribeSchema = z.object({
  email: z.string().email().max(254),
  token: z.string().min(1).max(64),
});

/** The unsubscribe page's button: the signed link proves the address. */
const unsubscribeImpl = defineAction({
  schema: unsubscribeSchema,
  handler: async ({ email, token }) => {
    if (!newsletter.verifyUnsubscribeToken(email, token))
      throw new ActionError(
        "Odkaz pro odhlášení není platný. Napište nám prosím na e-mail uvedený v kontaktech.",
      );
    if (await newsletter.unsubscribe(email))
      await activity.record({
        action: "newsletter.unsubscribed",
        actorType: "customer",
        actorLabel: email,
        summary: `Odběr novinek pro ${email} zrušen odkazem pro odhlášení.`,
      });
  },
});

export async function unsubscribeNewsletterAction(
  input: z.infer<typeof unsubscribeSchema>,
): Promise<Result<unknown>> {
  return unsubscribeImpl(input);
}
