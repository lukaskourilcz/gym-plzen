"use server";

import { headers } from "next/headers";
import { getSession } from "@/lib/auth/guards";
import { defineAction, ActionError } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { toE164 } from "@/lib/helpers/phone";
import {
  bookingDetailsSchema,
  type BookingDetailsValues,
  voucherQuoteSchema,
  type VoucherQuoteValues,
} from "@/lib/validations/booking";
import { booking, loyalty, vouchers } from "@/lib/services";
import { takeRateLimit } from "@/lib/security/rate-limit";

/**
 * Start checkout for a chosen slot from the booking details form. Open to
 * guests: a signed-in visitor books against their account (and their loyalty
 * counter), anyone else books on the contact details they just supplied.
 *
 * Returns either a Stripe checkout URL (paid entry) or a free-entry
 * confirmation, which the client uses to redirect. The Stripe webhook confirms
 * and fulfills on payment.
 */
const startImpl = defineAction({
  schema: bookingDetailsSchema,
  authorize: getSession,
  handler: async (input, session) => {
    const requestHeaders = await headers();
    const source =
      requestHeaders.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    // Guests have no account to rate-limit against, so the address alone
    // carries the limit for them.
    if (
      !takeRateLimit(
        "booking",
        session ? `${session.user.id}:${source}` : `guest:${source}`,
        { limit: 10, windowMs: 10 * 60 * 1000 },
      )
    ) {
      throw new ActionError(
        "Příliš mnoho pokusů. Zkuste to znovu za několik minut.",
      );
    }

    const phone = toE164(input.phone);
    if (!phone) throw new ActionError("Zadejte platné telefonní číslo.");

    return booking.startBooking({
      userId: session?.user.id ?? null,
      startsAt: new Date(input.startsAt),
      details: {
        name: `${input.firstName.trim()} ${input.lastName.trim()}`,
        email: input.email.trim(),
        phone,
        // Server time, not a value the form could claim for itself.
        acceptedAt: new Date(),
      },
      voucherCode: input.voucherCode,
    });
  },
});

export async function startCheckoutAction(
  input: BookingDetailsValues,
): Promise<Result<booking.BookingOutcome>> {
  return startImpl(input);
}

const quoteVoucherImpl = defineAction({
  schema: voucherQuoteSchema,
  authorize: getSession,
  handler: async (input, session) => {
    const requestHeaders = await headers();
    const source =
      requestHeaders.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    if (
      !takeRateLimit(
        "voucher-quote",
        session ? `${session.user.id}:${source}` : `guest:${source}`,
        { limit: 20, windowMs: 10 * 60 * 1000 },
      )
    ) {
      throw new ActionError(
        "Příliš mnoho pokusů. Zkuste to znovu za několik minut.",
      );
    }
    const priceCents = session
      ? (await loyalty.priceForNextEntry(session.user.id)).priceCents
      : await loyalty.getEntryPriceCents();
    if (priceCents === 0) {
      throw new ActionError("Tento vstup už máte zdarma.");
    }
    return vouchers.quoteVoucher(input.code, priceCents);
  },
});

export async function quoteVoucherAction(
  input: VoucherQuoteValues,
): Promise<Result<vouchers.VoucherQuote>> {
  return quoteVoucherImpl(input);
}
