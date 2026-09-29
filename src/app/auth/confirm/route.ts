import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/helpers/logger";
import { members } from "@/lib/services";
import { safeInternalPath } from "@/lib/security/redirects";
import {
  createRecoveryProof,
  RECOVERY_PROOF_COOKIE,
  recoveryProofCookieOptions,
} from "@/lib/auth/recovery-proof";

/**
 * E-mail confirmation and password-recovery links.
 *
 * Supabase's default `{{ .ConfirmationURL }}` runs the PKCE exchange, which
 * needs the verifier cookie of the browser that started the sign-up. A link
 * opened anywhere else (the Gmail app's own browser on a phone, a laptop after
 * registering on the phone) confirms the address on Supabase's side and then
 * ends on the login page with "otevřete přímo www.navigym.cz". The templates
 * therefore point here with a token hash instead: `verifyOtp` proves the
 * token on the server and starts the session in whichever browser opened it.
 */
const TYPES: readonly EmailOtpType[] = [
  "signup",
  "email",
  "recovery",
  "magiclink",
  "invite",
  "email_change",
];

function loginRedirect(request: NextRequest, reason: string, next: string) {
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("chyba", reason);
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

/**
 * Where to continue. The template carries Supabase's `{{ .RedirectTo }}`, which
 * is our own callback URL with the destination the sign-up asked for; a plain
 * `next` is accepted too.
 */
function destination(searchParams: URLSearchParams, type: EmailOtpType) {
  const redirectTo = searchParams.get("redirect_to");
  if (redirectTo) {
    try {
      const inner = new URL(redirectTo).searchParams.get("next");
      if (inner) return safeInternalPath(inner);
    } catch {
      // Not a URL: fall through to the plain parameter and the defaults.
    }
  }
  const next = searchParams.get("next");
  if (next) return safeInternalPath(next);
  return type === "recovery" ? "/reset-password" : "/account";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const requested = searchParams.get("type");
  const type = TYPES.find((candidate) => candidate === requested) ?? null;
  const next = destination(searchParams, type ?? "email");

  if (!tokenHash || !type) return loginRedirect(request, "vyprselo", next);

  const supabase = await createClient();
  if (!supabase) return loginRedirect(request, "selhalo", next);

  const { data, error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });
  if (error) {
    logger.warn("E-mail link could not be verified", {
      type,
      message: error.message,
      status: error.status,
    });
    return loginRedirect(request, "vyprselo", next);
  }

  // Confirming the address is what finishes a registration, so this is where
  // a new member becomes one. Recovery and an address change are not new
  // members, and the record is written once per member however often the link
  // is opened.
  if (data.user && (type === "signup" || type === "email" || type === "invite"))
    await members.recordRegistration({
      userId: data.user.id,
      email: data.user.email,
      name:
        typeof data.user.user_metadata?.full_name === "string"
          ? data.user.user_metadata.full_name
          : null,
    });

  const response = NextResponse.redirect(new URL(next, origin));
  if (type === "recovery" && data.user && data.session) {
    const proof = createRecoveryProof(data.user.id);
    if (proof)
      response.cookies.set(
        RECOVERY_PROOF_COOKIE,
        proof,
        recoveryProofCookieOptions(request.nextUrl.protocol === "https:"),
      );
  }
  return response;
}
