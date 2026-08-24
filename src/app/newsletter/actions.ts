"use server";

import { headers } from "next/headers";
import { defineAction, ActionError } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  newsletterSignupSchema,
  type NewsletterSignupValues,
} from "@/lib/validations/newsletter";
import { newsletter } from "@/lib/services";
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
