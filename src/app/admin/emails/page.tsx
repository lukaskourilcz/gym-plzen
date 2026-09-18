import { emailTemplates } from "@/lib/services";
import {
  EMAIL_BRAND,
  EMAIL_TEMPLATE_DEFINITIONS,
  SUPABASE_AUTH_TEMPLATE_IDS,
  describeSupabaseAuthFailure,
  getEmailTemplateDefinition,
  type EmailTemplate,
  type EmailTemplateId,
  type SupabaseAuthSyncStatus,
} from "@/lib/config/email-templates";
import { PageHeader } from "@/components/admin/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { EmailTemplateForms } from "../settings/email-template-forms";
import { hasDemoAdminSession } from "@/lib/auth/demo";

export const metadata = { title: "E-maily" };
export const dynamic = "force-dynamic";

/**
 * The hosted templates are the one thing on this page an operator cannot see
 * anywhere else: say plainly whether the token works and which template still
 * sends Supabase's English default.
 */
function SupabaseAuthSyncNotice({
  status,
}: {
  status: SupabaseAuthSyncStatus;
}) {
  if (!status.configured)
    return (
      <Notice
        tone="warning"
        role="status"
        title="Šablony Supabase Auth se nepropisují"
        className="mb-6"
      >
        Registrační e-mail a obnova hesla zatím odcházejí z výchozí anglické
        šablony Supabase. Doplňte ve Vercelu serverovou proměnnou
        SUPABASE_MANAGEMENT_API_TOKEN, spusťte nový deployment a obě šablony
        uložte.
      </Notice>
    );
  if (!status.ok)
    return (
      <Notice
        tone="error"
        role="alert"
        title="Propojení se Supabase Auth selhalo"
        className="mb-6"
      >
        Token ve Vercelu se nepodařilo použít
        {describeSupabaseAuthFailure(status)}. Zkontrolujte, že je vytvořený pod
        účtem, ve kterém je projekt, a že běží deployment z doby po jeho
        přidání.
      </Notice>
    );
  const pending = SUPABASE_AUTH_TEMPLATE_IDS.filter(
    (id) => !status.synced[id],
  ).map((id) => getEmailTemplateDefinition(id).label);
  const senderIsBrand = status.senderName === EMAIL_BRAND;
  if (pending.length === 0 && senderIsBrand)
    return (
      <Notice
        tone="success"
        role="status"
        title="Propojení se Supabase Auth funguje"
        className="mb-6"
      >
        Potvrzení registrace i obnova hesla jsou propsané s odkazem, který
        dokončí přihlášení v jakémkoli prohlížeči, a odcházejí jako „
        {EMAIL_BRAND}“.
      </Notice>
    );
  const templatesSentence =
    pending.length === 0
      ? null
      : pending.length === 1
        ? `V Supabase Auth ještě není propsaná šablona ${pending[0]}.`
        : `V Supabase Auth ještě nejsou propsané šablony ${pending.join(", ")}.`;
  const senderSentence = senderIsBrand
    ? null
    : status.senderName
      ? `Odesílatel v Supabase Auth je zatím „${status.senderName}“.`
      : "Odesílatel v Supabase Auth zatím nemá jméno.";
  return (
    <Notice
      tone="warning"
      role="status"
      title="Propojení funguje, zbývá uložit šablony"
      className="mb-6"
    >
      {[templatesSentence, senderSentence].filter(Boolean).join(" ")} Níže
      otevřete „Potvrzení registrace“ i „Obnova hesla“ a u každé klikněte na
      „Uložit šablonu“: propíše se text, odkaz i odesílatel „{EMAIL_BRAND}“.
    </Notice>
  );
}

export default async function EmailsPage() {
  const demo = await hasDemoAdminSession();
  const templates = demo
    ? (Object.fromEntries(
        EMAIL_TEMPLATE_DEFINITIONS.map((template) => [
          template.id,
          template.fallback,
        ]),
      ) as Record<EmailTemplateId, EmailTemplate>)
    : await emailTemplates.getAllEmailTemplates();
  const supabaseAuthSync: SupabaseAuthSyncStatus = demo
    ? { configured: false }
    : await emailTemplates.getSupabaseAuthSyncStatus();

  return (
    <div>
      <PageHeader
        title="E-maily"
        description="České texty, náhledy a testy všech automatických e-mailů. Každý e-mail používá stejné logo NAVI."
      />
      <Card>
        <CardHeader>
          <CardTitle>Automatické e-maily</CardTitle>
          <CardDescription>
            {supabaseAuthSync.configured
              ? "Potvrzení registrace a obnova hesla se po uložení propíšou do Supabase Auth. Rezervace, vstupní kód a storno se odesílají přímo přes Resend. Poslední šablona je interní upozornění pro provozovatele, ne pro zákazníka."
              : "Potvrzení registrace a obnovu hesla posílá Supabase Auth; z administrace se propíšou až po doplnění SUPABASE_MANAGEMENT_API_TOKEN ve Vercelu. Rezervace, vstupní kód a storno se odesílají přímo přes Resend. Poslední šablona je interní upozornění pro provozovatele, ne pro zákazníka."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {demo ? null : <SupabaseAuthSyncNotice status={supabaseAuthSync} />}
          <EmailTemplateForms
            templates={templates}
            supabaseAuthSync={supabaseAuthSync}
          />
        </CardContent>
      </Card>
    </div>
  );
}
