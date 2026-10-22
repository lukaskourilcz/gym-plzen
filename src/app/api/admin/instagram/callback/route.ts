import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth/guards";
import { INSTAGRAM_COOKIE } from "@/lib/config/instagram";
import { InstagramError } from "@/lib/integrations/instagram";
import { verifyInstagramState } from "@/lib/helpers/instagram-vault";
import {
  instagramAdminReturn,
  instagramRedirectUri,
} from "@/lib/helpers/instagram-oauth";
import { connectInstagram, syncInstagram } from "@/lib/services/instagram";
import { invalidateInstagram } from "@/lib/services/instagram-cache";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user) || user.isDemo)
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  let result = "connected";
  let connected = false;
  try {
    if (
      !verifyInstagramState(
        request.cookies.get(INSTAGRAM_COOKIE)?.value,
        request.nextUrl.searchParams.get("state"),
        user.id,
      )
    )
      throw new InstagramError("invalid_state");
    if (request.nextUrl.searchParams.has("error"))
      throw new InstagramError("denied");
    const code = request.nextUrl.searchParams.get("code");
    if (!code || code.length > 8192) throw new InstagramError("invalid_state");
    await connectInstagram(code, instagramRedirectUri(request.url), user.id);
    connected = true;
    const sync = await syncInstagram({ force: true });
    if (sync.problem) result = sync.problem;
  } catch (error) {
    result = error instanceof InstagramError ? error.problem : "provider";
  }
  if (connected) invalidateInstagram();
  const response = NextResponse.redirect(
    instagramAdminReturn(request.url, result),
  );
  response.cookies.set(INSTAGRAM_COOKIE, "", {
    path: "/api/admin/instagram",
    maxAge: 0,
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
