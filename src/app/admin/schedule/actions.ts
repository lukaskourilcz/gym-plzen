"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { formDateTimeToInstant } from "@/lib/helpers/datetime";
import { hhmmToMinutes } from "@/lib/helpers/format";
import {
  createBlockedSlotSchema,
  deleteBlockedSlotSchema,
  openingHoursSchema,
  showerMinutesSchema,
  type CreateBlockedSlotValues,
  type OpeningHoursValues,
} from "@/lib/validations/schedule";
import { activity, schedule, reservations } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";

/** Save opening hours for one weekday (converts "HH:mm" → minutes). */
const saveOpeningHoursImpl = defineAction({
  schema: openingHoursSchema,
  authorize: assertAdmin,
  handler: async (input) => {
    await schedule.setOpeningHours({
      dayOfWeek: input.dayOfWeek,
      openMinute: hhmmToMinutes(input.open) ?? 0,
      closeMinute: hhmmToMinutes(input.close) ?? 0,
      slotMinutes: input.slotMinutes,
      isClosed: input.isClosed,
    });
    revalidatePath("/admin/schedule");
  },
});

/** Block a time range (maintenance, holiday, …). */
const createBlockedSlotImpl = defineAction({
  schema: createBlockedSlotSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const start = formDateTimeToInstant(input.startsAt);
    const end = formDateTimeToInstant(input.endsAt);
    const block = await schedule.createBlockedSlot({
      startsAt: start,
      endsAt: end,
      reason: input.reason,
      note: input.note || null,
      createdByAdminId: admin.id,
    });

    // Closing a slot that already has bookings: cancel them (full cancellation,
    // voucher release, refund alert for paid ones) and notify each member.
    const affected = await schedule.findOverlappingReservations(start, end);
    await reservations.cancelReservationsForClosure(affected, {
      reason: input.note || "Termín byl uzavřen provozovatelem.",
      byAdminId: admin.id,
    });
    await activity.record({
      action: "blocked_slot.created",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      summary: `Termíny od ${formatDateTime(start)} do ${formatDateTime(end)} uzavřeny${input.note ? ` (${input.note})` : ""}; zrušeno rezervací: ${affected.length}.`,
      context: { blockedSlotId: block.id, reason: input.reason },
    });
    for (const r of affected) {
      await activity.record({
        action: "reservation.cancelled",
        actorType: "admin",
        actorId: admin.id,
        actorLabel: admin.email,
        memberId: r.userId,
        reservationId: r.id,
        summary: `Rezervace na ${formatDateTime(r.startsAt)} zrušena uzavřením termínů${input.note ? ` (${input.note})` : ""}.`,
      });
    }

    revalidatePath("/admin/schedule");
    revalidatePath("/admin/calendar");
  },
});

const deleteBlockedSlotImpl = defineAction({
  schema: deleteBlockedSlotSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const block = await schedule.getBlockedSlot(input.id);
    await schedule.deleteBlockedSlot(input.id);
    if (block)
      await activity.record({
        action: "blocked_slot.deleted",
        actorType: "admin",
        actorId: admin.id,
        actorLabel: admin.email,
        summary: `Uzavření termínů od ${formatDateTime(block.startsAt)} do ${formatDateTime(block.endsAt)} zrušeno.`,
      });
    revalidatePath("/admin/schedule");
  },
});

/** Save the shower grace (minutes the code stays valid after a slot). */
const saveShowerMinutesImpl = defineAction({
  schema: showerMinutesSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    await schedule.setShowerMinutes(input.showerMinutes, admin.id);
    revalidatePath("/admin/schedule");
  },
});

export async function saveOpeningHoursAction(
  input: OpeningHoursValues,
): Promise<Result<unknown>> {
  return saveOpeningHoursImpl(input);
}

export async function saveShowerMinutesAction(input: {
  showerMinutes: number;
}): Promise<Result<unknown>> {
  return saveShowerMinutesImpl(input);
}

export async function createBlockedSlotAction(
  input: CreateBlockedSlotValues,
): Promise<Result<unknown>> {
  return createBlockedSlotImpl(input);
}

export async function deleteBlockedSlotAction(input: {
  id: string;
}): Promise<Result<unknown>> {
  return deleteBlockedSlotImpl(input);
}
