import {
  emailDocumentSchema,
  emailDocumentToText,
  mapEmailDocumentText,
  type EmailDocument,
} from "@/lib/config/email-document";
import {
  EMAIL_TEMPLATE_IDS,
  brandedSubject,
  emailTemplateSettingKey,
  emailTemplateToHtml,
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
  type SendEmailParams,
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
  const parsed = emailDocumentSchema.safeParse(saved?.bodyDocument);
  const document = parsed.success
    ? mapEmailDocumentText(parsed.data, rebrand)
    : undefined;
  return {
    subject: brandedSubject(
      rebrand(saved?.subject?.trim() || definition.fallback.subject),
    ),
    body: document
      ? emailDocumentToText(document)
      : rebrand(saved?.body?.trim() || definition.fallback.body),
    ...(document ? { bodyDocument: document } : {}),
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
  bodyDocument?: EmailDocument;
}): Promise<{ supabaseSync?: SupabaseAuthSyncResult }> {
  const document = params.bodyDocument
    ? mapEmailDocumentText(
        emailDocumentSchema.parse(params.bodyDocument),
        rebrand,
      )
    : undefined;
  const template: EmailTemplate = {
    subject: brandedSubject(rebrand(params.subject.trim())),
    body: document
      ? emailDocumentToText(document)
      : rebrand(params.body.trim()),
    ...(document ? { bodyDocument: document } : {}),
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

export interface TransactionalEmailParams {
  id: EmailTemplateId;
  to: string;
  variables: Record<string, string>;
  /** Mandatory transaction facts, appended when an older saved template lacks the variable. */
  requiredSummary?: { variable: string; text: string };
  attachments?: EmailAttachment[];
  idempotencyKey?: string;
  /** Where the template's button leads, when the caller knows better. */
  actionUrl?: string;
}

/** Render once for an outbox; retries reuse these exact bytes. */
export async function prepareTransactionalEmail(
  params: TransactionalEmailParams,
): Promise<SendEmailParams> {
  const template = await getEmailTemplate(params.id);
  const bodyTemplate = { ...template };
  const variables = { ...params.variables };
  if (
    params.requiredSummary &&
    !template.body.includes(`{${params.requiredSummary.variable}}`)
  ) {
    bodyTemplate.body += `\n\n{${params.requiredSummary.variable}}`;
    if (bodyTemplate.bodyDocument)
      bodyTemplate.bodyDocument = {
        type: "doc",
        content: [
          ...bodyTemplate.bodyDocument.content,
          {
            type: "paragraph",
            content: [
              { type: "text", text: `{${params.requiredSummary.variable}}` },
            ],
          },
        ],
      };
    variables[params.requiredSummary.variable] = params.requiredSummary.text;
  }
  const rendered = renderEmailTemplateText(bodyTemplate, variables);
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
  return {
    to: params.to,
    subject: rendered.subject,
    // The button exists only in the HTML part, so the plain-text alternative
    // repeats the address; otherwise a text-only client loses the link.
    text: action
      ? `${rendered.body}\n\n${action.actionLabel}: ${action.actionUrl}`
      : rendered.body,
    attachments: params.attachments,
    idempotencyKey: params.idempotencyKey,
    html: emailTemplateToHtml(bodyTemplate, variables, action),
  };
}

export async function sendTransactionalEmail(
  params: TransactionalEmailParams,
): Promise<SendEmailResult> {
  return sendEmail(await prepareTransactionalEmail(params));
}

const TEST_VARIABLES: Record<string, string> = {
  name: "Klára",
  code: "482 916",
  time: "pondělí 3. srpna 2026 v 18:00",
  previous_time: "neděle 2. srpna 2026 v 9:00",
  duration: "75 minut",
  price: "229 Kč",
  payment_summary: "Úhrada kredity: 100 Kč\nÚhrada platební bránou: 129 Kč",
  price_summary:
    "Původní cena: 259 Kč\nNová cena: 229 Kč\nPřipsaný kredit: 30 Kč",
  reason: "Úprava provozní doby",
  refund_note: "Zaplacených 229 Kč se podle obchodních podmínek nevrací.",
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
