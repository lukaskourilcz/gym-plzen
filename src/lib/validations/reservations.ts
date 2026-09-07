import { z } from "zod";
import {
  dateTimeStringSchema,
  increasingDateTimeRange,
  idSchema,
  slotInstantSchema,
  optionalEmail,
  optionalPhone,
  optionalText,
} from "./common";

/** Admin manual booking. Dates are validated as strings; the action converts. */
export const createReservationSchema = z
  .object({
    userId: idSchema.optional(),
    startsAt: dateTimeStringSchema,
    endsAt: dateTimeStringSchema,
    contactName: optionalText(120),
    contactEmail: optionalEmail,
    contactPhone: optionalPhone,
    priceCents: z.number().int().nonnegative().optional(),
  })
  .refine((v) => increasingDateTimeRange(v.startsAt, v.endsAt), {
    message: "Konec musí být po začátku.",
    path: ["endsAt"],
  });

export const cancelReservationSchema = z.object({
  id: z.string().uuid(),
  reason: optionalText(300),
});

export const rescheduleReservationSchema = z.object({
  reservationId: z.string().uuid(),
  startsAt: slotInstantSchema,
});

export type CreateReservationValues = z.infer<typeof createReservationSchema>;
export type CancelReservationValues = z.infer<typeof cancelReservationSchema>;
export type RescheduleReservationValues = z.infer<
  typeof rescheduleReservationSchema
>;
