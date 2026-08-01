import {
  emailTemplateSettingKey,
  emailTextToHtml,
  getEmailTemplateDefinition,
  type EmailTemplate,
  type EmailTemplateId,
  renderEmailTemplateText,
} from "@/lib/config/email-templates";
import { sendEmail, type SendEmailResult } from "@/lib/integrations/resend";
import { getSetting, setSetting } from "./cms";

/** Resolve the saved template, with a safe branded fallback on first use. */
export async function getEmailTemplate(
  id: EmailTemplateId,
): Promise<EmailTemplate> {
  const definition = getEmailTemplateDefinition(id);
  const saved = await getSetting<Partial<EmailTemplate>>(
    emailTemplateSettingKey(id),
  );
  return {
    subject: saved?.subject?.trim() || definition.fallback.subject,
    body: saved?.body?.trim() || definition.fallback.body,
  };
}

export async function getAllEmailTemplates(): Promise<
  Record<EmailTemplateId, EmailTemplate>
> {
  const entries = await Promise.all(
    (
      [
        "reservation_confirmation",
        "access_code",
        "reservation_cancellation",
      ] as const
    ).map(async (id) => [id, await getEmailTemplate(id)] as const),
  );
  return Object.fromEntries(entries) as Record<EmailTemplateId, EmailTemplate>;
}

export async function saveEmailTemplate(params: {
  id: EmailTemplateId;
  subject: string;
  body: string;
  updatedByAdminId: string;
}): Promise<void> {
  await setSetting(
    emailTemplateSettingKey(params.id),
    { subject: params.subject.trim(), body: params.body.trim() },
    params.updatedByAdminId,
  );
}

export async function sendTransactionalEmail(params: {
  id: EmailTemplateId;
  to: string;
  variables: Record<string, string>;
}): Promise<SendEmailResult> {
  const template = await getEmailTemplate(params.id);
  const rendered = renderEmailTemplateText(template, params.variables);
  return sendEmail({
    to: params.to,
    subject: rendered.subject,
    text: rendered.body,
    html: emailTextToHtml(rendered.body),
  });
}

const TEST_VARIABLES: Record<string, string> = {
  name: "Klára",
  code: "482 916",
  time: "pondělí 3. srpna 2026 v 18:00",
  duration: "75 minut",
  price: "290 Kč",
  reason: "Úprava provozní doby",
};

/** Send the selected template with explicit, clearly fictional test values. */
export async function sendTemplateTest(params: {
  id: EmailTemplateId;
  to: string;
}): Promise<SendEmailResult> {
  return sendTransactionalEmail({
    id: params.id,
    to: params.to,
    variables: TEST_VARIABLES,
  });
}

export function getEmailTemplatePreview(id: EmailTemplateId): EmailTemplate {
  const definition = getEmailTemplateDefinition(id);
  return renderEmailTemplateText(definition.fallback, TEST_VARIABLES);
}
