/**
 * Admin-configurable branding & message-template setting keys, with defaults.
 * Stored in `site_setting` and read by the public site / notification services.
 */

export const LOGO_URL_KEY = "branding.logo_url";
export const TERMS_URL_KEY = "branding.terms_pdf_url";

/** SMS access-code template. Placeholders: {code}, {time}. */
export const SMS_ACCESS_TEMPLATE_KEY = "messages.sms_access_code";
export const DEFAULT_SMS_ACCESS_TEMPLATE = "Vstupni kod: {code} ({time}). Gym Plzen";

/** Substitute {code}/{time} placeholders in a message template. */
export function renderTemplate(
  template: string,
  vars: { code?: string; time?: string },
): string {
  return template
    .replaceAll("{code}", vars.code ?? "")
    .replaceAll("{time}", vars.time ?? "");
}
