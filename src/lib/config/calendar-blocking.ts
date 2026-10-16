import { z } from "zod";
import { isDateKey, daysBetweenDateKeys } from "@/lib/helpers/datetime";

const dateKey = z.string().refine(isDateKey);
export const calendarBlockRangeSchema = z
  .object({ from: dateKey, to: dateKey })
  .refine(
    ({ from, to }) =>
      isDateKey(from) &&
      isDateKey(to) &&
      daysBetweenDateKeys(from, to) > 0 &&
      daysBetweenDateKeys(from, to) <= 42,
    "Vyberte nejvýše 42 dní.",
  );
export const calendarBlockWindowSchema = z.object({
  startISO: z.string().datetime(),
  endISO: z.string().datetime(),
});
export const calendarBlockSelectionSchema = z.object({
  operationId: z.string().uuid(),
  scheduleFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  windows: z.array(calendarBlockWindowSchema).min(1).max(200),
});
export type CalendarBlockRange = z.infer<typeof calendarBlockRangeSchema>;
export type CalendarBlockSelection = z.infer<
  typeof calendarBlockSelectionSchema
>;
export type CalendarBlockWindow = z.infer<typeof calendarBlockWindowSchema>;
