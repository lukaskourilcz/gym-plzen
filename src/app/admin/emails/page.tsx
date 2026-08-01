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

export const metadata = { title: "E-maily" };
export const dynamic = "force-dynamic";

/** Transactional e-mail copy, preview and delivery diagnostics for operators. */
export default async function EmailsPage() {
  const templates = await emailTemplates
    .getAllEmailTemplates()
    .catch(
      () =>
        Object.fromEntries(
          EMAIL_TEMPLATE_DEFINITIONS.map((template) => [
            template.id,
            template.fallback,
          ]),
        ) as Record<EmailTemplateId, EmailTemplate>,
    );

  return (
    <div>
      <PageHeader
        title="E-maily"
        description="Texty a náhledy automatických e-mailů. U každé šablony můžete poslat bezpečný test na vlastní adresu."
      />
      <Card>
        <CardHeader>
          <CardTitle>Automatické e-maily zákazníkům</CardTitle>
          <CardDescription>
            Potvrzení rezervace, vstupní kód a storno používají tyto šablony.
            Registraci a obnovu hesla odesílá Supabase Auth přes SMTP; jejich
            nastavení je popsané v MANUAL_STEPS.md.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailTemplateForms templates={templates} />
        </CardContent>
      </Card>
    </div>
  );
}
