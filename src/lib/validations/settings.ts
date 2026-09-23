import { z } from "zod";
import { optionalText } from "./common";
import {
  MAX_BOOKING_HORIZON_DAYS,
  MIN_BOOKING_HORIZON_DAYS,
} from "@/lib/config/schedule";
import { EMAIL_TEMPLATE_IDS } from "@/lib/config/email-templates";
import { MAX_VAT_RATE_PERCENT } from "@/lib/config/billing";

const imageUrl = z
  .string()
  .max(2_048, "URL je příliš dlouhá.")
  .refine(
    (value) =>
      value === "" ||
      /^\/images\/[a-z0-9/_-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(value) ||
      z.string().url().safeParse(value).success,
    "Neplatná URL obrázku.",
  );

/** Branding assets: logo + terms PDF, provided as URLs (from the uploader or pasted). */
export const brandingSchema = z.object({
  logoUrl: imageUrl.optional(),
  termsUrl: z
    .union([z.literal(""), z.string().url("Neplatná URL.")])
    .optional(),
  heroImageUrl: imageUrl.optional(),
  heroImageAlt: optionalText(180),
  sectionsImageUrl: imageUrl.optional(),
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

/** How far ahead visitors may book, in days including today. */
export const bookingHorizonSchema = z.object({
  horizonDays: z
    .number({ invalid_type_error: "Zadejte číslo." })
    .int("Zadejte celé číslo.")
    .min(MIN_BOOKING_HORIZON_DAYS, `Nejméně ${MIN_BOOKING_HORIZON_DAYS} dní.`)
    .max(MAX_BOOKING_HORIZON_DAYS, `Nejvýše ${MAX_BOOKING_HORIZON_DAYS} dní.`),
});

/** Optional image URL, empty meaning "not supplied yet". */
const optionalImageUrl = imageUrl.optional();

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

/**
 * The operator's billing details, printed on every payment document. Every
 * required field must be filled in before documents can be issued : an
 * invented IČO on a real invoice is worse than no invoice at all, so the
 * service refuses rather than guesses.
 */
export const billingProfileSchema = z.object({
  legalName: z
    .string()
    .trim()
    .max(160, "Název může mít nejvýše 160 znaků.")
    .default(""),
  street: z.string().trim().max(160, "Ulice může mít nejvýše 160 znaků."),
  city: z.string().trim().max(120, "Město může mít nejvýše 120 znaků."),
  zip: z.string().trim().max(20, "PSČ může mít nejvýše 20 znaků."),
  ico: z.string().trim().max(20, "IČO může mít nejvýše 20 znaků."),
  dic: z.string().trim().max(20, "DIČ může mít nejvýše 20 znaků."),
  vatRatePercent: z
    .number({ invalid_type_error: "Zadejte číslo." })
    .int("Zadejte celé číslo.")
    .min(0, "Sazba nemůže být záporná.")
    .max(MAX_VAT_RATE_PERCENT, "Sazba může být nejvýše 100 %."),
  bankAccount: optionalText(60),
  registryNote: optionalText(400),
  sendDocuments: z.boolean(),
});

export type BillingProfileValues = z.infer<typeof billingProfileSchema>;
