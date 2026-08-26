import { z } from "zod";

/** Client editor schema: intentionally exposes only a human text value. */
export const editPublicTextSchema = z.object({
  key: z.string().min(1).max(200),
  valueText: z.string().trim().min(1, "Text nemůže být prázdný.").max(10_000),
});

export type EditPublicTextValues = z.infer<typeof editPublicTextSchema>;
