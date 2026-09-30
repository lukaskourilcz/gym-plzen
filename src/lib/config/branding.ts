/**
 * Admin-configurable branding & message-template setting keys, with defaults.
 * Stored in `site_setting` and read by the public site / notification services.
 */

export const LOGO_URL_KEY = "branding.logo_url";
export const TERMS_URL_KEY = "branding.terms_pdf_url";
export const HERO_IMAGE_URL_KEY = "branding.hero_image_url";
export const HERO_IMAGE_ALT_KEY = "branding.hero_image_alt";
/** Photograph pinned behind the operating-steps and pricing bands. */
export const SECTIONS_IMAGE_URL_KEY = "branding.sections_image_url";

/** Optimized photographs of the actual NAVI space, committed with the app. */
export const DEFAULT_HERO_IMAGE_URL = "/images/photos/hero.webp";
export const DEFAULT_SECTIONS_IMAGE_URL = "/images/photos/sections.webp";
export const DEFAULT_GALLERY_IMAGE_URLS = [
  "/images/photos/gallery-1.webp",
  "/images/photos/gallery-2.webp",
  "/images/photos/gallery-3.webp",
  "/images/photos/gallery-4.webp",
] as const;
export const DEFAULT_ZONE_IMAGE_URLS = [
  "/images/photos/zone-1.webp",
  "/images/photos/zone-2.webp",
  "/images/photos/zone-3.webp",
  "/images/photos/zone-4.webp",
  "/images/photos/zone-5.webp",
  "/images/photos/zone-6.webp",
] as const;

/**
 * Gallery tiles on the homepage and the six equipment zone tiles. Each holds a
 * URL; the alt text stays in the CMS beside the rest of the copy.
 */
export const GALLERY_IMAGE_URL_KEYS = [
  "branding.gallery_1_url",
  "branding.gallery_2_url",
  "branding.gallery_3_url",
  "branding.gallery_4_url",
] as const;

export function zoneImageUrlKey(zoneNumber: number): string {
  return `branding.zone_${zoneNumber}_url`;
}

/**
 * Whether photographs on the site are stock stand-ins rather than the gym
 * itself. While true each one carries an info icon whose tooltip says
 * "Ilustrační foto", so it cannot be mistaken for the real space.
 * The operator turns it off once their own photographs are uploaded.
 */
export const ILLUSTRATIVE_PHOTOS_KEY = "branding.illustrative_photos";

/** SMS access-code template. Placeholders: {code}, {time}. */
export const SMS_ACCESS_TEMPLATE_KEY = "messages.sms_access_code";
export const DEFAULT_SMS_ACCESS_TEMPLATE =
  "Vstupní kód: {code} ({time}). NAVI Private Gym";

/** Substitute {code}/{time} placeholders in a message template. */
export function renderTemplate(
  template: string,
  vars: { code?: string; time?: string },
): string {
  return template
    .replaceAll("{code}", vars.code ?? "")
    .replaceAll("{time}", vars.time ?? "");
}
