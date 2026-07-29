import type { Metadata } from "next";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Provozní řád",
  description: "Pravidla návštěvy NAMASTÉ Private Gym v Plzni.",
  alternates: { canonical: "/provozni-rad" },
};

/** Operating rules. The text itself is CMS content ("home.rules.body"). */
export default async function RulesPage() {
  const content = await loadSiteContent();
  const paragraphs = content
    .get("home.rules.body")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} />
      <main id="main-content" tabIndex={-1}>
        <Section className="pt-14 sm:pt-20">
          <Container className="max-w-3xl">
            <h1 className="text-4xl font-extrabold tracking-[-.01em] sm:text-5xl">
              {content.get("home.rules.title")}
            </h1>
            <div className="mt-8 grid gap-5">
              {paragraphs.map((paragraph) => (
                <p key={paragraph} className="leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
