import {
  issueAccessCode,
  listCodesForReservation,
  revokeAccessCode,
} from "./access-codes";
import { withReservationLock } from "./operation-lock";
import {
  checkAvailability,
  lockSchedule,
  reservationOverlaps,
} from "./availability";
import { isAccessCodePreparationDue } from "@/lib/config/access-code-delivery";
import { getOperations } from "./operations";
import { isDateOpenForBooking } from "@/lib/config/operations";
import { or, and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blockedSlot,
  openingHours,
  reservation,
  messageDelivery,
  reservationPipeline,
  reservationReschedule,
} from "@/lib/db/schema";
import type { Reservation } from "@/lib/db/types";
import { dateKeyInTimeZone, dayOfWeek } from "@/lib/helpers/datetime";
import { ActionError } from "@/lib/helpers/action";
import {
  PG_EXCLUSION_VIOLATION,
  PG_UNIQUE_VIOLATION,
  pgErrorCode,
} from "@/lib/helpers/pg-error";
import { logger } from "@/lib/helpers/logger";
import {
  getBookingHorizonDays,
  isWithinBookingHorizon,
  resolveSlotFromHours,
} from "./slots";
import { fulfillReservation } from "./fulfillment";
import { initPipeline } from "./pipeline";
import { deliverRescheduleConfirmation } from "./reschedule-delivery";
import { notifyReservationRescheduled } from "./operator-notifications";
import { recordIn as recordActivityIn } from "./activity";
import { formatDateTime } from "@/lib/helpers/format";

/** VOP 8.1 and 8.5: the request must arrive at least 24 hours in advance. */
export const RESCHEDULE_CUTOFF_HOURS = 24;
export const MAX_CUSTOMER_RESCHEDULES = 1;
const RESCHEDULE_CUTOFF_MS = RESCHEDULE_CUTOFF_HOURS * 60 * 60 * 1_000;

export type RescheduleIneligibilityReason =
  "not_confirmed" | "already_changed" | "started" | "inside_cutoff";

export type RescheduleEligibility =
  | { eligible: true; deadline: Date }
  | {
      eligible: false;
      reason: RescheduleIneligibilityReason;
      deadline: Date;
    };

type EligibilityReservation = Pick<Reservation, "status" | "startsAt">;

/** Pure rule evaluation shared by the profile UI, page guard, and write path. */
export function getRescheduleEligibility(
  value: EligibilityReservation,
  alreadyRescheduled: boolean,
  now = new Date(),
): RescheduleEligibility {
  const deadline = new Date(value.startsAt.getTime() - RESCHEDULE_CUTOFF_MS);
  if (value.status !== "confirmed") {
    return { eligible: false, reason: "not_confirmed", deadline };
  }
  if (alreadyRescheduled) {
    return { eligible: false, reason: "already_changed", deadline };
  }
  if (value.startsAt.getTime() <= now.getTime()) {
    return { eligible: false, reason: "started", deadline };
  }
  if (now.getTime() > deadline.getTime()) {
    return { eligible: false, reason: "inside_cutoff", deadline };
  }
  return { eligible: true, deadline };
}

export function rescheduleReasonMessage(
  reason: RescheduleIneligibilityReason,
): string {
  switch (reason) {
    case "already_changed":
      return "Tuto rezervaci už jste jednou změnili.";
    case "inside_cutoff":
      return "Termín lze změnit nejpozději 24 hodin před jeho začátkem.";
    case "started":
      return "Probíhající nebo uplynulý termín už nelze změnit.";
    case "not_confirmed":
      return "Změnit lze pouze zaplacenou a potvrzenou rezervaci.";
  }
}

export interface RescheduleReservationInput {
  reservationId: string;
  userId: string;
  startsAt: Date;
  now?: Date;
}

/**
 * Persist a hold on both windows, verify any due access change, then commit
 * the move. The operation lock serializes requests; the exclusion constraint
 * guards the target against other customers throughout provider calls.
 */
export async function rescheduleReservation(
  input: RescheduleReservationInput,
): Promise<Reservation> {
  return withReservationLock(input.reservationId, () =>
    rescheduleLocked(input),
  );
}
async function rescheduleLocked(
  input: RescheduleReservationInput,
): Promise<Reservation> {
  if (
    !isDateOpenForBooking(
      dateKeyInTimeZone(input.startsAt),
      await getOperations(),
    )
  )
    throw new ActionError("Tento den zatím není možné rezervovat.");
  const original = await getReservationForMove(
    input.reservationId,
    input.userId,
  );
  if (
    original.rescheduleStartsAt &&
    !(await abortPendingReschedule(original.id))
  )
    throw new ActionError("Rezervaci se nepodařilo změnit.");
  const now = input.now ?? new Date();
  if (Number.isNaN(input.startsAt.getTime()) || input.startsAt <= now) {
    throw new ActionError("Vyberte platný budoucí termín.");
  }
  const targetDateKey = dateKeyInTimeZone(input.startsAt);
  const horizonDays = await getBookingHorizonDays();
  if (!isWithinBookingHorizon(targetDateKey, now, horizonDays)) {
    // The message quotes the configured horizon rather than a fixed 60 days.
    throw new ActionError(
      `Termín lze vybrat nejvýše ${horizonDays} dní dopředu.`,
    );
  }

  let updated: Reservation;
  let previousStartsAt: Date;
  try {
    const { current, target } = await db.transaction(async (tx) => {
      await lockSchedule(tx);
      const [current] = await tx
        .select()
        .from(reservation)
        .where(eq(reservation.id, input.reservationId))
        .for("update")
        .limit(1);

      // Do not reveal whether an arbitrary reservation id exists.
      if (!current || current.userId !== input.userId) {
        throw new ActionError("Rezervaci se nepodařilo najít.");
      }

      const [previousChange] = await tx
        .select({ id: reservationReschedule.id })
        .from(reservationReschedule)
        .where(eq(reservationReschedule.reservationId, current.id))
        .limit(1);
      const eligibility = getRescheduleEligibility(
        current,
        Boolean(previousChange),
        now,
      );
      if (!eligibility.eligible) {
        throw new ActionError(rescheduleReasonMessage(eligibility.reason));
      }

      const [hours] = await tx
        .select()
        .from(openingHours)
        .where(eq(openingHours.dayOfWeek, dayOfWeek(input.startsAt)))
        .limit(1);
      const target = hours
        ? resolveSlotFromHours(input.startsAt, {
            openMinute: hours.openMinute,
            closeMinute: hours.closeMinute,
            slotMinutes: hours.slotMinutes,
            isClosed: hours.isClosed === 1,
          })
        : null;
      if (!target) {
        throw new ActionError("Vybraný čas je mimo otevírací dobu.");
      }
      if (current.startsAt.getTime() === target.startsAt.getTime()) {
        throw new ActionError("Vyberte jiný termín než ten současný.");
      }

      const [reservationConflict] = await tx
        .select({ id: reservation.id })
        .from(reservation)
        .where(
          and(
            reservationOverlaps(target.startsAt, target.endsAt),
            or(
              inArray(reservation.status, ["pending", "confirmed"]),
              eq(reservation.accessRevocationPending, true),
            ),
            ne(reservation.id, current.id),
          ),
        )
        .limit(1);
      if (reservationConflict) {
        throw new ActionError(
          "Tento termín právě rezervoval jiný zákazník. Vyberte prosím jiný čas.",
        );
      }

      const [blockConflict] = await tx
        .select({ id: blockedSlot.id })
        .from(blockedSlot)
        .where(
          and(
            lt(blockedSlot.startsAt, target.endsAt),
            gt(blockedSlot.endsAt, target.startsAt),
          ),
        )
        .limit(1);
      if (blockConflict) {
        throw new ActionError("Tento termín není k dispozici.");
      }

      await tx
        .update(reservation)
        .set({
          rescheduleStartsAt: target.startsAt,
          rescheduleEndsAt: target.endsAt,
          updatedAt: new Date(),
        })
        .where(eq(reservation.id, current.id));
      // This commits with the two-window hold: a crashed request is picked up
      // by fulfillment and cleans the abandoned target before delivering a PIN.
      await initPipeline(current.id, tx);
      await tx
        .update(reservationPipeline)
        .set({
          status: "pending",
          attempts: 0,
          nextRetryAt: new Date(),
          completedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(reservationPipeline.reservationId, current.id),
            inArray(reservationPipeline.step, [
              "code_created",
              "code_delivered",
            ]),
          ),
        );
      return { current, target };
    });
    previousStartsAt = current.startsAt;

    // Durable device writes happen after the hold commits and before the move.
    // A failed/ambiguous PUT cannot release either time window or confirm a move.
    for (const code of (await listCodesForReservation(current.id)).filter(
      (code) => !["revoked", "expired"].includes(code.status),
    ))
      await revokeAccessCode(code.id);
    if (
      (await getOperations()).accessCodesEnabled &&
      isAccessCodePreparationDue(target.startsAt)
    ) {
      const issued = await issueAccessCode({
        reservationId: current.id,
        startsAt: target.startsAt,
        endsAt: target.endsAt,
      });
      if (!issued.provisionedOnLock)
        throw new ActionError("Rezervaci se nepodařilo změnit.");
    }

    updated = await db.transaction(async (tx) => {
      await lockSchedule(tx);
      const available = await checkAvailability(
        target.startsAt,
        target.endsAt,
        { excludeReservationId: current.id },
        tx,
      );
      if (!available.available || target.startsAt <= new Date())
        throw new ActionError("Tento termín není k dispozici.");
      const changedAt = new Date();
      const [moved] = await tx
        .update(reservation)
        .set({
          startsAt: target.startsAt,
          endsAt: target.endsAt,
          rescheduleStartsAt: null,
          rescheduleEndsAt: null,
          updatedAt: changedAt,
        })
        .where(
          and(
            eq(reservation.id, current.id),
            eq(reservation.userId, input.userId),
            eq(reservation.status, "confirmed"),
            eq(reservation.rescheduleStartsAt, target.startsAt),
          ),
        )
        .returning();
      if (!moved) {
        throw new ActionError("Rezervaci se nepodařilo změnit.");
      }

      await tx.insert(reservationReschedule).values({
        reservationId: current.id,
        userId: input.userId,
        previousStartsAt: current.startsAt,
        previousEndsAt: current.endsAt,
        newStartsAt: moved.startsAt,
        newEndsAt: moved.endsAt,
        changedAt,
      });
      if (current.contactEmail)
        await tx.insert(messageDelivery).values({
          reservationId: current.id,
          userId: input.userId,
          channel: "email",
          kind: "reservation_confirmation",
          status: "queued",
          recipient: current.contactEmail,
          dedupeKey: `reschedule-confirmation/${current.id}`,
          providerResponse: { submitted: false },
        });
      await recordActivityIn(tx, {
        action: "reservation.rescheduled",
        actorType: "customer",
        actorId: input.userId,
        actorLabel: current.contactEmail,
        memberId: input.userId,
        reservationId: current.id,
        summary: `Termín změněn z ${formatDateTime(current.startsAt)} na ${formatDateTime(moved.startsAt)}.`,
        occurredAt: changedAt,
      });

      // Commit the retryable code-refresh intent together with the new slot.
      // Codes outside the preparation horizon are created later; any code due
      // now was already verified before releasing the original slot.
      await tx
        .update(reservationPipeline)
        .set({
          status: "pending",
          attempts: 0,
          lastError: null,
          nextRetryAt: changedAt,
          completedAt: null,
          updatedAt: changedAt,
        })
        .where(
          and(
            eq(reservationPipeline.reservationId, current.id),
            inArray(reservationPipeline.step, [
              "code_created",
              "code_delivered",
            ]),
          ),
        );

      return moved;
    });
  } catch (error) {
    // Confirm absence before freeing the target. If readback is uncertain the
    // persisted hold and pending pipeline survive for the watchdog to clean.
    await abortPendingReschedule(input.reservationId).catch(() => false);
    const code = pgErrorCode(error);
    if (code === PG_EXCLUSION_VIOLATION) {
      throw new ActionError(
        "Tento termín právě rezervoval jiný zákazník. Vyberte prosím jiný čas.",
      );
    }
    if (code === PG_UNIQUE_VIOLATION) {
      throw new ActionError("Tuto rezervaci už jste jednou změnili.");
    }
    throw error;
  }

  // The customer must hold the change in writing whatever the lock phase:
  // fulfillment sends the booking confirmation only once per reservation, so
  // on its own it would say nothing about the new time. Never fails the change.
  try {
    await deliverRescheduleConfirmation(updated.id);
  } catch (error) {
    logger.error(error, {
      where: "rescheduleReservation.deliverRescheduleConfirmation",
      reservationId: updated.id,
    });
  }

  await notifyReservationRescheduled({
    reservation: updated,
    previousStartsAt,
  });

  // Nuki and notification calls stay outside the database transaction. The
  // durable pipeline was reset in the transaction, so the watchdog can retry
  // even if a provider is temporarily unavailable.
  try {
    await fulfillReservation(updated.id);
  } catch (error) {
    logger.error(error, {
      where: "rescheduleReservation.fulfillReservation",
      reservationId: updated.id,
    });
  }

  return updated;
}

async function getReservationForMove(
  id: string,
  userId: string,
): Promise<Reservation> {
  const [row] = await db
    .select()
    .from(reservation)
    .where(and(eq(reservation.id, id), eq(reservation.userId, userId)))
    .limit(1);
  if (!row) throw new ActionError("Rezervaci se nepodařilo najít.");
  return row;
}

/** Abort an unfinished move; its original reservation has never moved. */
export async function abortPendingReschedule(id: string): Promise<boolean> {
  return withReservationLock(id, async () => {
    const [row] = await db
      .select()
      .from(reservation)
      .where(eq(reservation.id, id))
      .limit(1);
    if (!row?.rescheduleStartsAt) return true;
    const target = row.rescheduleStartsAt;
    const codes = (await listCodesForReservation(id)).filter(
      (code) =>
        code.validFrom.getTime() === target.getTime() &&
        !["revoked", "expired"].includes(code.status),
    );
    try {
      for (const code of codes) await revokeAccessCode(code.id);
    } catch {
      return false;
    }
    await db
      .update(reservation)
      .set({
        rescheduleStartsAt: null,
        rescheduleEndsAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(reservation.id, id), eq(reservation.rescheduleStartsAt, target)),
      );
    return true;
  });
}

/** Reservations that already consumed their one customer-initiated change. */
export async function listRescheduledReservationIds(
  userId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ reservationId: reservationReschedule.reservationId })
    .from(reservationReschedule)
    .where(eq(reservationReschedule.userId, userId));
  return new Set(rows.map((row) => row.reservationId));
}

export async function hasReservationBeenRescheduled(
  reservationId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: reservationReschedule.id })
    .from(reservationReschedule)
    .where(
      and(
        eq(reservationReschedule.reservationId, reservationId),
        eq(reservationReschedule.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(row);
}
