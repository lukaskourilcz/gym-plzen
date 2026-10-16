"use server";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import {
  calendarBlockRangeSchema,
  calendarBlockSelectionSchema,
  type CalendarBlockRange,
  type CalendarBlockSelection,
} from "@/lib/config/calendar-blocking";
import {
  loadCalendarBlockChoices,
  saveCalendarBlockSelection,
} from "@/lib/services/calendar-blocking";
const load = defineAction({
  schema: calendarBlockRangeSchema,
  authorize: assertAdmin,
  handler: (input) => loadCalendarBlockChoices(input),
});
const save = defineAction({
  schema: calendarBlockSelectionSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const result = await saveCalendarBlockSelection(input, admin.id);
    for (const path of [
      "/admin/calendar",
      "/admin/blocking",
      "/admin/schedule",
      "/rezervace",
    ])
      revalidatePath(path);
    return result;
  },
});
export async function loadCalendarBlockChoicesAction(
  input: CalendarBlockRange,
) {
  return load(input);
}
export async function saveCalendarBlockSelectionAction(
  input: CalendarBlockSelection,
) {
  return save(input);
}
