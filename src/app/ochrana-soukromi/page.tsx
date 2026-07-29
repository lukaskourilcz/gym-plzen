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
            <h1 className="text-4xl font-black tracking-[-.04em] sm:text-5xl">
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
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
