import { z } from "zod";
import { optionalText } from "./common";
import { MAX_HERO_PREVIEW_DAYS, MIN_HERO_PREVIEW_DAYS } from "@/lib/config/hero";

/** Branding assets: logo + terms PDF, provided as URLs (from the uploader or pasted). */
export const brandingSchema = z.object({
  logoUrl: z.union([z.literal(""), z.string().url("Neplatná URL.")]).optional(),
  termsUrl: z.union([z.literal(""), z.string().url("Neplatná URL.")]).optional(),
});

/** SMS access-code template (placeholders {code}, {time}). */
export const smsTemplateSchema = z.object({
  template: optionalText(320),
});

/** How many days ahead (incl. today) the hero availability calendar lets visitors browse. */
export const heroPreviewSchema = z.object({
  previewDays: z
    .number({ invalid_type_error: "Zadejte číslo." })
    .int("Zadejte celé číslo.")
    .min(MIN_HERO_PREVIEW_DAYS, `Nejméně ${MIN_HERO_PREVIEW_DAYS} den.`)
    .max(MAX_HERO_PREVIEW_DAYS, `Nejvýše ${MAX_HERO_PREVIEW_DAYS} dní.`),
});

export type BrandingValues = z.infer<typeof brandingSchema>;
export type SmsTemplateValues = z.infer<typeof smsTemplateSchema>;
export type HeroPreviewValues = z.infer<typeof heroPreviewSchema>;
