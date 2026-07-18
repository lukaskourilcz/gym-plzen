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
  type CreateBlockedSlotValues,
  type OpeningHoursValues,
} from "@/lib/validations/schedule";
import { schedule } from "@/lib/services";

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
    await schedule.createBlockedSlot({
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      reason: input.reason,
      note: input.note || null,
      createdByAdminId: admin.id,
    });
    revalidatePath("/admin/schedule");
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

export async function saveOpeningHoursAction(
  input: OpeningHoursValues,
): Promise<Result<unknown>> {
  return saveOpeningHoursImpl(input);
}

export async function createBlockedSlotAction(
  input: CreateBlockedSlotValues,
): Promise<Result<unknown>> {
  return createBlockedSlotImpl(input);
}

export async function deleteBlockedSlotAction(
  input: { id: string },
): Promise<Result<unknown>> {
  return deleteBlockedSlotImpl(input);
}
