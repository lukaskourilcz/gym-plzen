import { logger } from "@/lib/helpers/logger";

/** Keep already-due PIN work ahead of potentially slow provider status reads. */
export async function runPriorityWatchdogStages(work: {
  dueForRetry: () => Promise<{ reservationId: string }[]>;
  fulfillReservation: (id: string) => Promise<unknown>;
  reconcilePendingPayments: () => Promise<number>;
  releaseExpiredPendingReservations: () => Promise<number>;
}) {
  // A failed due-step query must fail the watchdog heartbeat, not disguise a
  // missed PIN as a successful cycle.
  const due = await work.dueForRetry();
  const ids = [...new Set(due.map((step) => step.reservationId))];
  let processed = 0;
  for (const id of ids) {
    try {
      await work.fulfillReservation(id);
      processed++;
    } catch (error) {
      logger.error(error, { where: "cron.watchdog", reservationId: id });
    }
  }
  let reconciledPayments = 0;
  try {
    reconciledPayments = await work.reconcilePendingPayments();
  } catch (error) {
    logger.warn("Watchdog stage deferred: reconcilePendingPayments", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
  let releasedPendingReservations = 0;
  try {
    releasedPendingReservations =
      await work.releaseExpiredPendingReservations();
  } catch (error) {
    logger.warn("Watchdog stage deferred: releaseExpiredPendingReservations", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
  return {
    dueSteps: due.length,
    processed,
    reconciledPayments,
    releasedPendingReservations,
  };
}
