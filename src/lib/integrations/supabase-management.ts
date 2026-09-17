import {
  EMAIL_BRAND,
  emailTextToHtml,
  getEmailTemplateDefinition,
  renderEmailTemplateText,
  SUPABASE_AUTH_TEMPLATE_IDS,
  type EmailTemplate,
  type EmailTemplateId,
  type SupabaseAuthSyncResult,
  type SupabaseAuthSyncStatus,
  type SupabaseAuthTemplateId,
} from "@/lib/config/email-templates";
import { env } from "@/lib/env";
import { HttpError, httpRequest } from "@/lib/helpers/http";
import { logger } from "@/lib/helpers/logger";

const MANAGEMENT_API = "https://api.supabase.com/v1";

const SUPABASE_AUTH_TEMPLATE_FIELDS: Record<
  SupabaseAuthTemplateId,
  { subject: string; content: string; otpType: "email" | "recovery" }
> = {
  signup_confirmation: {
    subject: "mailer_subjects_confirmation",
    content: "mailer_templates_confirmation_content",
    otpType: "email",
  },
  password_reset: {
    subject: "mailer_subjects_recovery",
    content: "mailer_templates_recovery_content",
    otpType: "recovery",
  },
};

/**
 * The link the hosted template carries. Not `{{ .ConfirmationURL }}`: that one
 * only completes in the browser that started the sign-up (PKCE), so a link
 * opened in the Gmail app or on another device ended on the login page with
 * an error. `/auth/confirm` verifies the token hash on the server instead and
 * starts the session wherever the link was opened; `{{ .RedirectTo }}` keeps
 * the destination the sign-up asked for.
 */
export function supabaseAuthActionUrl(id: SupabaseAuthTemplateId): string {
  return `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${SUPABASE_AUTH_TEMPLATE_FIELDS[id].otpType}&redirect_to={{ .RedirectTo }}`;
}

function isSupabaseAuthTemplateId(
  id: EmailTemplateId,
): id is SupabaseAuthTemplateId {
  return (SUPABASE_AUTH_TEMPLATE_IDS as readonly string[]).includes(id);
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

function credentials(): { ref: string; token: string } | null {
  const ref = projectRef();
  const token = env.SUPABASE_MANAGEMENT_API_TOKEN;
  return ref && token ? { ref, token } : null;
}

export function isSupabaseAuthTemplateSyncConfigured(): boolean {
  return credentials() !== null;
}

function authConfigUrl(ref: string): string {
  return `${MANAGEMENT_API}/projects/${ref}/config/auth`;
}

/**
 * The Management API answers errors as `{ message }`. Keep the status and a
 * short message so the administration can say why a save did not reach the
 * hosted templates, instead of a bare "failed".
 */
function failure(error: unknown): { status?: number; detail?: string } {
  if (error instanceof HttpError) {
    const body = error.body;
    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : typeof body === "string"
          ? body
          : undefined;
    return {
      status: error.status,
      detail: message?.trim().slice(0, 200) || undefined,
    };
  }
  return {
    detail: error instanceof Error ? error.message.slice(0, 200) : undefined,
  };
}

/**
 * Hosted Supabase Auth owns sign-up and recovery delivery. A server-only
 * Management API token lets the admin's plain-language editor update those
 * hosted templates without exposing Supabase account credentials in the UI.
 */
export async function syncSupabaseAuthEmailTemplate(params: {
  id: EmailTemplateId;
  template: EmailTemplate;
}): Promise<SupabaseAuthSyncResult> {
  if (!isSupabaseAuthTemplateId(params.id)) return { synced: true };

  const auth = credentials();
  if (!auth) return { synced: false, reason: "not_configured" };

  const definition = getEmailTemplateDefinition(params.id);
  const rendered = renderEmailTemplateText(params.template, {
    name: "{{ if .Data.full_name }}{{ .Data.full_name }}{{ else }}{{ .Email }}{{ end }}",
  });
  const fields = SUPABASE_AUTH_TEMPLATE_FIELDS[params.id];
  const body = emailTextToHtml(rendered.body, {
    actionUrl: supabaseAuthActionUrl(params.id),
    actionLabel: definition.actionLabel,
  });

  try {
    await httpRequest(authConfigUrl(auth.ref), {
      method: "PATCH",
      headers: { authorization: `Bearer ${auth.token}` },
      json: {
        [fields.subject]: rendered.subject,
        [fields.content]: body,
        // The hosted SMTP sender name is part of the brand too.
        smtp_sender_name: EMAIL_BRAND,
      },
      timeoutMs: 15_000,
    });
    return { synced: true };
  } catch (error) {
    const detail = failure(error);
    logger.error(error, {
      where: "supabase-management.syncAuthEmailTemplate",
      template: params.id,
      ...detail,
    });
    return { synced: false, reason: "request_failed", ...detail };
  }
}

/** Every template we write carries our link; Supabase's defaults never do. */
function carriesOurLink(content: unknown, otpType: string): boolean {
  return (
    typeof content === "string" &&
    content.includes("/auth/confirm?token_hash=") &&
    content.includes(`type=${otpType}`)
  );
}

/**
 * Read the hosted auth config: proves the token works for this project and
 * tells which templates already carry our confirmation link. The
 * administration shows the outcome, so an operator never has to guess why an
 * e-mail still arrives as Supabase's English default.
 */
export async function checkSupabaseAuthTemplateSync(): Promise<SupabaseAuthSyncStatus> {
  const auth = credentials();
  if (!auth) return { configured: false };
  try {
    const config = await httpRequest<Record<string, unknown> | null>(
      authConfigUrl(auth.ref),
      {
        headers: { authorization: `Bearer ${auth.token}` },
        timeoutMs: 8_000,
      },
    );
    const synced = Object.fromEntries(
      SUPABASE_AUTH_TEMPLATE_IDS.map((id) => [
        id,
        carriesOurLink(
          config?.[SUPABASE_AUTH_TEMPLATE_FIELDS[id].content],
          SUPABASE_AUTH_TEMPLATE_FIELDS[id].otpType,
        ),
      ]),
    ) as Record<SupabaseAuthTemplateId, boolean>;
    const sender = config?.smtp_sender_name;
    return {
      configured: true,
      ok: true,
      synced,
      senderName: typeof sender === "string" && sender.trim() ? sender : null,
    };
  } catch (error) {
    const detail = failure(error);
    logger.warn("Supabase Management API rejected the configured token", {
      where: "supabase-management.checkAuthTemplateSync",
      ...detail,
    });
    return { configured: true, ok: false, ...detail };
  }
}
