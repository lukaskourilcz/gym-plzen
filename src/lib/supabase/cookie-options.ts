import { publicEnv } from "@/lib/public-env";

/*
 * Attributes of the Supabase Auth session cookie, shared by every server-side
 * client that may write it (Server Components, route handlers and the
 * middleware that refreshes the session). If only one of them set these, a
 * token refresh in the middleware would rewrite the cookie without Secure.
 *
 * `@supabase/ssr` defaults to SameSite=Lax without Secure. Lax is required:
 * the OAuth callback is a cross-site top-level navigation and a Strict cookie
 * would not be sent with it. Secure is added because Safari's tracking
 * prevention is markedly stricter with cookies that are not, and the site is
 * HTTPS-only (HSTS) in every deployed environment. `httpOnly` stays off on
 * purpose: the browser client reads the session cookie.
 */
export const SUPABASE_COOKIE_OPTIONS = {
  sameSite: "lax",
  secure: publicEnv.NEXT_PUBLIC_APP_URL.startsWith("https://"),
} as const;
