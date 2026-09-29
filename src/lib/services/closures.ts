import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blockedSlot } from "@/lib/db/schema";
import type { BlockedSlot, Reservation } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";
import { formatDateTime } from "@/lib/helpers/format";
import { closureConfirmationMessage } from "@/lib/helpers/closure-copy";
import { logger } from "@/lib/helpers/logger";
import { record as recordActivity } from "./activity";
import { cancelReservation } from "./reservations";
import { createBlockedSlot, findOverlappingReservations } from "./schedule";

/**
 * Closing a time range from the administration (a block over maintenance, a
 * holiday, a private event). A block over existing bookings cancels them and
 * e-mails every customer, so it never happens on a single click: the first
 * request only reports how many bookings are affected, and the admin must
 * repeat it confirming exactly that number.
 *
 * Each booking takes the full cancellation path (`cancelReservation`): the
 * reservation lock is held and any access code is revoked. Unpaid voucher
 * claims are released; redeemed uses stay consumed until the operator decides
 * the refund policy (including multi-slot orders). A paid reservation raises a
 * critical refund alert, because the money has to be returned by hand in the
 * Comgate portal.
 */

export interface ClosureAdmin {
  id: string;
  email: string;
}

export type CloseTimeRangeOutcome =
  | {
      status: "needs_confirmation";
      affectedCount: number;
      message: string;
    }
  | {
      status: "closed";
      blockId: string;
      /** Whether this request inserted the block or found an identical one. */
      blockCreated: boolean;
      cancelledCount: number;
      /** Bookings that are still active because their cancellation threw. */
      failed: Array<{ id: string; startsAt: Date }>;
    };

/** An existing block with exactly this range: a retry reuses it. */
async function findIdenticalBlock(
  startsAt: Date,
  endsAt: Date,
): Promise<BlockedSlot | null> {
  const [row] = await db
    .select()
    .from(blockedSlot)
    .where(
      and(eq(blockedSlot.startsAt, startsAt), eq(blockedSlot.endsAt, endsAt)),
    )
    .limit(1);
  return row ?? null;
}

export async function closeTimeRange(
  input: {
    startsAt: Date;
    endsAt: Date;
    reason: BlockedSlot["reason"];
    note?: string | null;
    admin: ClosureAdmin;
    /**
     * The number of cancellations the admin agreed to. Anything but the
     * current count (including undefined) returns `needs_confirmation`, so a
     * booking made between the warning and the confirmation is never cancelled
     * without being counted first.
     */
    confirmCancellations?: number;
  },
  /** Seam for tests that need one cancellation to fail. */
  deps: { cancel: typeof cancelReservation } = { cancel: cancelReservation },
): Promise<CloseTimeRangeOutcome> {
  if (input.endsAt <= input.startsAt) {
    throw new ActionError("Konec bloku musí být po jeho začátku.");
  }
  const note = input.note?.trim() || null;

  const affected = await findOverlappingReservations(
    input.startsAt,
    input.endsAt,
  );
  if (affected.length > 0 && input.confirmCancellations !== affected.length) {
    return {
      status: "needs_confirmation",
      affectedCount: affected.length,
      message: closureConfirmationMessage(affected.length),
    };
  }

  // The block goes in first so no new booking can land in the range while
  // the existing ones are being cancelled. A retry after a partial failure
  // finds the same block instead of stacking a duplicate.
  const existing = await findIdenticalBlock(input.startsAt, input.endsAt);
  const block =
    existing ??
    (await createBlockedSlot({
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      reason: input.reason,
      note,
      createdByAdminId: input.admin.id,
    }));

  // Re-read after the block exists: a checkout that slipped in between is now
  // inside a closed range and is cancelled with the rest.
  const toCancel = await findOverlappingReservations(
    input.startsAt,
    input.endsAt,
  );
  if (toCancel.length > 0 && input.confirmCancellations !== toCancel.length) {
    if (!existing)
      await recordActivity({
        action: "blocked_slot.created",
        actorType: "admin",
        actorId: input.admin.id,
        actorLabel: input.admin.email,
        summary: `Termíny od ${formatDateTime(input.startsAt)} do ${formatDateTime(input.endsAt)} uzavřeny; storno ${toCancel.length} rezervací čeká na potvrzení.`,
        context: { blockedSlotId: block.id, reason: input.reason },
      });
    return {
      status: "needs_confirmation",
      affectedCount: toCancel.length,
      message: closureConfirmationMessage(toCancel.length),
    };
  }
  const cancelled: Reservation[] = [];
  const failed: Array<{ id: string; startsAt: Date }> = [];
  for (const row of toCancel) {
    try {
      await deps.cancel({
        id: row.id,
        reason: note ?? "Termín byl uzavřen provozovatelem.",
        byAdminId: input.admin.id,
      });
      cancelled.push(row);
    } catch (error) {
      logger.error(error, {
        where: "closures.closeTimeRange",
        reservationId: row.id,
      });
      failed.push({ id: row.id, startsAt: row.startsAt });
    }
  }

  if (!existing)
    await recordActivity({
      action: "blocked_slot.created",
      actorType: "admin",
      actorId: input.admin.id,
      actorLabel: input.admin.email,
      summary: `Termíny od ${formatDateTime(input.startsAt)} do ${formatDateTime(input.endsAt)} uzavřeny${note ? ` (${note})` : ""}; zrušeno rezervací: ${cancelled.length}.`,
      context: { blockedSlotId: block.id, reason: input.reason },
    });
  for (const r of cancelled) {
    await recordActivity({
      action: "reservation.cancelled",
      actorType: "admin",
      actorId: input.admin.id,
      actorLabel: input.admin.email,
      memberId: r.userId,
      reservationId: r.id,
      summary: `Rezervace na ${formatDateTime(r.startsAt)} zrušena uzavřením termínů${note ? ` (${note})` : ""}.`,
    });
  }

  return {
    status: "closed",
    blockId: block.id,
    blockCreated: !existing,
    cancelledCount: cancelled.length,
    failed,
  };
}
