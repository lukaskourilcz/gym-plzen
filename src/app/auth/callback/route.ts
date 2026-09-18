import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/helpers/logger";
import {
  canonicalOAuthOrigin,
  codeVerifierCookie,
  requestHost,
} from "@/lib/auth/oauth";
import { safeInternalPath } from "@/lib/security/redirects";
import { siteOrigin } from "@/lib/helpers/site-url";
import { members } from "@/lib/services";

/**
 * OAuth / email-confirmation callback. Supabase redirects here with a `code`;
 * we exchange it for a session (sets the auth cookies) and continue to `next`.
 *
 * Every failure path has to end on the login page with a reason. Silently
 * redirecting to `next` sends the visitor onwards still signed out, which is
 * indistinguishable from "the button did nothing" : the shape of the Safari
 * report from the client. The exchange needs the PKCE verifier cookie, and a
 * cookie belongs to one host, so a flow that starts on one of the site's other
 * hostnames (the pre-rebrand domain, or an apex) and is handed back here can
 * never complete. `/auth/signin` pins the start to the canonical origin; this
 * route forwards a stray callback there rather than failing on the spot.
 */
export type LoginErrorReason =
  "odmitnuto" | "vyprselo" | "selhalo" | "jiny_prohlizec";

function loginRedirect(request: NextRequest, reason: LoginErrorReason) {
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("chyba", reason);
  const next = request.nextUrl.searchParams.get("next");
  if (next) url.searchParams.set("next", safeInternalPath(next));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeInternalPath(searchParams.get("next"));

  // The provider itself refused or the visitor cancelled on its screen.
  const providerError = searchParams.get("error");
  if (providerError) {
    logger.warn("OAuth callback returned a provider error", {
      error: providerError,
      description: searchParams.get("error_description") ?? undefined,
    });
    return loginRedirect(
      request,
      providerError === "access_denied" ? "odmitnuto" : "selhalo",
    );
  }

  const code = searchParams.get("code");
  if (!code) return loginRedirect(request, "vyprselo");

  // A callback on a non-canonical host can still be rescued: the verifier lives
  // on the canonical one, so hand the code over instead of failing here. Only
  // when this host has no verifier of its own, so a flow that legitimately ran
  // end to end on another host is left alone.
  const verifierCookie = codeVerifierCookie();
  const hasVerifier = verifierCookie
    ? Boolean(request.cookies.get(verifierCookie))
    : false;
  const canonical = canonicalOAuthOrigin(
    requestHost(request.headers),
    siteOrigin(),
  );
  if (!hasVerifier && canonical) {
    const url = new URL("/auth/callback", canonical);
    url.searchParams.set("code", code);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  if (!supabase) return loginRedirect(request, "selhalo");

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    logger.warn("OAuth code exchange failed", {
      message: error?.message,
      status: error?.status,
      // The usual cause, and the one the visitor can act on themselves.
      verifierPresent: hasVerifier,
    });
    return loginRedirect(request, hasVerifier ? "vyprselo" : "jiny_prohlizec");
  }

  // A Google sign-in creates the account on its first pass through here, and
  // looks exactly like every later one. The account's age is what tells them
  // apart; the record itself is written once per member either way.
  if (data.user && isFreshAccount(data.user.created_at))
    await members.recordRegistration({
      userId: data.user.id,
      email: data.user.email,
      name:
        typeof data.user.user_metadata?.full_name === "string"
          ? data.user.user_metadata.full_name
          : null,
    });

  return NextResponse.redirect(new URL(next, origin));
}

/** Created in the last few minutes, i.e. by the sign-in that just happened. */
const FRESH_ACCOUNT_MS = 10 * 60 * 1000;

function isFreshAccount(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && Date.now() - created < FRESH_ACCOUNT_MS;
}
