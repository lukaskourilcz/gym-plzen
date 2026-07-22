import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/helpers/crypto";
import { logger } from "@/lib/helpers/logger";
import { entryLog as entryLogService } from "@/lib/services";

/**
 * Nuki Web API webhook. Nuki calls this when lock activity happens. We
 * authenticate via a shared secret passed as a query param / header (Nuki's
 * webhook config), then trigger an entry-log sync so the "kniha vstupů" stays
 * current without polling.
 */
export async function POST(request: NextRequest) {
  const provided =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("x-nuki-secret") ??
    "";

  if (
    !env.NUKI_WEBHOOK_SECRET ||
    !safeEqual(provided, env.NUKI_WEBHOOK_SECRET)
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // The payload describes a single event; the simplest robust approach is to
    // pull the latest log entries and upsert (idempotent by nukiLogId).
    await entryLogService.syncEntryLog(20);
  } catch (e) {
    logger.error(e, { where: "nuki.webhook" });
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
