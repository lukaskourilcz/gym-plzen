import { and, eq, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservationPipeline } from "@/lib/db/schema";
import type { ReservationPipeline } from "@/lib/db/types";
import { addMinutes } from "@/lib/helpers/datetime";
import { logger } from "@/lib/helpers/logger";
import { raiseAlert, resolveAlert } from "./alerts";

/**
 * Per-reservation reliability pipeline: payment → code_created → code_delivered.
 * Each step is a row that the watchdog (a cron job, see app/api/cron) advances
 * and retries. When a step exhausts retries, we raise an operational alert.
 */

const STEPS = ["payment", "code_created", "code_delivered"] as const;
export type PipelineStep = (typeof STEPS)[number];

const MAX_ATTEMPTS = 5;

/** Create the pipeline rows for a reservation (idempotent). */
export async function initPipeline(reservationId: string): Promise<void> {
  await db
    .insert(reservationPipeline)
    .values(STEPS.map((step) => ({ reservationId, step })))
    .onConflictDoNothing();
}

/** Mark a step succeeded and clear any alert for it. */
export async function markStepSucceeded(
  reservationId: string,
  step: PipelineStep,
): Promise<void> {
  await db
    .update(reservationPipeline)
    .set({ status: "succeeded", completedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(reservationPipeline.reservationId, reservationId),
        eq(reservationPipeline.step, step),
      ),
    );
  await resolveAlert(dedupeKey(reservationId, step));
}

/**
 * Record a step failure, schedule the next retry with backoff, and raise an
 * alert once attempts are exhausted.
 */
export async function markStepFailed(
  reservationId: string,
  step: PipelineStep,
  error: string,
): Promise<void> {
  const [row] = await db
    .select()
    .from(reservationPipeline)
    .where(
      and(
        eq(reservationPipeline.reservationId, reservationId),
        eq(reservationPipeline.step, step),
      ),
    )
    .limit(1);

  const attempts = (row?.attempts ?? 0) + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;

  await db
    .update(reservationPipeline)
    .set({
      status: exhausted ? "failed" : "retrying",
      attempts,
      lastError: error,
      nextRetryAt: exhausted ? null : addMinutes(new Date(), retryDelayMinutes(attempts)),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reservationPipeline.reservationId, reservationId),
        eq(reservationPipeline.step, step),
      ),
    );

  logger.warn("Pipeline step failed", { reservationId, step, attempts, error });

  if (exhausted) {
    await raiseAlert({
      severity: "critical",
      dedupeKey: dedupeKey(reservationId, step),
      title: `Rezervace ${reservationId}: krok "${step}" selhal`,
      body: `Po ${attempts} pokusech: ${error}`,
      context: { reservationId, step },
    });
  }
}

/** Steps that are due for a retry now (consumed by the watchdog cron). */
export async function dueForRetry(limit = 50): Promise<ReservationPipeline[]> {
  return db
    .select()
    .from(reservationPipeline)
    .where(
      and(
        or(
          eq(reservationPipeline.status, "retrying"),
          eq(reservationPipeline.status, "pending"),
        ),
        lte(reservationPipeline.nextRetryAt, new Date()),
      ),
    )
    .limit(limit);
}

/** Full pipeline state for one reservation (admin drill-down). */
export async function getPipeline(reservationId: string): Promise<ReservationPipeline[]> {
  return db
    .select()
    .from(reservationPipeline)
    .where(eq(reservationPipeline.reservationId, reservationId));
}

function dedupeKey(reservationId: string, step: PipelineStep): string {
  return `reservation:${reservationId}:${step}`;
}

/** Exponential-ish backoff: 1, 2, 5, 10, 20 minutes. */
function retryDelayMinutes(attempts: number): number {
  return [1, 2, 5, 10, 20][Math.min(attempts - 1, 4)] ?? 20;
}
