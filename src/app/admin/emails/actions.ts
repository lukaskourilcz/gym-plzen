"use server";

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
import { emailTemplates } from "@/lib/services";

/** Save an application-owned transactional e-mail template. */
const saveEmailTemplateImpl = defineAction({
  schema: emailTemplateSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    await emailTemplates.saveEmailTemplate({
      ...input,
      updatedByAdminId: admin.id,
    });
    revalidatePath("/admin/emails");
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
): Promise<Result<unknown>> {
  return saveEmailTemplateImpl(input);
}

export async function sendEmailTemplateTestAction(
  input: EmailTemplateTestValues,
): Promise<Result<unknown>> {
  return sendEmailTemplateTestImpl(input);
}
