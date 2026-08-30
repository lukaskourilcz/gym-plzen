import type { Metadata } from "next";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { PreviewToggle } from "./preview-toggle";

export const metadata: Metadata = {
  title: "Náhled vzhledu",
  // Internal tooling: it must never be indexed or followed.
  robots: { index: false, follow: false },
};

/**
 * The hidden entrance to the design preview. Opening this address unlocks the
 * Klasický / Moderní switch in the header for this browser; visitors who never
 * type it see no switch anywhere on the site.
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
              klidnějším rytmem sekcí. Přepínač je schovaný, aby na něj
              nenarazili návštěvníci. Tato stránka ho zapne jen ve vašem
              prohlížeči.
            </p>

            <PreviewToggle />

            <p className="mt-8 text-sm leading-6 text-muted-foreground">
              Volba se ukládá do prohlížeče, takže vydrží i po zavření okna a
              nijak neovlivní ostatní. Až se pro jednu podobu rozhodnete,
              nastavíme ji jako výchozí a přepínač i tuhle stránku odstraníme.
            </p>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
