import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, supabasePublicKey } from "@/lib/public-env";

/**
 * Refreshes the Supabase Auth session on every request and forwards the updated
 * cookies, so Server Components read a fresh session. No-op (passes the request
 * through) when Supabase isn't configured.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !supabasePublicKey)
    return protectSensitiveCache(request, response);

  const supabase = createServerClient(url, supabasePublicKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touch the user to trigger a token refresh when needed.
  await supabase.auth.getUser();
  return protectSensitiveCache(request, response);
}

function protectSensitiveCache(request: NextRequest, response: NextResponse) {
  if (
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/account") ||
    request.nextUrl.pathname.startsWith("/auth") ||
    request.nextUrl.pathname.startsWith("/rezervace/hotovo")
  ) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }
  return response;
}
