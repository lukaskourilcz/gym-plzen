import type { Metadata } from "next";
import { loadSiteContent } from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { Notice } from "@/components/ui/notice";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Obchodní podmínky",
  robots: { index: false, follow: true },
};

export default async function TermsPage() {
  const content = await loadSiteContent();
  return (
    <>
      <SiteHeader brand={content.get("brand.name")} />
      <main id="main-content" tabIndex={-1}>
        <Section>
          <Container className="max-w-3xl">
            <h1 className="text-4xl font-black tracking-[-.04em] sm:text-5xl">
              Obchodní podmínky
            </h1>
            <Notice
              tone="warning"
              title="Dokument čeká na schválení provozovatelem"
              className="mt-8"
            >
              Finální obchodní a storno podmínky musí provozovatel dodat a
              schválit před přijímáním plateb. Tato stránka proto není
              indexována.
            </Notice>
          </Container>
        </Section>
      </main>
      <SiteFooter
        brand={content.get("brand.name")}
        termsUrl={content.termsUrl}
      />
    </>
  );
}
