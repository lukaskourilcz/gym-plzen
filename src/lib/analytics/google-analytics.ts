import { createGoogleTag } from "./google-tag";
import {
  GOOGLE_ANALYTICS_ID,
  CONSENT_STORAGE_KEY,
  parseConsentPreferences,
} from "@/lib/config/analytics";
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GOOGLE_TAG_SCRIPT_ID = "namaste-google-analytics";
let analyticsStarted = false;

function ensureGtag() {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    createGoogleTag((command) => window.dataLayer?.push(command));
  return window.gtag;
}

function googleConsentState(analyticsStorage: "granted" | "denied") {
  return {
    analytics_storage: analyticsStorage,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  } as const;
}

/**
 * Basic Consent Mode: gtag.js is not requested until analytics is allowed.
 * Advertising storage and signals stay disabled even after analytics consent.
 */
export function startGoogleAnalytics() {
  // No measurement ID configured: nothing to start.
  if (!GOOGLE_ANALYTICS_ID) return;
  const gtag = ensureGtag();

  if (analyticsStarted || document.getElementById(GOOGLE_TAG_SCRIPT_ID)) {
    analyticsStarted = true;
    gtag("consent", "update", googleConsentState("granted"));
    return;
  }

  gtag("consent", "default", googleConsentState("denied"));
  gtag("set", "ads_data_redaction", true);
  gtag("consent", "update", googleConsentState("granted"));
  gtag("js", new Date());
  gtag("config", GOOGLE_ANALYTICS_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement("script");
  script.id = GOOGLE_TAG_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
  document.head.append(script);
  analyticsStarted = true;
}

export const ANALYTICS_CONSENT_CHANGED = "navi:analytics-consent-changed";
export function trackGooglePurchase(
  reservationId: string,
  priceCents: number,
  currency: string,
  /** Slots bought together in one order; one entry each. */
  quantity = 1,
) {
  if (!GOOGLE_ANALYTICS_ID || priceCents <= 0 || !Number.isFinite(priceCents))
    return;
  try {
    if (
      !parseConsentPreferences(window.localStorage.getItem(CONSENT_STORAGE_KEY))
        ?.analytics
    )
      return;
  } catch {
    return;
  }
  const key = `navi:ga-purchase:${reservationId}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
  } catch {
    /* GA dedupes transaction_id. */
  }
  startGoogleAnalytics();
  window.gtag?.("event", "purchase", {
    transaction_id: reservationId,
    currency: currency.toUpperCase(),
    value: priceCents / 100,
    items: [
      {
        item_id: "private-gym-entry",
        item_name: "Vstup NAVI Private Gym",
        price: priceCents / 100 / Math.max(1, quantity),
        quantity: Math.max(1, quantity),
      },
    ],
  });
  try {
    window.sessionStorage.setItem(key, "sent");
  } catch {
    /* Transaction ID remains stable. */
  }
}
