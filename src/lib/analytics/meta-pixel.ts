import {
  CONSENT_STORAGE_KEY,
  META_PIXEL_ID,
  parseConsentPreferences,
} from "@/lib/config/analytics";

type MetaPixelFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push?: MetaPixelFunction;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
  }
}

const META_SCRIPT_ID = "namaste-meta-pixel";
const META_EVENT_SESSION_PREFIX = "namaste:meta-event:";
let pixelStarted = false;
let lastPageView: string | null = null;

function marketingAllowed() {
  try {
    return (
      parseConsentPreferences(window.localStorage.getItem(CONSENT_STORAGE_KEY))
        ?.marketing === true
    );
  } catch {
    return false;
  }
}

function ensureFbq(): MetaPixelFunction {
  if (window.fbq) return window.fbq;

  const fbq = Object.assign(
    function metaPixelQueue(...args: unknown[]) {
      if (window.fbq?.callMethod) window.fbq.callMethod(...args);
      else window.fbq?.queue.push(args);
    },
    { queue: [] as unknown[][], loaded: true, version: "2.0" },
  ) as MetaPixelFunction;
  fbq.push = fbq;
  window.fbq = fbq;
  window._fbq = fbq;
  return fbq;
}

/** Start the browser pixel only after explicit marketing consent. */
export function startMetaPixel(pathname: string) {
  // No pixel ID configured: nothing to start.
  if (!META_PIXEL_ID) return;
  if (!marketingAllowed()) return;
  const fbq = ensureFbq();

  if (!pixelStarted && !document.getElementById(META_SCRIPT_ID)) {
    fbq("init", META_PIXEL_ID);
    const script = document.createElement("script");
    script.id = META_SCRIPT_ID;
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.append(script);
    pixelStarted = true;
  } else if (document.getElementById(META_SCRIPT_ID)) {
    pixelStarted = true;
  }

  if (lastPageView !== pathname) {
    fbq("track", "PageView");
    lastPageView = pathname;
  }
}

/**
 * Queue a standard event without PII. A stable event ID prevents duplicate
 * browser events and is ready for future Pixel + Conversions API deduplication.
 */
export function trackMetaEvent(
  eventName: "InitiateCheckout" | "Purchase" | "Schedule",
  parameters: Record<string, string | number>,
  eventId: string,
) {
  if (!marketingAllowed()) return;
  try {
    if (window.sessionStorage.getItem(`${META_EVENT_SESSION_PREFIX}${eventId}`))
      return;
  } catch {
    // Continue: Meta can still dedupe a repeated event by eventID.
  }

  startMetaPixel(window.location.pathname);
  window.fbq?.("track", eventName, parameters, { eventID: eventId });
  try {
    window.sessionStorage.setItem(
      `${META_EVENT_SESSION_PREFIX}${eventId}`,
      "sent",
    );
  } catch {
    // Storage-restricted browsers still send the current event once.
  }
}

export function deleteMetaPixelCookies() {
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
    if (name !== "_fbp" && name !== "_fbc") continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${
        domain ? `; Domain=${domain}` : ""
      }`;
    }
  }
}
