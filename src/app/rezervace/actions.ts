"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth/guards";
import { defineAction, ActionError } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { dateTimeStringSchema } from "@/lib/validations/common";
import { booking } from "@/lib/services";
import { takeRateLimit } from "@/lib/security/rate-limit";

/**
 * Start checkout for a chosen slot. Requires a signed-in member. Returns either
 * a Stripe checkout URL (paid entry) or a free-entry confirmation, which the
 * client uses to redirect. The Stripe webhook confirms + fulfills on payment.
 */
const startImpl = defineAction({
  schema: z.object({ startsAt: dateTimeStringSchema }),
  authorize: getSession,
  handler: async (input, session) => {
    if (!session) throw new ActionError("Pro rezervaci se prosím přihlaste.");
    const requestHeaders = await headers();
    const source =
      requestHeaders.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (
      !takeRateLimit("booking", `${session.user.id}:${source}`, {
        limit: 10,
        windowMs: 10 * 60 * 1000,
      })
    ) {
      throw new ActionError(
        "Příliš mnoho pokusů. Zkuste to znovu za několik minut.",
      );
    }
    return booking.startBooking({
      userId: session.user.id,
      startsAt: new Date(input.startsAt),
    });
  },
});

export async function startCheckoutAction(input: {
  startsAt: string;
}): Promise<Result<booking.BookingOutcome>> {
  return startImpl(input);
}
