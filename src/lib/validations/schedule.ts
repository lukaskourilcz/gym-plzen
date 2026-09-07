import { z } from "zod";
import {
  dateTimeStringSchema,
  increasingDateTimeRange,
  hhmmSchema,
  optionalText,
  uuidSchema,
} from "./common";

/**
 * Opening hours for one weekday. Times are validated as "HH:mm" strings; the
 * action converts them to minutes-from-midnight before saving.
 */
export const openingHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  open: hhmmSchema,
  close: hhmmSchema,
  slotMinutes: z.number().int().min(15).max(240),
  isClosed: z.boolean(),
}).refine((value) => value.isClosed || value.close > value.open, { path: ["close"], message: "Zavírací čas musí být po otevíracím čase." });

export const createBlockedSlotSchema = z
  .object({
    startsAt: dateTimeStringSchema,
    endsAt: dateTimeStringSchema,
    reason: z.enum(["maintenance", "holiday", "private_event", "other"]),
    note: optionalText(300),
  })
  .refine((v) => increasingDateTimeRange(v.startsAt, v.endsAt), {
    message: "Konec musí být po začátku.",
    path: ["endsAt"],
  });

export const deleteBlockedSlotSchema = z.object({ id: uuidSchema });

/** Shower grace in minutes (code stays valid this long after a slot). */
export const showerMinutesSchema = z.object({
  showerMinutes: z
    .number({ invalid_type_error: "Zadejte číslo." })
    .int()
    .min(0, "Nesmí být záporné.")
    .max(120, "Maximálně 120 minut."),
});

export type OpeningHoursValues = z.infer<typeof openingHoursSchema>;
export type CreateBlockedSlotValues = z.infer<typeof createBlockedSlotSchema>;
