import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/helpers/cron";
import { logger } from "@/lib/helpers/logger";
import { pipeline, fulfillment } from "@/lib/services";

/**
 * Reliability watchdog. Runs on a schedule (Vercel Cron — see NEEDED.md), picks
 * up pipeline steps that are due for retry, and re-runs fulfillment for their
 * reservations. Exhausted steps have already raised an alert in the pipeline
 * service, so this route just drives the retries.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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

  return NextResponse.json({ ok: true, dueSteps: due.length, processed });
}
