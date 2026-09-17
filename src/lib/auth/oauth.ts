import { publicEnv } from "@/lib/public-env";

/**
 * Shared OAuth wiring for the login page and `/auth/signin`.
 *
 * The PKCE verifier is a cookie on the host that STARTED the flow, and the
 * provider hands the code back to whatever host Supabase has allow-listed. When
 * those two differ the verifier never comes back and the exchange fails, which
 * looks to the visitor exactly like "the provider button did nothing". The site
 * still answers on more than one host (the pre-rebrand domain, and the apex of
 * each), so the flow is pinned to one origin instead of `window.location`.
 */
export const OAUTH_PROVIDERS = [
  { id: "google", label: "Pokračovat přes Google" },
  { id: "apple", label: "Pokračovat přes Apple" },
  { id: "azure", label: "Pokračovat přes Microsoft" },
] as const;

export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number]["id"];

const enabled = new Set(
  (publicEnv.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean),
);

/** Providers switched on for this deployment, in the order shown on the page. */
export const CONFIGURED_OAUTH_PROVIDERS = OAUTH_PROVIDERS.filter((provider) =>
  enabled.has(provider.id),
);

/** Narrow an untrusted query value to a provider this deployment offers. */
export function parseOAuthProvider(
  value: string | null | undefined,
  providers: readonly { id: OAuthProviderId }[] = CONFIGURED_OAUTH_PROVIDERS,
): OAuthProviderId | null {
  const candidate = value?.trim().toLowerCase();
  return providers.find((provider) => provider.id === candidate)?.id ?? null;
}

/**
 * The host the browser actually addressed, which is the host that owns the
 * cookies. `nextUrl.origin` is not a substitute: behind a proxy it reflects the
 * internal request, so comparing it against the canonical origin can disagree
 * with what the browser sees and send the visitor round a redirect loop.
 */
export function requestHost(headers: Headers): string | null {
  const value =
    headers.get("x-forwarded-host") ?? headers.get("host") ?? undefined;
  return value?.split(",")[0]?.trim().toLowerCase() || null;
}

/**
 * The origin an OAuth flow has to move to before it starts, or null to run it
 * where it is.
 *
 * Returning null whenever the hosts already agree (or cannot be compared) is
 * what keeps this from looping: after one redirect the browser sends the
 * canonical `Host`, which matches and stops.
 *
 * Preview deployments are deliberately exempt: their canonical origin points at
 * production, and sending a preview login there would both leave the preview
 * signed out and hand the visitor a production session.
 */
export function canonicalOAuthOrigin(
  host: string | null,
  canonicalOrigin: string,
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
): string | null {
  if (vercelEnv === "preview" || !host) return null;
  let canonicalHost: string;
  try {
    canonicalHost = new URL(canonicalOrigin).host.toLowerCase();
  } catch {
    return null;
  }
  // Normalised on both sides: a case difference must never read as a different
  // host, or the redirect below would repeat for ever.
  if (!canonicalHost || host.toLowerCase() === canonicalHost) return null;
  return canonicalOrigin;
}

/**
 * Supabase Auth's cookie namespace, `sb-<project-ref>-auth-token`, derived the
 * same way supabase-js derives it from the project URL.
 */
export function authStorageKey(
  supabaseUrl: string | undefined = publicEnv.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!supabaseUrl) return null;
  try {
    return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

/** Cookie holding the PKCE verifier while the visitor is at the provider. */
export function codeVerifierCookie(supabaseUrl?: string): string | null {
  const key = authStorageKey(supabaseUrl);
  return key && `${key}-code-verifier`;
}
