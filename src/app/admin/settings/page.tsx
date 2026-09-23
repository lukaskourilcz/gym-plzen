import { getOperations } from "@/lib/services/operations";
import { getOperatorNotifications } from "@/lib/services/operator-notifications";
import { DEFAULT_OPERATIONS } from "@/lib/config/operations";
import { DEFAULT_OPERATOR_NOTIFICATIONS } from "@/lib/config/operator-notifications";
import { SITE_DEFAULTS } from "@/lib/content/site";
import { OperationsForm } from "./operations-form";
import { OperatorNotificationsForm } from "./notifications-form";
import { cms, invoices } from "@/lib/services";
import { loadSiteContent } from "@/lib/content/site";
import {
  DEFAULT_SMS_ACCESS_TEMPLATE,
  HERO_IMAGE_ALT_KEY,
  HERO_IMAGE_URL_KEY,
  SECTIONS_IMAGE_URL_KEY,
  LOGO_URL_KEY,
  SMS_ACCESS_TEMPLATE_KEY,
  TERMS_URL_KEY,
  DEFAULT_HERO_IMAGE_URL,
  DEFAULT_SECTIONS_IMAGE_URL,
  DEFAULT_GALLERY_IMAGE_URLS,
  DEFAULT_ZONE_IMAGE_URLS,
} from "@/lib/config/branding";
import {
  DEFAULT_BILLING_PROFILE,
  missingBillingFields,
} from "@/lib/config/billing";
import { PageHeader } from "@/components/admin/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  BillingProfileForm,
  BrandingForm,
  FileUploader,
  SitePhotosForm,
  SmsTemplateForm,
} from "./settings-forms";
import { hasDemoAdminSession } from "@/lib/auth/demo";

export const metadata = { title: "Nastavení a branding" };
export const dynamic = "force-dynamic";

/** Configure the front-end assets (logo, terms PDF) and message templates. */
export default async function SettingsPage() {
  const demo = await hasDemoAdminSession();
  const operations = demo ? DEFAULT_OPERATIONS : await getOperations();
  const operatorNotifications = demo
    ? {
        ...DEFAULT_OPERATOR_NOTIFICATIONS,
        recipients: SITE_DEFAULTS["contact.email"],
      }
    : await getOperatorNotifications();
  const [
    logoUrl,
    termsUrl,
    heroImageUrl,
    heroImageAlt,
    sectionsImageUrl,
    smsTemplate,
    siteContent,
    billing,
  ] = demo
    ? [
        null,
        null,
        DEFAULT_HERO_IMAGE_URL,
        "Ilustrační fotografie soukromého fitness",
        DEFAULT_SECTIONS_IMAGE_URL,
        DEFAULT_SMS_ACCESS_TEMPLATE,
        {
          galleryImageUrls: [...DEFAULT_GALLERY_IMAGE_URLS],
          zoneImageUrls: [...DEFAULT_ZONE_IMAGE_URLS],
          illustrativePhotos: true,
        },
        {
          profile: DEFAULT_BILLING_PROFILE,
          missing: missingBillingFields(DEFAULT_BILLING_PROFILE),
          ready: false,
          sendingEnabled: false,
        },
      ]
    : await Promise.all([
        cms.getSetting<string>(LOGO_URL_KEY),
        cms.getSetting<string>(TERMS_URL_KEY),
        cms.getSetting<string>(HERO_IMAGE_URL_KEY),
        cms.getSetting<string>(HERO_IMAGE_ALT_KEY),
        cms.getSetting<string>(SECTIONS_IMAGE_URL_KEY),
        cms.getSetting<string>(SMS_ACCESS_TEMPLATE_KEY),
        loadSiteContent("cs", { strict: true }),
        invoices.getBillingReadiness(),
      ]);

  return (
    <div>
      <PageHeader
        title="Nastavení a branding"
        description="Logo, obchodní podmínky (PDF) a texty zpráv, které se zobrazují ve frontendu a posílají zákazníkům."
      />

      <div className="grid gap-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Rezervace, platby a vstup do studia</CardTitle>
            <CardDescription>
              Jednotlivé fáze spuštění lze zapínat nezávisle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OperationsForm values={operations} />
          </CardContent>
        </Card>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Provozní upozornění</CardTitle>
            <CardDescription>
              Informační e-maily pro provozovatele: co se v systému stalo.
              Zákazníkům tyto zprávy nechodí. Náhled a testovací odeslání
              najdete v sekci E-maily pod šablonou „Upozornění pro
              provozovatele“.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OperatorNotificationsForm values={operatorNotifications} />
          </CardContent>
        </Card>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Logo a obchodní podmínky</CardTitle>
          </CardHeader>
          <CardContent>
            <BrandingForm
              logoUrl={logoUrl ?? ""}
              termsUrl={termsUrl ?? ""}
              heroImageUrl={heroImageUrl || DEFAULT_HERO_IMAGE_URL}
              heroImageAlt={heroImageAlt ?? ""}
              sectionsImageUrl={sectionsImageUrl || DEFAULT_SECTIONS_IMAGE_URL}
            />
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Náhled volných termínů</CardTitle>
            <CardDescription>
              Kalendář na hlavní stránce umožňuje listovat 180 dní dopředu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              První čtyři dny se načtou při otevření stránky. Další dny se
              načítají až po jejich výběru.
            </p>
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Fotografie na webu</CardTitle>
            <CardDescription>
              Galerie na úvodní stránce a fotografie jednotlivých zón. Dokud
              nemáte vlastní snímky, nechte zapnutou informační ikonu
              „Ilustrační foto“.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SitePhotosForm
              gallery={siteContent.galleryImageUrls}
              zones={siteContent.zoneImageUrls}
              illustrative={siteContent.illustrativePhotos}
            />
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Fakturační údaje</CardTitle>
            <CardDescription>
              Údaje, které se tisknou na doklad o zaplacení. Předvyplněné jsou
              podle vašich obchodních podmínek; zkontrolujte je a doplňte DIČ a
              sazbu, pokud jste plátcem DPH. Vystavené doklady najdete v sekci
              Doklady.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BillingProfileForm
              profile={billing.profile}
              sendDocuments={billing.sendingEnabled}
              missing={billing.missing}
            />
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Nahrát soubor</CardTitle>
            <CardDescription>
              Nahrajte logo, PDF podmínek nebo fotku. Po nahrání dostanete URL,
              kterou vložíte výše nebo do obsahu webu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploader />
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Šablony zpráv</CardTitle>
          </CardHeader>
          <CardContent>
            <SmsTemplateForm
              template={smsTemplate ?? DEFAULT_SMS_ACCESS_TEMPLATE}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
