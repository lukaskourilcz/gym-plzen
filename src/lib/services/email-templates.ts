import {
  EMAIL_TEMPLATE_IDS,
  brandedSubject,
  emailTemplateSettingKey,
  emailTextToHtml,
  getEmailTemplateDefinition,
  isSupabaseAuthEmailTemplate,
  type EmailTemplate,
  type EmailTemplateId,
  type SupabaseAuthSyncResult,
  renderEmailTemplateText,
} from "@/lib/config/email-templates";
import {
  sendEmail,
  type EmailAttachment,
  type SendEmailResult,
} from "@/lib/integrations/resend";
import {
  checkSupabaseAuthTemplateSync,
  isSupabaseAuthTemplateSyncConfigured,
  syncSupabaseAuthEmailTemplate,
} from "@/lib/integrations/supabase-management";
import { siteUrl } from "@/lib/helpers/site-url";
import { rebrand } from "@/lib/content/rebrand";
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
    subject: brandedSubject(
      rebrand(saved?.subject?.trim() || definition.fallback.subject),
    ),
    body: rebrand(saved?.body?.trim() || definition.fallback.body),
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
}): Promise<{ supabaseSync?: SupabaseAuthSyncResult }> {
  const template = {
    subject: brandedSubject(rebrand(params.subject.trim())),
    body: rebrand(params.body.trim()),
  };
  await setSetting(
    emailTemplateSettingKey(params.id),
    template,
    params.updatedByAdminId,
  );
  if (!isSupabaseAuthEmailTemplate(params.id)) return {};

  const supabaseSync = await syncSupabaseAuthEmailTemplate({
    id: params.id,
    template,
  });
  return { supabaseSync };
}

export async function sendTransactionalEmail(params: {
  id: EmailTemplateId;
  to: string;
  variables: Record<string, string>;
  attachments?: EmailAttachment[];
  idempotencyKey?: string;
  /** Where the template's button leads, when the caller knows better. */
  actionUrl?: string;
}): Promise<SendEmailResult> {
  const template = await getEmailTemplate(params.id);
  const rendered = renderEmailTemplateText(template, params.variables);
  const definition = getEmailTemplateDefinition(params.id);
  // A template carries a button when its definition names one. The address
  // is the caller's when it passed one, otherwise the page the template has
  // always led to.
  const action = definition.actionLabel
    ? {
        actionLabel: definition.actionLabel,
        actionUrl:
          params.actionUrl ??
          (params.id === "signup_confirmation"
            ? siteUrl("/login")
            : siteUrl("/reset-password")),
      }
    : undefined;
  return sendEmail({
    to: params.to,
    subject: rendered.subject,
    // The button exists only in the HTML part, so the plain-text alternative
    // repeats the address; otherwise a text-only client loses the link.
    text: action
      ? `${rendered.body}\n\n${action.actionLabel}: ${action.actionUrl}`
      : rendered.body,
    attachments: params.attachments,
    idempotencyKey: params.idempotencyKey,
    html: emailTextToHtml(rendered.body, action),
  });
}

const TEST_VARIABLES: Record<string, string> = {
  name: "Klára",
  code: "482 916",
  time: "pondělí 3. srpna 2026 v 18:00",
  previous_time: "neděle 2. srpna 2026 v 9:00",
  duration: "75 minut",
  price: "229 Kč",
  reason: "Úprava provozní doby",
  loyalty:
    "Toto je váš 7. započítaný vstup, do vstupu zdarma zbývají 3 vstupy.",
  number: "2026-0042",
  amount: "229 Kč",
  date: "3. srpna 2026",
  event: "Nová rezervace",
  summary:
    "Klára Nováková si zarezervovala termín na pondělí 3. srpna 2026 v 18:00.",
  detail:
    "Termín: pondělí 3. srpna 2026 v 18:00\nDélka: 75 minut\nZákazník: Klára Nováková\nE-mail: klara@example.com\nTelefon: +420 777 123 456\nCena: 229 Kč",
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

export {
  isSupabaseAuthTemplateSyncConfigured,
  checkSupabaseAuthTemplateSync as getSupabaseAuthSyncStatus,
};
