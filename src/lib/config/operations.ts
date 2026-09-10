import { z } from "zod";

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

export function isDateOpenForBooking(date: string, operations: Operations) {
  return !operations.bookingsFrom || date >= operations.bookingsFrom;
}
