"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { getSession } from "@/lib/auth/guards";
import {
  bookingHoldCookieOptions,
  HOLD_COOKIE,
  HOLD_COOKIE_PATH,
  parseBookingHold,
  serializeBookingHold,
} from "@/lib/helpers/booking-hold";
import { publicEnv } from "@/lib/public-env";
import { defineAction, ActionError } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { logger } from "@/lib/helpers/logger";
import { toE164 } from "@/lib/helpers/phone";
import {
  bookingDetailsSchema,
  type BookingDetailsValues,
  voucherQuoteSchema,
  type VoucherQuoteValues,
} from "@/lib/validations/booking";
import { booking, loyalty, vouchers } from "@/lib/services";
import { saveBookingPhone } from "@/lib/services/customer-profile";
import { takeRateLimit } from "@/lib/security/rate-limit";

/** Validate contact details and start hosted checkout. */
const startImpl = defineAction({
  schema: bookingDetailsSchema,
  authorize: getSession,
  handler: async (input, session) => {
    if (session?.user.isDemo)
      throw new ActionError("Demo rezervace se neukládají.");
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

    const cookieStore = await cookies();
    const hold = parseBookingHold(cookieStore.get(HOLD_COOKIE)?.value);
    const outcome = await booking.startBooking({
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
      hold,
    });
    /*
     * The number the member asked us to keep, stored once the booking exists
     * and never in its way: a failed profile write must not cost a
     * reservation that is already placed, so it is logged and nothing more.
     */
    if (input.savePhone && session) {
      try {
        await saveBookingPhone(session.user.id, phone);
        revalidatePath("/account");
        revalidatePath(`/admin/members/${session.user.id}`);
      } catch (error) {
        logger.error(error, { where: "startCheckout.saveBookingPhone" });
      }
    }

    // A guest keeps the key to their hold for the payment session, so a
    // return from the gateway continues this booking. A finished booking, or
    // a member (matched by account), leaves no key behind.
    if (!session && outcome.kind !== "free" && outcome.token) {
      cookieStore.set(
        HOLD_COOKIE,
        serializeBookingHold({
          reservationId: outcome.reservationId,
          token: outcome.token,
        }),
        bookingHoldCookieOptions(
          publicEnv.NEXT_PUBLIC_APP_URL.startsWith("https://"),
        ),
      );
    } else if (hold) {
      cookieStore.delete({ name: HOLD_COOKIE, path: HOLD_COOKIE_PATH });
    }
    return outcome;
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
      ? (
          await loyalty.priceForNextEntry(
            session.user.id,
            new Date(input.startsAt),
          )
        ).priceCents
      : await loyalty.getEntryPriceCents(new Date(input.startsAt));
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
