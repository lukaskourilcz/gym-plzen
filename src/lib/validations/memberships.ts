import { z } from "zod";
import { optionalText, priceCentsSchema, uuidSchema } from "./common";

export const upsertPlanSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().min(1, "Zadejte název plánu.").max(120),
  description: optionalText(1000),
  priceCents: priceCentsSchema,
  currency: z.string().length(3).default("czk"),
  interval: z.enum(["week", "month", "year"]).default("month"),
  stripePriceId: optionalText(200),
  stripeProductId: optionalText(200),
  sessionsPerInterval: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

/** The single editable commercial setting: entry price in Kč. */
export const entryPriceSchema = z.object({
  priceCzk: z
    .number({ invalid_type_error: "Zadejte číslo." })
    .min(0, "Cena nesmí být záporná."),
});

export type UpsertPlanValues = z.infer<typeof upsertPlanSchema>;
export type EntryPriceValues = z.infer<typeof entryPriceSchema>;
