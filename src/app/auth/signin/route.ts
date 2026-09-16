import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/helpers/logger";
import {
  canonicalOAuthOrigin,
  parseOAuthProvider,
  requestHost,
} from "@/lib/auth/oauth";
import { safeInternalPath } from "@/lib/security/redirects";
import { siteOrigin } from "@/lib/helpers/site-url";

/**
 * Starts an OAuth sign-in. The browser used to call `signInWithOAuth` itself,
 * which wrote the PKCE verifier through `document.cookie` on whatever host the
 * visitor happened to be on. Doing it here instead gives the flow two things it
 * needs: the verifier is written on the one origin the callback will come back
 * to, and it arrives as a real `Set-Cookie` rather than a script-written one,
 * which Safari's tracking prevention treats far more leniently.
 */
function backToLogin(request: NextRequest, next: string) {
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("chyba", "selhalo");
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeInternalPath(searchParams.get("next"));
  const provider = parseOAuthProvider(searchParams.get("provider"));

  if (!provider) return backToLogin(request, next);

  // Move to the canonical origin BEFORE anything writes the verifier cookie.
  const canonical = canonicalOAuthOrigin(
    requestHost(request.headers),
    siteOrigin(),
  );
  if (canonical) {
    const url = new URL("/auth/signin", canonical);
    url.searchParams.set("provider", provider);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  if (!supabase) return backToLogin(request, next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      // Server-side there is no browser to redirect; we forward `data.url`.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    logger.warn("OAuth sign-in could not be started", {
      provider,
      message: error?.message,
    });
    return backToLogin(request, next);
  }

  return NextResponse.redirect(data.url);
}
