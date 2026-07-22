import { cms } from "@/lib/services";
import {
  DEFAULT_SMS_ACCESS_TEMPLATE,
  HERO_IMAGE_ALT_KEY,
  HERO_IMAGE_URL_KEY,
  LOGO_URL_KEY,
  SMS_ACCESS_TEMPLATE_KEY,
  TERMS_URL_KEY,
} from "@/lib/config/branding";
import {
  DEFAULT_HERO_PREVIEW_DAYS,
  HERO_PREVIEW_DAYS_KEY,
  clampHeroPreviewDays,
} from "@/lib/config/hero";
import { PageHeader } from "@/components/admin/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  BrandingForm,
  FileUploader,
  HeroCalendarForm,
  SmsTemplateForm,
} from "./settings-forms";

export const metadata = { title: "Nastavení a branding" };
export const dynamic = "force-dynamic";

/** Configure the front-end assets (logo, terms PDF) and message templates. */
export default async function SettingsPage() {
  const [
    logoUrl,
    termsUrl,
    heroImageUrl,
    heroImageAlt,
    smsTemplate,
    heroPreviewDays,
  ] = await Promise.all([
    cms.getSetting<string>(LOGO_URL_KEY).catch(() => null),
    cms.getSetting<string>(TERMS_URL_KEY).catch(() => null),
    cms.getSetting<string>(HERO_IMAGE_URL_KEY).catch(() => null),
    cms.getSetting<string>(HERO_IMAGE_ALT_KEY).catch(() => null),
    cms.getSetting<string>(SMS_ACCESS_TEMPLATE_KEY).catch(() => null),
    cms.getSetting<number>(HERO_PREVIEW_DAYS_KEY).catch(() => null),
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
            <CardTitle>Logo a obchodní podmínky</CardTitle>
          </CardHeader>
          <CardContent>
            <BrandingForm
              logoUrl={logoUrl ?? ""}
              termsUrl={termsUrl ?? ""}
              heroImageUrl={heroImageUrl ?? ""}
              heroImageAlt={heroImageAlt ?? ""}
            />
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Náhled volných termínů</CardTitle>
            <CardDescription>
              Určete, kolik nejbližších dní lze procházet v kartě dostupnosti na
              hlavní stránce.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HeroCalendarForm
              previewDays={clampHeroPreviewDays(
                heroPreviewDays ?? DEFAULT_HERO_PREVIEW_DAYS,
              )}
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
