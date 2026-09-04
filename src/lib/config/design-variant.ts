/**
 * Design variant ("Klasický" / "Moderní") : a temporary preview mechanism so
 * the operator can compare the approved classic look against the modern one.
 *
 * The switch itself lives on `/dev` and nowhere else, so a visitor never meets
 * it. What the choice sets is this cookie, applied as `data-design` on `<html>`
 * by a tiny inline script that runs before first paint : that is what carries
 * the chosen look across the rest of the site.
 *
 * Public pages must NOT read the cookie on the server: the homepage is ISR
 * (`revalidate = 60`) and a server read would turn it dynamic. Rendered HTML
 * therefore stays variant-neutral and every visual difference is in CSS.
 *
 * Client-safe: no server-only imports here.
 */

export const DESIGN_VARIANTS = ["classic", "modern"] as const;

export type DesignVariant = (typeof DESIGN_VARIANTS)[number];

/** Applies when no cookie is set: the look the client already approved. */
export const DEFAULT_DESIGN_VARIANT: DesignVariant = "classic";

export const DESIGN_VARIANT_COOKIE = "ns_design";

/** One year, so a chosen preview survives between operator sessions. */
export const DESIGN_VARIANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const DESIGN_VARIANT_LABELS: Record<DesignVariant, string> = {
  classic: "Klasický",
  modern: "Moderní",
};

/** Narrow any untrusted value to a known variant, falling back to the default. */
export function parseDesignVariant(value: string | null | undefined) {
  return DESIGN_VARIANTS.includes(value as DesignVariant)
    ? (value as DesignVariant)
    : DEFAULT_DESIGN_VARIANT;
}

/**
 * Read the variant out of a raw `document.cookie` / `Cookie:` header string.
 * Kept pure so both the browser and the unit tests can use it.
 */
export function readDesignVariantFromCookies(cookieHeader: string | null) {
  if (!cookieHeader) return DEFAULT_DESIGN_VARIANT;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === DESIGN_VARIANT_COOKIE) {
      return parseDesignVariant(rest.join("="));
    }
  }
  return DEFAULT_DESIGN_VARIANT;
}

/** Serialised cookie for `document.cookie`, `Secure` only where it is allowed. */
export function serialiseDesignVariantCookie(
  variant: DesignVariant,
  secure: boolean,
) {
  return [
    `${DESIGN_VARIANT_COOKIE}=${variant}`,
    "path=/",
    `max-age=${DESIGN_VARIANT_COOKIE_MAX_AGE}`,
    "samesite=lax",
    ...(secure ? ["secure"] : []),
  ].join("; ");
}

/**
 * Inline script source, injected in `<head>` so `data-design` is on `<html>`
 * before the first paint and the chosen look never flashes.
 *
 * Any failure falls back to the classic look, which is exactly what a visitor
 * should get.
 */
export const DESIGN_VARIANT_INIT_SCRIPT = `(function(){var d=document.documentElement;try{var m=document.cookie.match(/(?:^|;\\s*)${DESIGN_VARIANT_COOKIE}=(classic|modern)/);d.dataset.design=m?m[1]:"${DEFAULT_DESIGN_VARIANT}"}catch(e){d.dataset.design="${DEFAULT_DESIGN_VARIANT}"}})()`;
