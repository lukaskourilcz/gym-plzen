import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Keeps the Supabase Auth session cookie fresh across the app. */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals, static assets and the machine-to-
     * machine routes. Provider webhooks and cron jobs authenticate with their
     * own secrets and carry no browser session; refreshing one there only adds
     * a Supabase Auth round trip and makes a payment notification depend on it.
     * The public availability API reads no session either, and a stalled Auth
     * round trip there hung the homepage calendar (28. 9. 2026). The remaining
     * /api routes (calendar file, invoice download) do read the visitor's
     * session and stay covered.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|api/availability|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
