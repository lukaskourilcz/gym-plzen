import {
  emailTextToHtml,
  getEmailTemplateDefinition,
  renderEmailTemplateText,
  type EmailTemplate,
  type EmailTemplateId,
} from "@/lib/config/email-templates";
import { env } from "@/lib/env";
import { logger } from "@/lib/helpers/logger";

const SUPABASE_AUTH_TEMPLATE_FIELDS = {
  signup_confirmation: {
    subject: "mailer_subjects_confirmation",
    content: "mailer_templates_confirmation_content",
  },
  password_reset: {
    subject: "mailer_subjects_recovery",
    content: "mailer_templates_recovery_content",
  },
} as const;

type SupabaseAuthTemplateId = keyof typeof SUPABASE_AUTH_TEMPLATE_FIELDS;

function isSupabaseAuthTemplateId(
  id: EmailTemplateId,
): id is SupabaseAuthTemplateId {
  return id in SUPABASE_AUTH_TEMPLATE_FIELDS;
}

function projectRef(): string | null {
  const url = env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const [ref] = new URL(url).hostname.split(".");
    return ref || null;
  } catch {
    return null;
  }
}

export function isSupabaseAuthTemplateSyncConfigured(): boolean {
  return Boolean(env.SUPABASE_MANAGEMENT_API_TOKEN && projectRef());
}

/**
 * Hosted Supabase Auth owns sign-up and recovery delivery. A server-only
 * Management API token lets the admin's plain-language editor update those
 * hosted templates without exposing Supabase account credentials in the UI.
 */
export async function syncSupabaseAuthEmailTemplate(params: {
  id: EmailTemplateId;
  template: EmailTemplate;
}): Promise<{ synced: boolean; reason?: "not_configured" | "request_failed" }> {
  if (!isSupabaseAuthTemplateId(params.id)) return { synced: true };

  const ref = projectRef();
  const token = env.SUPABASE_MANAGEMENT_API_TOKEN;
  if (!ref || !token) return { synced: false, reason: "not_configured" };

  const definition = getEmailTemplateDefinition(params.id);
  const rendered = renderEmailTemplateText(params.template, {
    name: "{{ if .Data.full_name }}{{ .Data.full_name }}{{ else }}{{ .Email }}{{ end }}",
  });
  const fields = SUPABASE_AUTH_TEMPLATE_FIELDS[params.id];
  const body = emailTextToHtml(rendered.body, {
    actionUrl: "{{ .ConfirmationURL }}",
    actionLabel: definition.actionLabel,
  });

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${ref}/config/auth`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          [fields.subject]: rendered.subject,
          [fields.content]: body,
        }),
      },
    );
    if (response.ok) return { synced: true };

    logger.error(
      new Error(`Supabase Management API returned ${response.status}`),
      {
        where: "supabase-management.syncAuthEmailTemplate",
        template: params.id,
      },
    );
    return { synced: false, reason: "request_failed" };
  } catch (error) {
    logger.error(error, {
      where: "supabase-management.syncAuthEmailTemplate",
      template: params.id,
    });
    return { synced: false, reason: "request_failed" };
  }
}
