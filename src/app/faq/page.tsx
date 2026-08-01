import type { Metadata } from "next";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { LotusMark } from "@/components/site/brand";
import type { SiteContentKey } from "@/lib/content/site";

export const metadata: Metadata = {
  title: "Často kladené otázky",
  description:
    "Odpovědi k rezervaci, platbě, vstupu a poloze NAMASTÉ Private Gym.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const content = await loadSiteContent();
  const items = Array.from({ length: 20 }, (_, index) => {
    const number = index + 1;
    return {
      question: content.get(`faq.${number}.question` as SiteContentKey),
      answer: content.get(`faq.${number}.answer` as SiteContentKey),
    };
  });
  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} />
      <main id="main-content" tabIndex={-1}>
        <Section className="pt-14 sm:pt-20">
          <Container className="max-w-4xl">
            <h1 className="text-4xl font-extrabold tracking-[-.01em] sm:text-6xl">
              {content.get("faq.title")}
            </h1>
            <div className="mt-10 divide-y divide-border border-y border-border">
              {items.map(({ question, answer }) => (
                <details key={question} className="group py-1">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 py-4 text-lg font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <LotusMark
                      decorative
                      className="size-7 shrink-0 text-muted-foreground transition-[rotate,color] duration-[320ms] ease-brand-spring group-open:rotate-90 group-open:text-accent-foreground motion-safe:group-hover:text-accent-foreground"
                    />
                    {question}
                  </summary>
                  <p className="max-w-2xl pb-6 pl-11 leading-7 text-muted-foreground">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 bg-secondary p-6">
              <p className="font-bold">{content.get("faq.cta")}</p>
              <Button href="/rezervace">{content.get("faq.ctaButton")}</Button>
            </div>
          </Container>
        </Section>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJson).replace(/</g, "\\u003c"),
        }}
      />
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
