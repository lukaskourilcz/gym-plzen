import { cms } from "@/lib/services";
import {
  DEFAULT_SMS_ACCESS_TEMPLATE,
  LOGO_URL_KEY,
  SMS_ACCESS_TEMPLATE_KEY,
  TERMS_URL_KEY,
} from "@/lib/config/branding";
import { BrandingForm, FileUploader, SmsTemplateForm } from "./settings-forms";

export const metadata = { title: "Nastavení a branding" };

/**
 * Settings & branding admin — configure the front-end form assets (logo, terms
 * PDF) and the message templates. Assets are uploaded to Supabase Storage via
 * the uploader; the returned URL is saved on the branding form.
 */
export default async function SettingsPage() {
  const [logoUrl, termsUrl, smsTemplate] = await Promise.all([
    cms.getSetting<string>(LOGO_URL_KEY),
    cms.getSetting<string>(TERMS_URL_KEY),
    cms.getSetting<string>(SMS_ACCESS_TEMPLATE_KEY),
  ]);

  return (
    <div>
      <h1>Nastavení a branding</h1>
      <p style={{ color: "var(--muted)" }}>
        Zde nastavíte logo, obchodní podmínky (PDF) a texty zpráv, které se
        zobrazují ve frontendu a posílají zákazníkům.
      </p>

      <section style={{ marginTop: "1.5rem", maxWidth: 560 }}>
        <h2>Logo a obchodní podmínky</h2>
        <BrandingForm logoUrl={logoUrl ?? ""} termsUrl={termsUrl ?? ""} />
      </section>

      <section style={{ marginTop: "2rem", maxWidth: 560 }}>
        <h2>Nahrát soubor</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Nahrajte logo, PDF podmínek nebo fotku. Po nahrání dostanete URL, kterou
          vložíte výše (logo / podmínky) nebo do obsahu webu.
        </p>
        <FileUploader />
      </section>

      <section style={{ marginTop: "2rem", maxWidth: 560 }}>
        <h2>Šablony zpráv</h2>
        <SmsTemplateForm template={smsTemplate ?? DEFAULT_SMS_ACCESS_TEMPLATE} />
      </section>
    </div>
  );
}
