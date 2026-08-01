"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { hhmmToMinutes } from "@/lib/helpers/format";
import {
  createBlockedSlotSchema,
  deleteBlockedSlotSchema,
  openingHoursSchema,
  showerMinutesSchema,
  type CreateBlockedSlotValues,
  type OpeningHoursValues,
} from "@/lib/validations/schedule";
import { schedule, notifications, members } from "@/lib/services";

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
    const start = new Date(input.startsAt);
    const end = new Date(input.endsAt);
    await schedule.createBlockedSlot({
      startsAt: start,
      endsAt: end,
      reason: input.reason,
      note: input.note || null,
      createdByAdminId: admin.id,
    });

    // Closing a slot that already has bookings: cancel them and notify members.
    const affected = await schedule.cancelOverlappingReservations(
      start,
      end,
      input.note || "Termín byl uzavřen provozovatelem.",
    );
    for (const r of affected) {
      const channels = r.userId ? await members.getMember(r.userId) : null;
      await notifications.sendReservationClosure({
        userId: r.userId ?? null,
        reservationId: r.id,
        name: r.contactName,
        startsAt: r.startsAt,
        email: r.contactEmail ?? channels?.user.email ?? null,
        phone: r.contactPhone ?? channels?.profile?.phone ?? null,
        notifyByWhatsapp: channels?.profile?.notifyByWhatsapp ?? true,
        reason: input.note || undefined,
      });
    }

    revalidatePath("/admin/schedule");
    revalidatePath("/admin/calendar");
  },
});

const deleteBlockedSlotImpl = defineAction({
  schema: deleteBlockedSlotSchema,
  authorize: assertAdmin,
  handler: async (input) => {
    await schedule.deleteBlockedSlot(input.id);
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
