import { z } from "zod";
import { optionalText, priceCentsSchema, uuidSchema } from "./common";
import { isDateKey } from "@/lib/helpers/datetime";

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

/** A named booking-time price period, expressed as inclusive Prague dates. */
export const pricingPeriodSchema = z
  .object({
    id: uuidSchema.optional(),
    name: z.string().trim().min(1, "Zadejte název období.").max(120),
    priceCzk: z
      .number({ invalid_type_error: "Zadejte číslo." })
      .int("Cena musí být v celých korunách.")
      .positive("Cena musí být větší než nula."),
    startsOn: z.string().refine(isDateKey, "Zadejte platné datum začátku."),
    endsOn: z.string().refine(isDateKey, "Zadejte platné datum konce."),
  })
  .superRefine((value, ctx) => {
    if (
      isDateKey(value.startsOn) &&
      isDateKey(value.endsOn) &&
      value.endsOn < value.startsOn
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsOn"],
        message: "Konec období nesmí být před jeho začátkem.",
      });
    }
  });

export const deletePricingPeriodSchema = z.object({ id: uuidSchema });

export type UpsertPlanValues = z.infer<typeof upsertPlanSchema>;
export type PricingPeriodValues = z.infer<typeof pricingPeriodSchema>;
export type EntryPriceValues = z.infer<typeof entryPriceSchema>;
