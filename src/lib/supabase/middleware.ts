import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, supabasePublicKey } from "@/lib/public-env";
import { SUPABASE_COOKIE_OPTIONS } from "./cookie-options";
import { createTimeoutFetch } from "./request-timeout";

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
    global: {
      fetch: createTimeoutFetch(
        AUTH_REFRESH_TIMEOUT_MS,
        globalThis.fetch,
        true,
      ),
    },
    // The same attributes as the server client: a refresh here rewrites the
    // session cookie, and without them it would lose Secure.
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
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

  // Touch the user to trigger a token refresh when needed. The Auth round
  // trip is bounded: on 28. 9. 2026 production requests stalled here until
  // the platform killed them after 300 s. A late refresh only means the
  // Server Component refreshes the session itself; a hung page means the
  // visitor cannot book at all.
  await withTimeout(supabase.auth.getUser(), AUTH_REFRESH_TIMEOUT_MS);
  return protectSensitiveCache(request, response);
}

export const AUTH_REFRESH_TIMEOUT_MS = 4_000;

/** Resolve with the promise, or give up quietly after `ms`. Never rejects. */
export async function withTimeout(
  work: Promise<unknown>,
  ms: number,
): Promise<"done" | "timeout"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  try {
    return await Promise.race([
      work.then(
        () => "done" as const,
        () => "done" as const,
      ),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
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
