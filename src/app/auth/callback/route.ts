import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/helpers/logger";
import { safeInternalPath } from "@/lib/security/redirects";

/**
 * OAuth / email-confirmation callback. Supabase redirects here with a `code`;
 * we exchange it for a session (sets the auth cookies) and continue to `next`.
 *
 * Every failure path has to end on the login page with a reason. Silently
 * redirecting to `next` sends the visitor onwards still signed out, which is
 * indistinguishable from "the button did nothing" : the shape of the Safari
 * report from the client. The most common cause of a failed exchange is the
 * PKCE verifier cookie not coming back with the request, which happens when the
 * callback lands on a different host than the one that started the flow
 * (`www` versus apex, or a Supabase Site URL pointing elsewhere).
 */
function loginRedirect(request: NextRequest, reason: LoginErrorReason) {
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("chyba", reason);
  const next = request.nextUrl.searchParams.get("next");
  if (next) url.searchParams.set("next", safeInternalPath(next));
  return NextResponse.redirect(url);
}

export type LoginErrorReason = "odmitnuto" | "vyprselo" | "selhalo";

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

  const supabase = await createClient();
  if (!supabase) return loginRedirect(request, "selhalo");

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    logger.warn("OAuth code exchange failed", {
      message: error.message,
      status: error.status,
    });
    return loginRedirect(request, "vyprselo");
  }

  return NextResponse.redirect(new URL(next, origin));
}
