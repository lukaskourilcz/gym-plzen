import { reconcileReservationWhatsApp } from "@/lib/services/whatsapp-delivery";
import { retryCancellationEmails } from "@/lib/services/cancellation-delivery";
import { monitorLockConnectivity } from "@/lib/services/lock-health";
import {
  expireEndedCodes,
  reconcileRevocations,
} from "@/lib/services/access-codes";
import { reconcilePendingPayments } from "@/lib/services/payments";
import { deliverPendingAlerts } from "@/lib/services/alerts";
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
export const maxDuration = 300;

/** Runs one watchdog stage; a failing stage never stops the ones after it. */
async function stage<T>(
  name: string,
  work: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await work();
  } catch (e) {
    logger.warn(`Watchdog stage deferred: ${name}`, {
      error: e instanceof Error ? e.message : "unknown",
    });
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const reconciledPayments = await stage(
    "reconcilePendingPayments",
    () => reconcilePendingPayments(),
    0,
  );
  const released = await stage(
    "releaseExpiredPendingReservations",
    () => reservations.releaseExpiredPendingReservations(),
    0,
  );

  // PIN creation and delivery come first: a slow Nuki API or a busy lock in
  // revocation or cleanup below must never starve another customer's PIN.
  // This read is the watchdog's core: if it fails, the request fails and the
  // missing heartbeat below raises the alarm.
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

  const revocations = await stage(
    "reconcileRevocations",
    () => reconcileRevocations(),
    0,
  );
  const expiredCodes = await stage(
    "expireEndedCodes",
    () => expireEndedCodes(),
    0,
  );
  const closedPipelines = await stage(
    "closeFinishedPipelines",
    () => pipeline.closeFinishedPipelines(),
    0,
  );
  await stage("monitorLockConnectivity", () => monitorLockConnectivity(), null);
  await stage("retryCancellationEmails", () => retryCancellationEmails(), null);
  await stage(
    "reconcileReservationWhatsApp",
    () => reconcileReservationWhatsApp(),
    null,
  );
  // Alerts written inside a transaction (a late payment) reach the operator
  // here if the request that wrote them died before sending.
  await stage("deliverPendingAlerts", () => deliverPendingAlerts(), 0);

  // Fire-and-forget heartbeat to UptimeRobot. Never blocks the watchdog or
  // fails the request; if the cron itself throws before reaching this line,
  // UptimeRobot's grace period expires and the alert fires — that's the point.
  if (env.UPTIMEROBOT_HEARTBEAT_URL) {
    fetch(env.UPTIMEROBOT_HEARTBEAT_URL, {
      method: "GET",
      cache: "no-store",
    }).catch((e) =>
      logger.warn("uptimerobot heartbeat failed", {
        error: e instanceof Error ? e.message : "unknown",
      }),
    );
  }

  return NextResponse.json({
    ok: true,
    revocations,
    expiredCodes,
    closedPipelines,
    reconciledPayments,
    releasedPendingReservations: released,
    dueSteps: due.length,
    processed,
  });
}
