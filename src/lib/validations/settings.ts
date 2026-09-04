import { z } from "zod";
import { optionalText } from "./common";
import {
  MAX_HERO_PREVIEW_DAYS,
  MIN_HERO_PREVIEW_DAYS,
} from "@/lib/config/hero";
import {
  MAX_BOOKING_HORIZON_DAYS,
  MIN_BOOKING_HORIZON_DAYS,
} from "@/lib/config/schedule";
import { EMAIL_TEMPLATE_IDS } from "@/lib/config/email-templates";

/** Branding assets: logo + terms PDF, provided as URLs (from the uploader or pasted). */
export const brandingSchema = z.object({
  logoUrl: z.union([z.literal(""), z.string().url("Neplatná URL.")]).optional(),
  termsUrl: z
    .union([z.literal(""), z.string().url("Neplatná URL.")])
    .optional(),
  heroImageUrl: z
    .union([z.literal(""), z.string().url("Neplatná URL.")])
    .optional(),
  heroImageAlt: optionalText(180),
  sectionsImageUrl: z
    .union([z.literal(""), z.string().url("Neplatná URL.")])
    .optional(),
});

/** SMS access-code template (placeholders {code}, {time}). */
export const smsTemplateSchema = z.object({
  template: optionalText(320),
});

const emailTemplateIdSchema = z.enum(EMAIL_TEMPLATE_IDS);

/** Editable sender-owned e-mail template. Variables remain in `{braces}`. */
export const emailTemplateSchema = z.object({
  id: emailTemplateIdSchema,
  subject: z
    .string()
    .trim()
    .min(3, "Předmět musí obsahovat alespoň 3 znaky.")
    .max(160, "Předmět může mít nejvýše 160 znaků."),
  body: z
    .string()
    .trim()
    .min(10, "Text šablony musí obsahovat alespoň 10 znaků.")
    .max(8_000, "Text šablony může mít nejvýše 8 000 znaků."),
});

/** Admin-triggered delivery of the current e-mail template to a test inbox. */
export const emailTemplateTestSchema = z.object({
  id: emailTemplateIdSchema,
  email: z.string().trim().email("Zadejte platnou e-mailovou adresu."),
});

/** How many days ahead (incl. today) the hero availability calendar lets visitors browse. */
export const heroPreviewSchema = z.object({
  previewDays: z
    .number({ invalid_type_error: "Zadejte číslo." })
    .int("Zadejte celé číslo.")
    .min(MIN_HERO_PREVIEW_DAYS, `Nejméně ${MIN_HERO_PREVIEW_DAYS} den.`)
    .max(MAX_HERO_PREVIEW_DAYS, `Nejvýše ${MAX_HERO_PREVIEW_DAYS} dní.`),
});

/** How far ahead visitors may book, in days including today. */
export const bookingHorizonSchema = z.object({
  horizonDays: z
    .number({ invalid_type_error: "Zadejte číslo." })
    .int("Zadejte celé číslo.")
    .min(MIN_BOOKING_HORIZON_DAYS, `Nejméně ${MIN_BOOKING_HORIZON_DAYS} dní.`)
    .max(MAX_BOOKING_HORIZON_DAYS, `Nejvýše ${MAX_BOOKING_HORIZON_DAYS} dní.`),
});

/** Optional image URL, empty meaning "not supplied yet". */
const optionalImageUrl = z
  .union([z.literal(""), z.string().url("Neplatná URL.")])
  .optional();

/** Gallery, zone photographs and the illustrative-photo label. */
export const sitePhotosSchema = z.object({
  gallery: z.array(optionalImageUrl).length(4),
  zones: z.array(optionalImageUrl).length(6),
  illustrative: z.boolean(),
});

export type BrandingValues = z.infer<typeof brandingSchema>;
export type SitePhotosValues = z.infer<typeof sitePhotosSchema>;
export type BookingHorizonValues = z.infer<typeof bookingHorizonSchema>;
export type SmsTemplateValues = z.infer<typeof smsTemplateSchema>;
export type EmailTemplateValues = z.infer<typeof emailTemplateSchema>;
export type EmailTemplateTestValues = z.infer<typeof emailTemplateTestSchema>;
export type HeroPreviewValues = z.infer<typeof heroPreviewSchema>;
