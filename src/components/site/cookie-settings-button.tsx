"use client";

import {
  isAnalyticsConfigured,
  isMarketingConfigured,
  OPEN_COOKIE_SETTINGS_EVENT,
} from "@/lib/config/analytics";

export function CookieSettingsButton({ className }: { className?: string }) {
  // With no tracker configured there is no consent to reopen.
  if (!isAnalyticsConfigured && !isMarketingConfigured) return null;

  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
      }
    >
      Nastavení cookies
    </button>
  );
}
