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
import { activity, members } from "@/lib/services";
import { logger } from "@/lib/helpers/logger";

/** Update a member's profile (contact, notification prefs, admin note). */
const updateMemberImpl = defineAction({
  schema: updateMemberSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    await members.updateProfile(input.userId, {
      phone: input.phone || null,
      notifyByWhatsapp: input.notifyByWhatsapp,
      notifyBySms: input.notifyBySms,
      marketingConsent: input.marketingConsent,
      note: input.note || null,
    });
    await activity.record({
      action: "member.profile_updated",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      memberId: input.userId,
      summary: `Profil člena upraven správcem: telefon ${input.phone || "neuveden"}, WhatsApp ${input.notifyByWhatsapp ? "zapnut" : "vypnut"}, SMS ${input.notifyBySms ? "zapnuty" : "vypnuty"}, marketing ${input.marketingConsent ? "se souhlasem" : "bez souhlasu"}.`,
    });
    revalidatePath("/admin/members");
    revalidatePath(`/admin/members/${input.userId}`);
    revalidatePath("/account");
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
    await activity.record({
      action: "member.role_changed",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      memberId: userId,
      summary:
        role === "admin"
          ? "Člen získal roli správce."
          : "Členovi byla odebrána role správce.",
    });
    revalidatePath("/admin/members");
    revalidatePath(`/admin/members/${userId}`);
    revalidatePath("/account");
  },
});

export async function setMemberRoleAction(
  input: SetMemberRoleValues,
): Promise<Result<unknown>> {
  return setMemberRoleImpl(input);
}
