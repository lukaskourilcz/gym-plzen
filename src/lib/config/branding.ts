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
 * itself. While true each one carries a visible "Ilustrační foto" label, so a
 * visitor is never led to believe they are looking at the real space.
 * The operator turns it off once their own photographs are uploaded.
 */
export const ILLUSTRATIVE_PHOTOS_KEY = "branding.illustrative_photos";

/** SMS access-code template. Placeholders: {code}, {time}. */
export const SMS_ACCESS_TEMPLATE_KEY = "messages.sms_access_code";
export const DEFAULT_SMS_ACCESS_TEMPLATE =
  "Vstupni kod: {code} ({time}). Gym Plzen";

/** Substitute {code}/{time} placeholders in a message template. */
export function renderTemplate(
  template: string,
  vars: { code?: string; time?: string },
): string {
  return template
    .replaceAll("{code}", vars.code ?? "")
    .replaceAll("{time}", vars.time ?? "");
}
