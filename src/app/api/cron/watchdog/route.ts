import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { isAuthorizedCron } from "@/lib/helpers/cron";
import { logger } from "@/lib/helpers/logger";
import { pipeline, fulfillment, reservations } from "@/lib/services";

/**
 * Reliability watchdog. Runs on a schedule (Vercel Cron : see NEEDED.md), picks
 * up pipeline steps that are due for retry, and re-runs fulfillment for their
 * reservations. Exhausted steps have already raised an alert in the pipeline
 * service, so this route just drives the retries.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const released = await reservations.releaseExpiredPendingReservations();
  const due = await pipeline.dueForRetry(50);
  const reservationIds = [...new Set(due.map((d) => d.reservationId))];

  let processed = 0;
  for (const id of reservationIds) {
    try {
      await fulfillment.fulfillReservation(id);
      processed++;
    } catch (e) {
      logger.error(e, { where: "cron.watchdog", reservationId: id });
    }
  }

  // Await the heartbeat so a serverless runtime cannot freeze the request
  // before the network call leaves the process. A short timeout keeps provider
  // downtime from holding the watchdog open.
  if (env.UPTIMEROBOT_HEARTBEAT_URL) {
    try {
      await fetch(env.UPTIMEROBOT_HEARTBEAT_URL, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
      });
    } catch (e) {
      logger.warn("uptimerobot heartbeat failed", {
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    releasedPendingReservations: released,
    dueSteps: due.length,
    processed,
  });
}
