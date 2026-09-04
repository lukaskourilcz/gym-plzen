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

/**
 * A time-limited promotional price. Dates arrive as `datetime-local` strings
 * and are converted to instants in the action, so the schema stays
 * transform-free and can validate on both sides.
 *
 * Leaving every field empty clears the promotion, which is how an operator
 * ends it early.
 */
export const promoPriceSchema = z
  .object({
    priceCzk: z
      .number({ invalid_type_error: "Zadejte číslo." })
      .positive("Akční cena musí být větší než nula.")
      .optional(),
    startsAt: optionalText(40),
    endsAt: optionalText(40),
  })
  .superRefine((value, ctx) => {
    const filled = [value.priceCzk != null, !!value.startsAt, !!value.endsAt];
    if (!filled.some(Boolean)) return; // cleared: nothing to validate

    if (value.priceCzk == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceCzk"],
        message: "Zadejte akční cenu, nebo vymažte celou akci.",
      });
    }
    if (!value.startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startsAt"],
        message: "Zadejte začátek akce.",
      });
    }
    if (!value.endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Zadejte konec akce.",
      });
    }
    if (
      value.startsAt &&
      value.endsAt &&
      new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Konec akce musí být po jejím začátku.",
      });
    }
  });

export type UpsertPlanValues = z.infer<typeof upsertPlanSchema>;
export type PromoPriceValues = z.infer<typeof promoPriceSchema>;
export type EntryPriceValues = z.infer<typeof entryPriceSchema>;
