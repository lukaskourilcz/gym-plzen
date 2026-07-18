import { z } from "zod";
import { optionalText } from "./common";

/** Branding assets: logo + terms PDF, provided as URLs (from the uploader or pasted). */
export const brandingSchema = z.object({
  logoUrl: z.union([z.literal(""), z.string().url("Neplatná URL.")]).optional(),
  termsUrl: z.union([z.literal(""), z.string().url("Neplatná URL.")]).optional(),
});

/** SMS access-code template (placeholders {code}, {time}). */
export const smsTemplateSchema = z.object({
  template: optionalText(320),
});

export type BrandingValues = z.infer<typeof brandingSchema>;
export type SmsTemplateValues = z.infer<typeof smsTemplateSchema>;
