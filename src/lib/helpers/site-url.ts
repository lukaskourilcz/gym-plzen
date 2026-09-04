import { publicEnv } from "@/lib/public-env";

/**
 * Absolute links to this site.
 *
 * Every customer-facing absolute URL : e-mail buttons, the logo in the mail
 * template, the calendar event identity : derives from `NEXT_PUBLIC_APP_URL`.
 * Moving the site to another domain is then a Vercel environment change plus a
 * redeploy, not a search through the source.
 */

/** The configured origin without a trailing slash. */
export function siteOrigin(): string {
  return publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

/** An absolute URL for a site-relative path (`/login` → `https://…/login`). */
export function siteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Bare hostname, `www.` stripped. Used where a domain identifies the site
 * rather than addresses it, such as the calendar event UID.
 */
export function siteHost(): string {
  try {
    return new URL(siteOrigin()).hostname.replace(/^www\./, "");
  } catch {
    // A malformed env value must not break a booking confirmation.
    return "localhost";
  }
}
