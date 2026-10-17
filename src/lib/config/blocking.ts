import { z } from "zod";
import {
  addDaysToDateKey,
  addMinutes,
  dayOfWeek,
  daysBetweenDateKeys,
  isDateKey,
  localDateTimeToDate,
} from "@/lib/helpers/datetime";
import type { DayHours } from "@/lib/services/slots";

export const BLOCK_APPLICATION_PAGE_SIZE = 10;

export const blockingSlotSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1439),
  })
  .refine(
    (slot) => slot.endMinute > slot.startMinute,
    "Konec musí být po začátku.",
  );
export type BlockingSlot = z.infer<typeof blockingSlotSchema>;
const date = z.string().refine(isDateKey, "Zadejte platné datum.");
export const blockTemplateSchema = z
  .object({
    id: z.string().uuid().optional(),
    expectedUpdatedAt: z.string().datetime().optional(),
    name: z.string().trim().min(2).max(120),
    validFrom: date,
    validTo: date,
    slots: z
      .array(blockingSlotSchema)
      .min(1, "Vyberte alespoň jeden slot.")
      .max(350),
  })
  .refine(
    (input) =>
      isDateKey(input.validFrom) &&
      isDateKey(input.validTo) &&
      input.validTo >= input.validFrom &&
      daysBetweenDateKeys(input.validFrom, input.validTo) <= 365,
    "Vyberte období od–do, nejvýše 366 dní.",
  );
export const blockTargetSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("range"), from: date, to: date }),
  z.object({ mode: z.literal("dates"), dates: z.array(date).min(1).max(366) }),
]);
export const blockPreviewSchema = z.object({
  templateIds: z.array(z.string().uuid()).min(1).max(20),
  target: blockTargetSchema,
});
export const blockApplySchema = blockPreviewSchema.extend({
  operationId: z.string().uuid(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
export type BlockTarget = z.infer<typeof blockTargetSchema>;
export type BlockPreviewInput = z.infer<typeof blockPreviewSchema>;
export type BlockApplyInput = z.infer<typeof blockApplySchema>;
export type BlockTemplateInput = z.infer<typeof blockTemplateSchema>;
export type BlockingHours = DayHours & { dayOfWeek: number };

export function blockTargetDates(target: BlockTarget): string[] {
  if (target.mode === "dates") return [...new Set(target.dates)].sort();
  const span = daysBetweenDateKeys(target.from, target.to);
  if (span < 0 || span > 365)
    throw new Error(
      "Období může mít nejvýše 366 dní a konec musí následovat po začátku.",
    );
  return Array.from({ length: span + 1 }, (_, index) =>
    addDaysToDateKey(target.from, index),
  );
}
export function slotFitsHours(slot: BlockingSlot, hours: BlockingHours[]) {
  const day = hours.find((row) => row.dayOfWeek === slot.dayOfWeek);
  return (
    !!day &&
    !day.isClosed &&
    day.slotMinutes > 0 &&
    slot.startMinute >= day.openMinute &&
    slot.endMinute <= day.closeMinute &&
    slot.endMinute - slot.startMinute === day.slotMinutes &&
    (slot.startMinute - day.openMinute) % day.slotMinutes === 0
  );
}
export function minuteLabel(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
export function blockSlotKey(slot: BlockingSlot) {
  return `${slot.dayOfWeek}:${slot.startMinute}:${slot.endMinute}`;
}
export function canonicalBlockSlots(slots: BlockingSlot[]) {
  return [
    ...new Map(slots.map((slot) => [blockSlotKey(slot), slot])).values(),
  ].sort(
    (a, b) =>
      a.dayOfWeek - b.dayOfWeek ||
      a.startMinute - b.startMinute ||
      a.endMinute - b.endMinute,
  );
}
export function buildBlockWindows(
  dates: string[],
  slots: BlockingSlot[],
  now: Date,
) {
  return dates.flatMap((dateKey) => {
    const weekday = dayOfWeek(localDateTimeToDate(dateKey, 720));
    return canonicalBlockSlots(slots)
      .filter((slot) => slot.dayOfWeek === weekday)
      .flatMap((slot) => {
        const start = localDateTimeToDate(dateKey, slot.startMinute);
        const end = addMinutes(start, slot.endMinute - slot.startMinute);
        if (start <= now) return [];
        return [
          {
            dateKey,
            startISO: start.toISOString(),
            endISO: end.toISOString(),
            label: `${minuteLabel(slot.startMinute)}–${minuteLabel(slot.endMinute)}`,
          },
        ];
      });
  });
}
