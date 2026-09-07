import { z } from "zod";
import { slotInstantSchema, emailSchema, phoneSchema } from "./common";

/**
 * Public booking details. One schema covers both visitors: a guest fills it in
 * from scratch, a member sees it prefilled from their profile. Either way the
 * combined consent is part of the booking, not of the account, so it is
 * re-confirmed for every reservation.
 *
 * Transform-free like the rest of `validations/*`: the action trims the names
 * and normalises the phone number to E.164.
 */

/** An unticked checkbox arrives as `false`, which this rejects by design. */
const consentSchema = z.literal(true, {
  errorMap: () => ({
    message: "Bez tohoto souhlasu nelze rezervaci dokončit.",
  }),
});

export const bookingDetailsSchema = z.object({
  startsAt: slotInstantSchema,
  firstName: z.string().min(1, "Zadejte jméno.").max(60),
  lastName: z.string().min(1, "Zadejte příjmení.").max(60),
  email: emailSchema,
  phone: phoneSchema,
  voucherCode: z.string().max(64, "Kód je příliš dlouhý.").optional(),
  acceptConditions: consentSchema,
});

export const voucherQuoteSchema = z.object({
  startsAt: slotInstantSchema,
  code: z.string().min(1, "Zadejte kód voucheru.").max(64),
});

export type BookingDetailsValues = z.infer<typeof bookingDetailsSchema>;
export type VoucherQuoteValues = z.infer<typeof voucherQuoteSchema>;
