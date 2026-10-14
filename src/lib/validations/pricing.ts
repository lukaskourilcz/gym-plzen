import { z } from "zod";
import { uuidSchema } from "./common";

export const saveBlockPriceSchema = z
  .object({
    id: uuidSchema.optional(),
    applyToMatchingDays: z.boolean().optional(),
    dayOfWeek: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
    priceCzk: z
      .number({ invalid_type_error: "Zadejte cenu." })
      .int("Cena musí být v celých korunách.")
      .min(1)
      .max(10_000),
  })
  .refine((value) => value.endMinute > value.startMinute, {
    path: ["endMinute"],
    message: "Poslední blok musí následovat po prvním.",
  });
export const deleteBlockPriceSchema = z.object({ id: uuidSchema });
export const setParticipantsEnabledSchema = z.object({ enabled: z.boolean() });
export const saveParticipantPricingSchema = z.object({
  priceCzk: z
    .number({ invalid_type_error: "Zadejte cenu." })
    .int()
    .min(0)
    .max(10_000),
  mode: z.enum(["flat", "per_person"]),
});
export type SaveBlockPriceValues = z.infer<typeof saveBlockPriceSchema>;
export type SaveParticipantPricingValues = z.infer<
  typeof saveParticipantPricingSchema
>;
