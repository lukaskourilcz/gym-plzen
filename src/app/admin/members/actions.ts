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
  updateMemberNoteSchema,
  type UpdateMemberNoteValues,
  updateMemberContactSchema,
  type UpdateMemberContactValues,
} from "@/lib/validations/members";
import { updateMemberContact } from "@/lib/services/admin-member-contact";
import { activity, members } from "@/lib/services";
import { logger } from "@/lib/helpers/logger";

/** Update contact/preferences; notes have their own action to avoid stale overwrites. */
const updateMemberImpl = defineAction({
  schema: updateMemberSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    await members.updateProfile(input.userId, {
      ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
      notifyByWhatsapp: input.notifyByWhatsapp,
      notifyBySms: input.notifyBySms,
      marketingConsent: input.marketingConsent,
    });
    await activity.record({
      action: "member.profile_updated",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      memberId: input.userId,
      summary: `Nastavení člena upraveno správcem: WhatsApp ${input.notifyByWhatsapp ? "zapnut" : "vypnut"}, SMS ${input.notifyBySms ? "zapnuty" : "vypnuty"}, marketing ${input.marketingConsent ? "se souhlasem" : "bez souhlasu"}.`,
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

const updateMemberContactImpl = defineAction({
  schema: updateMemberContactSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    await updateMemberContact(input, { id: admin.id, email: admin.email });
    revalidatePath("/admin", "layout");
    revalidatePath("/account", "layout");
  },
});
export async function updateMemberContactAction(
  input: UpdateMemberContactValues,
): Promise<Result<unknown>> {
  return updateMemberContactImpl(input);
}

const updateMemberNoteImpl = defineAction({
  schema: updateMemberNoteSchema,
  authorize: assertAdmin,
  handler: async ({ userId, note }, admin) => {
    const text = note.trim();
    await members.updateProfile(userId, { note: text || null });
    await activity.record({
      action: "member.note_updated",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      memberId: userId,
      summary: text
        ? "Interní poznámka zákazníka uložena."
        : "Interní poznámka zákazníka odstraněna.",
    });
    revalidatePath("/admin", "layout");
  },
});
export async function updateMemberNoteAction(
  input: UpdateMemberNoteValues,
): Promise<Result<unknown>> {
  return updateMemberNoteImpl(input);
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
