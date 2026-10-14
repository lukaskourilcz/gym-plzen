import { z } from "zod";
import { dayOfWeek, minuteOfDay } from "@/lib/helpers/datetime";

export const BLOCK_PRICING_KEY = "pricing.time_blocks";
export const blockPriceSchema = z
  .object({
    id: z.string().uuid(),
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
    priceCents: z.number().int().positive().max(1_000_000),
  })
  .refine((rule) => rule.endMinute > rule.startMinute);
export type BlockPrice = z.infer<typeof blockPriceSchema>;
export interface PricingHours {
  dayOfWeek: number;
  openMinute: number;
  closeMinute: number;
  slotMinutes: number;
  isClosed: number;
}
export function pricingSlots(
  hours: PricingHours,
): { startMinute: number; endMinute: number }[] {
  if (hours.isClosed || hours.slotMinutes <= 0) return [];
  const slots = [];
  for (
    let start = hours.openMinute;
    start + hours.slotMinutes <= hours.closeMinute;
    start += hours.slotMinutes
  )
    slots.push({ startMinute: start, endMinute: start + hours.slotMinutes });
  return slots;
}
export function isBlockPriceAligned(
  rule: BlockPrice,
  hours: PricingHours,
): boolean {
  const slots = pricingSlots(hours);
  return (
    rule.dayOfWeek === hours.dayOfWeek &&
    rule.startMinute < rule.endMinute &&
    slots.some((slot) => slot.startMinute === rule.startMinute) &&
    slots.some((slot) => slot.endMinute === rule.endMinute)
  );
}
export function parseBlockPrices(value: unknown): BlockPrice[] {
  const parsed = z.array(blockPriceSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
/** Explicit block price takes precedence over the date period and fallback. */
export function resolveBlockPrice(
  at: Date,
  rules: readonly BlockPrice[],
  hours: readonly PricingHours[],
  fallbackCents: number,
): number {
  if (!Number.isFinite(at.getTime())) return fallbackCents;
  const day = dayOfWeek(at);
  const configured = hours.find((row) => row.dayOfWeek === day);
  const minute = minuteOfDay(at);
  const matched =
    configured &&
    rules.find(
      (rule) =>
        rule.dayOfWeek === day &&
        isBlockPriceAligned(rule, configured) &&
        minute >= rule.startMinute &&
        minute < rule.endMinute,
    );
  return matched?.priceCents ?? fallbackCents;
}
