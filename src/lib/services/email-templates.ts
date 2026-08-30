import {
  EMAIL_TEMPLATE_IDS,
  emailTemplateSettingKey,
  emailTextToHtml,
  getEmailTemplateDefinition,
  isSupabaseAuthEmailTemplate,
  type EmailTemplate,
  type EmailTemplateId,
  renderEmailTemplateText,
} from "@/lib/config/email-templates";
import { sendEmail, type SendEmailResult } from "@/lib/integrations/resend";
import {
  isSupabaseAuthTemplateSyncConfigured,
  syncSupabaseAuthEmailTemplate,
} from "@/lib/integrations/supabase-management";
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
    EMAIL_TEMPLATE_IDS.map(
      async (id) => [id, await getEmailTemplate(id)] as const,
    ),
  );
  return Object.fromEntries(entries) as Record<EmailTemplateId, EmailTemplate>;
}

export async function saveEmailTemplate(params: {
  id: EmailTemplateId;
  subject: string;
  body: string;
  updatedByAdminId: string;
}): Promise<{ supabaseSynced?: boolean }> {
  await setSetting(
    emailTemplateSettingKey(params.id),
    { subject: params.subject.trim(), body: params.body.trim() },
    params.updatedByAdminId,
  );
  if (!isSupabaseAuthEmailTemplate(params.id)) return {};

  const sync = await syncSupabaseAuthEmailTemplate({
    id: params.id,
    template: { subject: params.subject.trim(), body: params.body.trim() },
  });
  return { supabaseSynced: sync.synced };
}

export async function sendTransactionalEmail(params: {
  id: EmailTemplateId;
  to: string;
  variables: Record<string, string>;
}): Promise<SendEmailResult> {
  const template = await getEmailTemplate(params.id);
  const rendered = renderEmailTemplateText(template, params.variables);
  const definition = getEmailTemplateDefinition(params.id);
  const actionUrl =
    params.id === "signup_confirmation"
      ? "https://www.namastegym.cz/login"
      : "https://www.namastegym.cz/reset-password";
  return sendEmail({
    to: params.to,
    subject: rendered.subject,
    text: rendered.body,
    html: emailTextToHtml(
      rendered.body,
      definition.delivery === "supabase_auth"
        ? {
            actionUrl,
            actionLabel: definition.actionLabel,
          }
        : undefined,
    ),
  });
}

const TEST_VARIABLES: Record<string, string> = {
  name: "Klára",
  code: "482 916",
  time: "pondělí 3. srpna 2026 v 18:00",
  duration: "75 minut",
  price: "290 Kč",
  reason: "Úprava provozní doby",
  loyalty: "Tohle byla vaše 7. návštěva, do vstupu zdarma zbývají 3 vstupy.",
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

export { isSupabaseAuthTemplateSyncConfigured };
