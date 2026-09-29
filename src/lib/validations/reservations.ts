import { z } from "zod";
import {
  dateTimeStringSchema,
  idSchema,
  optionalEmail,
  optionalPhone,
  optionalText,
} from "./common";

/**
 * Admin manual booking. The start is validated as a string; the action
 * converts it and the service derives the end from the configured window, so
 * there is no end field to get wrong.
 */
export const createReservationSchema = z.object({
  userId: idSchema.optional(),
  startsAt: dateTimeStringSchema,
  contactName: optionalText(120),
  contactEmail: optionalEmail,
  contactPhone: optionalPhone,
  priceCents: z.number().int().nonnegative().optional(),
});

/** Admin cancellation; the reason is sent to the customer in the e-mail. */
export const cancelReservationSchema = z.object({
  id: z.string().uuid(),
  reason: optionalText(300),
});

export const rescheduleReservationSchema = z.object({
  reservationId: z.string().uuid(),
  startsAt: dateTimeStringSchema,
});

export type CreateReservationValues = z.infer<typeof createReservationSchema>;
export type CancelReservationValues = z.infer<typeof cancelReservationSchema>;
export type RescheduleReservationValues = z.infer<
  typeof rescheduleReservationSchema
>;
