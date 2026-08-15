import type { Metadata } from "next";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { Notice } from "@/components/ui/notice";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Ochrana soukromí",
  robots: { index: false, follow: true },
};

export default async function PrivacyPage() {
  const content = await loadSiteContent();
  return (
    <>
      <SiteHeader brand={content.get("brand.name")} />
      <main id="main-content" tabIndex={-1}>
        <Section>
          <Container className="max-w-3xl">
            <h1 className="text-4xl font-extrabold tracking-[-.01em] sm:text-5xl">
              Ochrana soukromí
            </h1>
            <Notice
              tone="warning"
              title="Dokument čeká na schválení provozovatelem"
              className="mt-8"
            >
              Finální informace o zpracování osobních údajů musí provozovatel
              doplnit a právně ověřit před spuštěním služby. Tato stránka proto
              není indexována.
            </Notice>
            <section className="mt-12 border-t border-border pt-8">
              <h2 className="text-2xl font-extrabold">Analytické cookies</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
                <p>
                  Návštěvnost webu měříme pomocí Google Analytics 4 (ID měření
                  G-6L9N41NKT8). Google tag se načte až poté, co návštěvník
                  výslovně povolí analytiku v cookie liště.
                </p>
                <p>
                  Reklamní úložiště, předávání údajů pro reklamu a personalizace
                  reklam zůstávají vypnuté. Volbu lze kdykoliv změnit odkazem
                  „Nastavení cookies“ v patičce webu.
                </p>
              </div>
            </section>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
