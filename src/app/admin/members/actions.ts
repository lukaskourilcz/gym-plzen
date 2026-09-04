"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  setMemberRoleSchema,
  updateMemberSchema,
  type SetMemberRoleValues,
  type UpdateMemberValues,
} from "@/lib/validations/members";
import { members } from "@/lib/services";
import { logger } from "@/lib/helpers/logger";

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

/**
 * Grant or revoke the administrator role, so handing the administration over
 * no longer needs the `set-admin` script and a terminal.
 */
const setMemberRoleImpl = defineAction({
  schema: setMemberRoleSchema,
  authorize: assertAdmin,
  handler: async ({ userId, role }, admin) => {
    await members.setRole(userId, role);
    // Who changed whose access is worth having in the log; no PII beyond ids.
    logger.info("Member role changed", {
      actorId: admin.id,
      userId,
      role,
    });
    revalidatePath("/admin/members");
  },
});

export async function setMemberRoleAction(
  input: SetMemberRoleValues,
): Promise<Result<unknown>> {
  return setMemberRoleImpl(input);
}
