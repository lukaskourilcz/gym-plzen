import { publicEnv } from "@/lib/public-env";

/**
 * Measurement IDs come from the environment, so switching analytics accounts
 * is a Vercel change rather than a deployment. An unset ID disables that
 * tracker entirely: nothing loads and the consent card does not offer it.
 */
export const GOOGLE_ANALYTICS_ID =
  publicEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || null;
export const META_PIXEL_ID =
  publicEnv.NEXT_PUBLIC_META_PIXEL_ID?.trim() || null;

/** Whether each tracker is configured at all. */
export const isAnalyticsConfigured = Boolean(GOOGLE_ANALYTICS_ID);
export const isMarketingConfigured = Boolean(META_PIXEL_ID);

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
