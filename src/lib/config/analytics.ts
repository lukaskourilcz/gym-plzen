/** Public GA4 measurement ID supplied by the operator. */
export const GOOGLE_ANALYTICS_ID = "G-6L9N41NKT8";

export const ANALYTICS_CONSENT_STORAGE_KEY = "namaste:analytics-consent-v1";
export const OPEN_COOKIE_SETTINGS_EVENT = "namaste:open-cookie-settings";

export type AnalyticsConsent = "granted" | "denied";

export function isAnalyticsConsent(
  value: string | null,
): value is AnalyticsConsent {
  return value === "granted" || value === "denied";
}
