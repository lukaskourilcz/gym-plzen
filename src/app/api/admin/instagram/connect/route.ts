import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth/guards";
import { INSTAGRAM_COOKIE } from "@/lib/config/instagram";
import {
  instagramAuthorizationUrl,
  instagramConfigured,
} from "@/lib/integrations/instagram";
import { createInstagramState } from "@/lib/helpers/instagram-vault";
import {
  instagramAdminReturn,
  instagramRedirectUri,
} from "@/lib/helpers/instagram-oauth";
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user) || user.isDemo)
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  if (!instagramConfigured())
    return NextResponse.redirect(
      instagramAdminReturn(request.url, "not_configured"),
    );
  const { nonce, cookie } = createInstagramState(user.id);
  const response = NextResponse.redirect(
    instagramAuthorizationUrl(instagramRedirectUri(request.url), nonce),
  );
  response.cookies.set(INSTAGRAM_COOKIE, cookie, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/admin/instagram",
    maxAge: 600,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
