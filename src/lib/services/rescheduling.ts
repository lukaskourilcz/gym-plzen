import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blockedSlot,
  openingHours,
  reservation,
  reservationPipeline,
  reservationReschedule,
} from "@/lib/db/schema";
import type { Reservation } from "@/lib/db/types";
import { dateKeyInTimeZone, dayOfWeek } from "@/lib/helpers/datetime";
import { ActionError } from "@/lib/helpers/action";
import { logger } from "@/lib/helpers/logger";
import { isWithinBookingHorizon, resolveSlotFromHours } from "./slots";
import { fulfillReservation } from "./fulfillment";

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
 * Atomically claim the new slot and release the old one on the same reservation
 * row. The row lock serializes double-clicks; the exclusion constraint remains
 * the final guard when a different customer concurrently claims the target.
 */
export async function rescheduleReservation(
  input: RescheduleReservationInput,
): Promise<Reservation> {
  const now = input.now ?? new Date();
  if (Number.isNaN(input.startsAt.getTime()) || input.startsAt <= now) {
    throw new ActionError("Vyberte platný budoucí termín.");
  }
  const targetDateKey = dateKeyInTimeZone(input.startsAt);
  if (!isWithinBookingHorizon(targetDateKey, now)) {
    throw new ActionError("Termín lze vybrat nejvýše 60 dní dopředu.");
  }

  let updated: Reservation;
  try {
    updated = await db.transaction(async (tx) => {
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
            lt(reservation.startsAt, target.endsAt),
            gt(reservation.endsAt, target.startsAt),
            inArray(reservation.status, ["pending", "confirmed"]),
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

      const changedAt = new Date();
      const [moved] = await tx
        .update(reservation)
        .set({
          startsAt: target.startsAt,
          endsAt: target.endsAt,
          updatedAt: changedAt,
        })
        .where(
          and(
            eq(reservation.id, current.id),
            eq(reservation.userId, input.userId),
            eq(reservation.status, "confirmed"),
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

      // Commit the retryable code-refresh intent together with the new slot.
      // Provider calls still happen after commit, so no network request holds
      // the reservation row lock.
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
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "23P01") {
      throw new ActionError(
        "Tento termín právě rezervoval jiný zákazník. Vyberte prosím jiný čas.",
      );
    }
    if (code === "23505") {
      throw new ActionError("Tuto rezervaci už jste jednou změnili.");
    }
    throw error;
  }

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
