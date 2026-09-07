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

  const deadline = Date.now() + 240_000;
  const released = await reservations.releaseExpiredPendingReservations();
  for (const id of await reservations.cancellationsAwaitingRevocation()) {
    if (Date.now() >= deadline) break;
    try {
      await reservations.cancelReservation({ id });
    } catch (error) {
      logger.error(error, { where: "cron.revoke", reservationId: id });
    }
  }
  const due = await pipeline.dueForRetry(15);
  const reservationIds = [...new Set(due.map((d) => d.reservationId))];

  let processed = 0;
  for (const id of reservationIds) {
    if (Date.now() >= deadline) break;
    try {
      await fulfillment.fulfillReservation(id);
      processed++;
    } catch (e) {
      logger.error(e, { where: "cron.watchdog", reservationId: id });
    }
  }

  // Await the bounded heartbeat so serverless shutdown cannot discard it. It never
  // fails the request; if the cron itself throws before reaching this line,
  // UptimeRobot's grace period expires and the alert fires — that's the point.
  if (env.UPTIMEROBOT_HEARTBEAT_URL) {
    await fetch(env.UPTIMEROBOT_HEARTBEAT_URL, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    }).catch((e) =>
      logger.warn("uptimerobot heartbeat failed", {
        error: e instanceof Error ? e.message : "unknown",
      }),
    );
  }

  return NextResponse.json({
    ok: true,
    releasedPendingReservations: released,
    dueSteps: due.length,
    processed,
  });
}

export const maxDuration = 300;
