import { z } from "zod";

export const MAX_EXTRA_PEOPLE = 2;
export const PARTICIPANT_PRICING_KEY = "pricing.additional_people";
export const participantPricingSchema = z.object({
  amountCents: z.number().int().min(0).max(1_000_000),
  mode: z.enum(["flat", "per_person"]),
});
export type ParticipantPricing = z.infer<typeof participantPricingSchema>;
export const DEFAULT_PARTICIPANT_PRICING: ParticipantPricing = {
  amountCents: 10_000,
  mode: "flat",
};
export function parseParticipantPricing(value: unknown): ParticipantPricing {
  const parsed = participantPricingSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_PARTICIPANT_PRICING;
}
export function assertExtraPeople(count: number): void {
  if (!Number.isInteger(count) || count < 0 || count > MAX_EXTRA_PEOPLE)
    throw new Error("Invalid participant count");
}
export function participantSurcharge(
  count: number,
  pricing: ParticipantPricing,
): number {
  assertExtraPeople(count);
  return count === 0
    ? 0
    : pricing.amountCents * (pricing.mode === "flat" ? 1 : count);
}
/** Charge only for newly added people; the existing purchase is never repriced. */
export function participantAdditionPrice(
  from: number,
  to: number,
  pricing: ParticipantPricing,
): number {
  assertExtraPeople(from);
  assertExtraPeople(to);
  if (to <= from) throw new Error("Participant count must increase");
  return (
    participantSurcharge(to, pricing) - participantSurcharge(from, pricing)
  );
}
export function participantLabel(extraPeople: number): string {
  return extraPeople > 0
    ? `1 dospělá osoba + ${extraPeople} ${extraPeople === 1 ? "osoba" : "osoby"}`
    : "1 dospělá osoba";
}
