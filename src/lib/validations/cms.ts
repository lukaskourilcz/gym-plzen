import { z } from "zod";
import { optionalText, uuidSchema } from "./common";

export const upsertBlockSchema = z.object({
  key: z
    .string()
    .min(1, "Zadejte klíč obsahu.")
    .max(200)
    .regex(/^[a-zA-Z0-9._-]+$/, "Klíč smí obsahovat jen písmena, číslice, . _ -"),
  locale: z.string().min(2).max(10).default("cs"),
  type: z.enum(["text", "richtext", "image", "file", "json"]).default("text"),
  valueText: optionalText(10_000),
  mediaId: uuidSchema.optional(),
  label: optionalText(200),
  groupName: optionalText(120),
  sortOrder: z.number().int().default(0),
});

export type UpsertBlockValues = z.infer<typeof upsertBlockSchema>;
