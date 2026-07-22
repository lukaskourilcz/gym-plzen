"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  updateMemberSchema,
  type UpdateMemberValues,
} from "@/lib/validations/members";
import { members } from "@/lib/services";

/** Update a member's profile (contact, notification prefs, admin note). */
const updateMemberImpl = defineAction({
  schema: updateMemberSchema,
  authorize: assertAdmin,
  handler: async (input) => {
    await members.updateProfile(input.userId, {
      phone: input.phone || null,
      notifyByWhatsapp: input.notifyByWhatsapp,
      notifyBySms: input.notifyBySms,
      marketingConsent: input.marketingConsent,
      note: input.note || null,
    });
    revalidatePath("/admin/members");
  },
});

export async function updateMemberAction(
  input: UpdateMemberValues,
): Promise<Result<unknown>> {
  return updateMemberImpl(input);
}
