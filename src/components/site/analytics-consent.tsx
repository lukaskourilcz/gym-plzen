"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  CONSENT_STORAGE_KEY,
  LEGACY_TRACKING_CONSENT_STORAGE_KEY,
  GOOGLE_ANALYTICS_ID,
  isAnalyticsConfigured,
  isMarketingConfigured,
  LEGACY_ANALYTICS_CONSENT_STORAGE_KEY,
  OPEN_COOKIE_SETTINGS_EVENT,
  type ConsentPreferences,
  parseConsentPreferences,
} from "@/lib/config/analytics";
import {
  deleteMetaPixelCookies,
  startMetaPixel,
} from "@/lib/analytics/meta-pixel";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GOOGLE_TAG_SCRIPT_ID = "namaste-google-analytics";
const EMPTY_PREFERENCES: ConsentPreferences = {
  analytics: false,
  marketing: false,
};
let analyticsStarted = false;

function ensureGtag() {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
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
function startGoogleAnalytics() {
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

function deleteGoogleAnalyticsCookies() {
  const hostParts = window.location.hostname.split(".");
  const registrableDomain =
    hostParts.length > 1 ? hostParts.slice(-2).join(".") : null;
  const domains = [
    null,
    window.location.hostname,
    registrableDomain,
    registrableDomain ? `.${registrableDomain}` : null,
  ];

  for (const entry of document.cookie.split(";")) {
    const name = entry.split("=")[0]?.trim();
    if (!name?.startsWith("_ga")) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${
        domain ? `; Domain=${domain}` : ""
      }`;
    }
  }
}

export function AnalyticsConsentManager() {
  const pathname = usePathname();
  const [preferences, setPreferences] = useState<ConsentPreferences | null>(
    null,
  );
  const [draft, setDraft] = useState<ConsentPreferences>(EMPTY_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let saved: ConsentPreferences | null = null;
    let legacy: string | null = null;
    try {
      saved = parseConsentPreferences(
        window.localStorage.getItem(CONSENT_STORAGE_KEY),
      );
      if (!saved) {
        saved = parseConsentPreferences(
          window.localStorage.getItem(LEGACY_TRACKING_CONSENT_STORAGE_KEY),
        );
        if (saved) {
          window.localStorage.setItem(
            CONSENT_STORAGE_KEY,
            JSON.stringify(saved),
          );
          window.localStorage.removeItem(LEGACY_TRACKING_CONSENT_STORAGE_KEY);
        }
      }
      legacy = window.localStorage.getItem(
        LEGACY_ANALYTICS_CONSENT_STORAGE_KEY,
      );
    } catch {
      // Privacy-restricted browsers may block storage; ask again next visit.
    }

    if (saved) {
      setPreferences(saved);
      setDraft(saved);
    } else if (legacy === "granted" || legacy === "denied") {
      // A new marketing purpose needs a fresh choice. Preserve the previous
      // analytics answer only as the preselected draft; do not infer consent.
      setDraft({ analytics: legacy === "granted", marketing: false });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (preferences?.analytics) startGoogleAnalytics();
  }, [preferences?.analytics]);

  useEffect(() => {
    if (preferences?.marketing) startMetaPixel(pathname);
  }, [pathname, preferences?.marketing]);

  useEffect(() => {
    const openSettings = () => {
      setDraft(preferences ?? EMPTY_PREFERENCES);
      setSettingsOpen(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    return () =>
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
  }, [preferences]);

  const savePreferences = useCallback(
    (nextPreferences: ConsentPreferences) => {
      try {
        window.localStorage.setItem(
          CONSENT_STORAGE_KEY,
          JSON.stringify(nextPreferences),
        );
        window.localStorage.removeItem(LEGACY_ANALYTICS_CONSENT_STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_TRACKING_CONSENT_STORAGE_KEY);
      } catch {
        // The in-memory choice still applies for the current page.
      }

      const analyticsRevoked =
        preferences?.analytics === true && !nextPreferences.analytics;
      const marketingRevoked =
        preferences?.marketing === true && !nextPreferences.marketing;
      if (analyticsRevoked) {
        window.gtag?.("consent", "update", googleConsentState("denied"));
        deleteGoogleAnalyticsCookies();
      }
      if (marketingRevoked) deleteMetaPixelCookies();
      if (analyticsRevoked || marketingRevoked) {
        window.location.reload();
        return;
      }

      setPreferences(nextPreferences);
      setDraft(nextPreferences);
      setSettingsOpen(false);
    },
    [preferences],
  );

  /*
   * Nothing to consent to when no measurement id is configured: asking for
   * permission to run trackers that do not exist would be misleading.
   */
  if (!isAnalyticsConfigured && !isMarketingConfigured) return null;
  if (!hydrated || (!settingsOpen && preferences !== null)) return null;

  return (
    <aside
      aria-labelledby="tracking-consent-title"
      data-testid="tracking-consent"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-4xl rounded-lg border border-white/15 bg-ink p-5 text-ink-foreground shadow-md sm:p-6"
    >
      <div>
        <h2 id="tracking-consent-title" className="font-extrabold">
          Nastavení soukromí
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-foreground/80">
          Volitelné měření spustíme jen podle vaší volby. Nastavení můžete
          kdykoliv změnit v patičce. Podrobnosti najdete v{" "}
          <Link
            href="/ochrana-soukromi"
            className="font-bold text-gold underline underline-offset-4 hover:text-ink-foreground"
          >
            ochraně soukromí
          </Link>
          .
        </p>
      </div>

      <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Volitelné kategorie měření</legend>
        {isAnalyticsConfigured && (
          <label className="flex min-h-20 cursor-pointer gap-3 rounded-md border border-white/20 p-4">
            <input
              type="checkbox"
              checked={draft.analytics}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  analytics: event.target.checked,
                }))
              }
              className="mt-1 size-5 shrink-0 accent-[var(--color-gold)]"
            />
            <span>
              <span className="block font-extrabold">Analytika</span>
              <span className="mt-1 block text-xs leading-5 text-ink-foreground/75">
                Google Analytics nám pomáhá chápat návštěvnost a používání webu.
              </span>
            </span>
          </label>
        )}
        {isMarketingConfigured && (
          <label className="flex min-h-20 cursor-pointer gap-3 rounded-md border border-white/20 p-4">
            <input
              type="checkbox"
              checked={draft.marketing}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  marketing: event.target.checked,
                }))
              }
              className="mt-1 size-5 shrink-0 accent-[var(--color-gold)]"
            />
            <span>
              <span className="block font-extrabold">Marketing</span>
              <span className="mt-1 block text-xs leading-5 text-ink-foreground/75">
                Meta Pixel měří výkon reklam na Facebooku a Instagramu.
              </span>
            </span>
          </label>
        )}
      </fieldset>

      <div className="mt-5 grid gap-2 min-[560px]:grid-cols-3">
        <Button
          type="button"
          variant="outline"
          className="border-white/30 text-ink-foreground hover:border-white/50 hover:bg-white/10 hover:text-ink-foreground"
          onClick={() => savePreferences(EMPTY_PREFERENCES)}
        >
          Pouze nezbytné
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-white/30 text-ink-foreground hover:border-white/50 hover:bg-white/10 hover:text-ink-foreground"
          onClick={() => savePreferences(draft)}
        >
          Uložit volbu
        </Button>
        <Button
          type="button"
          className="bg-gold text-gold-foreground hover:bg-gold/90"
          onClick={() => savePreferences({ analytics: true, marketing: true })}
        >
          Povolit vše
        </Button>
      </div>
    </aside>
  );
}
