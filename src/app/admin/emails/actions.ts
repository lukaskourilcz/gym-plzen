"use server";

import {
  eveningEmailStartSchema,
  EVENING_EMAIL_START_KEY,
} from "@/lib/config/evening-email";
import { setSetting } from "@/lib/services/cms";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction, ActionError } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  emailTemplateSchema,
  emailTemplateTestSchema,
  type EmailTemplateTestValues,
  type EmailTemplateValues,
} from "@/lib/validations/settings";
import type { SupabaseAuthSyncResult } from "@/lib/config/email-templates";
import { emailTemplates } from "@/lib/services";

/** Save an application-owned transactional e-mail template. */
const saveEmailTemplateImpl = defineAction({
  schema: emailTemplateSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const result = await emailTemplates.saveEmailTemplate({
      ...input,
      updatedByAdminId: admin.id,
    });
    revalidatePath("/admin/emails");
    return result;
  },
});

/** Deliver the selected template to an address chosen by the administrator. */
const sendEmailTemplateTestImpl = defineAction({
  schema: emailTemplateTestSchema,
  authorize: assertAdmin,
  handler: async (input) => {
    const result = await emailTemplates.sendTemplateTest({
      id: input.id,
      to: input.email,
    });
    if (!result.sent) {
      throw new ActionError(
        result.error === "resend_not_configured"
          ? "Resend není nakonfigurovaný. Doplňte RESEND_API_KEY a RESEND_FROM_EMAIL ve Vercelu a spusťte nový deployment."
          : "Testovací e-mail se nepodařilo odeslat. Zkontrolujte nastavení Resend a zkuste to znovu.",
      );
    }
    revalidatePath("/admin/messages");
    return { providerMessageId: result.providerMessageId };
  },
});

export async function saveEmailTemplateAction(
  input: EmailTemplateValues,
): Promise<Result<{ supabaseSync?: SupabaseAuthSyncResult }>> {
  return saveEmailTemplateImpl(input);
}

export async function sendEmailTemplateTestAction(
  input: EmailTemplateTestValues,
): Promise<Result<unknown>> {
  return sendEmailTemplateTestImpl(input);
}

const saveEveningEmailStartImpl = defineAction({
  schema: eveningEmailStartSchema,
  authorize: assertAdmin,
  handler: async ({ time }, admin) => {
    const [hours, minutes] = time.split(":").map(Number);
    await setSetting(EVENING_EMAIL_START_KEY, hours! * 60 + minutes!, admin.id);
    revalidatePath("/admin/emails");
    return {};
  },
});

export async function saveEveningEmailStartAction(input: { time: string }) {
  return saveEveningEmailStartImpl(input);
}
