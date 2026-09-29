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
import { activity, closures, schedule } from "@/lib/services";
import type { CloseTimeRangeOutcome } from "@/lib/services/closures";
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

/**
 * Block a time range (maintenance, holiday, …). Over existing bookings the
 * first call only returns `needs_confirmation` with their count; the booking
 * cancellations (and customer e-mails) happen once the admin resends the
 * request confirming that count.
 */
const createBlockedSlotImpl = defineAction({
  schema: createBlockedSlotSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const outcome = await closures.closeTimeRange({
      startsAt: formDateTimeToInstant(input.startsAt),
      endsAt: formDateTimeToInstant(input.endsAt),
      reason: input.reason,
      note: input.note || null,
      admin: { id: admin.id, email: admin.email },
      confirmCancellations: input.confirmCancellations,
    });
    if (outcome.status === "closed") {
      revalidatePath("/admin/schedule");
      revalidatePath("/admin/calendar");
      revalidatePath("/admin/reservations");
    }
    return outcome;
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
): Promise<Result<CloseTimeRangeOutcome>> {
  return createBlockedSlotImpl(input);
}

export async function deleteBlockedSlotAction(input: {
  id: string;
}): Promise<Result<unknown>> {
  return deleteBlockedSlotImpl(input);
}
