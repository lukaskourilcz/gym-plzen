import { emailTemplates } from "@/lib/services";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  type EmailTemplate,
  type EmailTemplateId,
} from "@/lib/config/email-templates";
import { PageHeader } from "@/components/admin/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmailTemplateForms } from "../settings/email-template-forms";
import { hasDemoAdminSession } from "@/lib/auth/demo";

export const metadata = { title: "E-maily" };
export const dynamic = "force-dynamic";

/** Transactional e-mail copy, preview and delivery diagnostics for operators. */
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
  const supabaseAuthSyncConfigured =
    !demo && emailTemplates.isSupabaseAuthTemplateSyncConfigured();

  return (
    <div>
      <PageHeader
        title="E-maily"
        description="České texty, náhledy a testy všech automatických e-mailů. Každý e-mail používá stejné logo NAVI."
      />
      <Card>
        <CardHeader>
          <CardTitle>Automatické e-maily zákazníkům</CardTitle>
          <CardDescription>
            Potvrzení registrace a obnova hesla se po uložení synchronizují do
            Supabase Auth. Rezervace, vstupní kód a storno se odesílají přímo
            přes Resend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailTemplateForms
            templates={templates}
            supabaseAuthSyncConfigured={supabaseAuthSyncConfigured}
          />
        </CardContent>
      </Card>
    </div>
  );
}
