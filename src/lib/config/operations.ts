import { z } from "zod";
import { OPENING_DATE_KEY } from "./booking-start";

export const OPERATIONS_SETTING_KEY = "booking.operations";
export const operationsSchema = z.object({
  paymentsEnabled: z.boolean(),
  bookingsFrom: z
    .string()
    .refine(
      (value) =>
        value === "" ||
        (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
          new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value),
      "Zadejte platné datum.",
    ),
  accessCodesEnabled: z.boolean(),
});
export type Operations = z.infer<typeof operationsSchema>;
export const DEFAULT_OPERATIONS: Operations = {
  paymentsEnabled: false,
  bookingsFrom: "",
  accessCodesEnabled: false,
};

/**
 * Whether a Prague date can be booked at all. Nothing before opening day is
 * ever bookable, whatever the operator's own `bookingsFrom`: the calendar
 * only hides those days, and a crafted details URL must not get past it.
 */
export function isDateOpenForBooking(date: string, operations: Operations) {
  if (date < OPENING_DATE_KEY) return false;
  return !operations.bookingsFrom || date >= operations.bookingsFrom;
}
