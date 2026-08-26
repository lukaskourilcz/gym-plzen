import { z } from "zod";

/** The single editable commercial setting: entry price in Kč. */
export const entryPriceSchema = z.object({
  priceCzk: z
    .number({ invalid_type_error: "Zadejte číslo." })
    .min(0, "Cena nesmí být záporná."),
});

export type EntryPriceValues = z.infer<typeof entryPriceSchema>;
