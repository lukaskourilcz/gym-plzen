"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  GOOGLE_ANALYTICS_ID,
  OPEN_COOKIE_SETTINGS_EVENT,
  type AnalyticsConsent,
  isAnalyticsConsent,
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
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  return window.gtag;
}

function consentState(analyticsStorage: AnalyticsConsent) {
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
  const gtag = ensureGtag();

  if (analyticsStarted || document.getElementById(GOOGLE_TAG_SCRIPT_ID)) {
    analyticsStarted = true;
    gtag("consent", "update", consentState("granted"));
    return;
  }

  gtag("consent", "default", consentState("denied"));
  gtag("set", "ads_data_redaction", true);
  gtag("consent", "update", consentState("granted"));
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
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    } catch {
      // Privacy-restricted browsers may block storage; ask again next visit.
    }
    if (isAnalyticsConsent(saved)) setConsent(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (consent === "granted") startGoogleAnalytics();
  }, [consent]);

  useEffect(() => {
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
    return () =>
      window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings);
  }, []);

  const saveConsent = useCallback(
    (nextConsent: AnalyticsConsent) => {
      try {
        window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, nextConsent);
      } catch {
        // The in-memory choice still applies for the current page.
      }

      if (nextConsent === "denied" && consent === "granted") {
        window.gtag?.("consent", "update", consentState("denied"));
        deleteGoogleAnalyticsCookies();
        window.location.reload();
        return;
      }

      setConsent(nextConsent);
      setSettingsOpen(false);
    },
    [consent],
  );

  if (!hydrated || (!settingsOpen && consent !== null)) return null;

  return (
    <aside
      aria-labelledby="analytics-consent-title"
      data-testid="analytics-consent"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-3xl rounded-lg border border-white/15 bg-ink p-5 text-ink-foreground shadow-md sm:p-6"
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <h2 id="analytics-consent-title" className="font-extrabold">
            Pomozte nám zlepšovat web
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-foreground/80">
            Volitelné Google Analytics spustíme pouze s vaším souhlasem.
            Reklamní cookies ani personalizovanou reklamu nepoužíváme. Více v{" "}
            <Link
              href="/ochrana-soukromi"
              className="font-bold text-gold underline underline-offset-4 hover:text-ink-foreground"
            >
              ochraně soukromí
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 min-[440px]:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-white/30 text-ink-foreground hover:border-white/50 hover:bg-white/10 hover:text-ink-foreground"
            onClick={() => saveConsent("denied")}
          >
            Pouze nezbytné
          </Button>
          <Button
            type="button"
            className="bg-gold text-gold-foreground hover:bg-gold/90"
            onClick={() => saveConsent("granted")}
          >
            Povolit analytiku
          </Button>
        </div>
      </div>
    </aside>
  );
}
