/** Public GA4 measurement ID supplied by the operator. */
export const GOOGLE_ANALYTICS_ID = "G-6L9N41NKT8";
/** Public Meta Pixel / Dataset ID supplied by the operator. */
export const META_PIXEL_ID = "1816423579552231";

export const CONSENT_STORAGE_KEY = "namaste:tracking-consent-v2";
export const LEGACY_ANALYTICS_CONSENT_STORAGE_KEY =
  "namaste:analytics-consent-v1";
export const OPEN_COOKIE_SETTINGS_EVENT = "namaste:open-cookie-settings";

export type ConsentPreferences = {
  analytics: boolean;
  marketing: boolean;
};

export function parseConsentPreferences(
  value: string | null,
): ConsentPreferences | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ConsentPreferences>;
    return typeof parsed.analytics === "boolean" &&
      typeof parsed.marketing === "boolean"
      ? { analytics: parsed.analytics, marketing: parsed.marketing }
      : null;
  } catch {
    return null;
  }
}
