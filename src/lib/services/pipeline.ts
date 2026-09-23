import {
  ACCESS_CODE_NOTICE_MINUTES,
  ACCESS_CODE_PREPARE_MINUTES,
} from "@/lib/config/access-code-delivery";
import {
  sql,
  asc,
  and,
  eq,
  getTableColumns,
  gt,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { getOperations } from "./operations";
import { reservation, reservationPipeline } from "@/lib/db/schema";
import type { ReservationPipeline } from "@/lib/db/types";
import { addMinutes } from "@/lib/helpers/datetime";
import { logger, redactForLogs } from "@/lib/helpers/logger";
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
export async function initPipeline(
  reservationId: string,
  executor: DatabaseExecutor = db,
): Promise<void> {
  await executor
    .insert(reservationPipeline)
    .values(
      STEPS.map((step) => ({ reservationId, step, nextRetryAt: new Date() })),
    )
    // The unique (reservation, step) index is what makes this idempotent.
    .onConflictDoNothing({
      target: [reservationPipeline.reservationId, reservationPipeline.step],
    });
}

/** Mark a step succeeded and clear any alert for it. */
export async function markStepSucceeded(
  reservationId: string,
  step: PipelineStep,
): Promise<void> {
  await db
    .update(reservationPipeline)
    .set({
      status: "succeeded",
      completedAt: new Date(),
      nextRetryAt: null,
      updatedAt: new Date(),
    })
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
 * alert after repeated failures while continuing bounded retries.
 */
export async function markStepFailed(
  reservationId: string,
  step: PipelineStep,
  error: string,
): Promise<void> {
  error = redactForLogs(error);
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
  const [booking] = await db
    .select({ startsAt: reservation.startsAt })
    .from(reservation)
    .where(eq(reservation.id, reservationId))
    .limit(1);
  const urgent =
    booking && booking.startsAt.getTime() - Date.now() <= 15 * 60_000;

  await db
    .update(reservationPipeline)
    .set({
      status: "retrying",
      attempts,
      lastError: error,
      nextRetryAt: addMinutes(
        new Date(),
        urgent ? 1 : retryDelayMinutes(attempts),
      ),
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
  const { accessCodesEnabled } = await getOperations();
  const now = new Date();
  return db
    .select(getTableColumns(reservationPipeline))
    .from(reservationPipeline)
    .innerJoin(
      reservation,
      eq(reservation.id, reservationPipeline.reservationId),
    )
    .where(
      and(
        eq(reservation.status, "confirmed"),
        accessCodesEnabled
          ? undefined
          : eq(reservationPipeline.step, "payment"),
        // Future PIN steps must not occupy the retry batch and starve due ones.
        or(
          eq(reservationPipeline.step, "payment"),
          and(
            eq(reservationPipeline.step, "code_created"),
            lte(
              reservation.startsAt,
              addMinutes(now, ACCESS_CODE_PREPARE_MINUTES),
            ),
          ),
          and(
            eq(reservationPipeline.step, "code_delivered"),
            sql`exists (select 1 from reservation_pipeline prerequisite where prerequisite.reservation_id = ${reservation.id} and prerequisite.step = 'code_created' and prerequisite.status = 'succeeded')`,
            lte(
              reservation.startsAt,
              addMinutes(now, ACCESS_CODE_NOTICE_MINUTES),
            ),
          ),
        ),
        gt(reservation.endsAt, now),
        or(
          eq(reservationPipeline.status, "retrying"),
          eq(reservationPipeline.status, "failed"),
          eq(reservationPipeline.status, "pending"),
        ),
        or(
          isNull(reservationPipeline.nextRetryAt),
          lte(reservationPipeline.nextRetryAt, now),
        ),
      ),
    )
    .orderBy(
      asc(reservation.startsAt),
      asc(reservationPipeline.nextRetryAt),
      asc(reservationPipeline.id),
    )
    .limit(limit);
}

/** Full pipeline state for one reservation (admin drill-down). */
export async function getPipeline(
  reservationId: string,
): Promise<ReservationPipeline[]> {
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
