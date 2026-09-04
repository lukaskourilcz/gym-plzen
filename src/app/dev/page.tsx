import type { Metadata } from "next";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { VariantPicker } from "./variant-picker";

export const metadata: Metadata = {
  title: "Náhled vzhledu",
  // Internal tooling: it must never be indexed or followed.
  robots: { index: false, follow: false },
};

/**
 * The only place the Klasický / Moderní switch exists. Choosing here sets a
 * cookie that carries the look across the rest of the site; the control itself
 * appears nowhere else, so a visitor cannot meet it however they arrive.
 *
 * It is a plain page, not a protected one: it reveals a styling toggle, nothing
 * operational and no data. Anything that touches real data stays behind the
 * administration's authentication.
 */
export default async function DesignPreviewPage() {
  const content = await loadSiteContent();

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} logoUrl={content.logoUrl} />
      <main id="main-content" tabIndex={-1}>
        <Section>
          <Container className="max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-accent-foreground">
              Interní náhled
            </p>
            <h1 className="mt-2 text-[38px] font-extrabold tracking-[-.01em]">
              Náhled vzhledu
            </h1>
            <p className="mt-4 leading-7 text-muted-foreground">
              Web umí dvě podoby: <strong>Klasickou</strong>, kterou jste
              schválili, a <strong>Moderní</strong> s výraznější typografií a
              klidnějším rytmem sekcí. Přepínač je jen na této stránce :
              návštěvníci ho nikde na webu neuvidí.
            </p>

            <VariantPicker />

            <p className="mt-8 text-sm leading-6 text-muted-foreground">
              Volba se ukládá do prohlížeče, takže vydrží i po zavření okna a
              nijak neovlivní ostatní. Po výběru se vraťte na úvodní stránku,
              Vybavení nebo do účtu : web se zobrazí ve zvolené podobě. Až se
              rozhodnete, nastavíme ji jako výchozí a tuhle stránku odstraníme.
            </p>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
