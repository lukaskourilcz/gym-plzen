import type { Metadata } from "next";
import { FAQ_NUMBERS, footerProps, loadSiteContent } from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { BrandMark } from "@/components/site/brand";
import type { SiteContentKey } from "@/lib/content/site";

export const metadata: Metadata = {
  title: "Často kladené otázky",
  description:
    "Odpovědi k rezervaci, platbě, vstupu a poloze NAVI Private Gym.",
  alternates: { canonical: "/faq" },
};
// CMS text, contacts and the quoted price are read at request time and cached
// briefly, so an admin change or a price period switch never waits for a deploy.
export const revalidate = 300;

export default async function FaqPage() {
  const content = await loadSiteContent();
  const items = FAQ_NUMBERS.map((number) => {
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
                    <span
                      aria-hidden="true"
                      className="relative grid size-7 shrink-0 place-items-center"
                    >
                      <BrandMark
                        decorative
                        className="absolute size-7 text-muted-foreground transition-[opacity,scale,color] duration-[220ms] ease-out group-open:scale-75 group-open:opacity-0 motion-safe:group-hover:text-accent-foreground"
                      />
                      <span className="scale-75 text-2xl font-extrabold leading-none text-accent-foreground opacity-0 transition-[opacity,scale] duration-[220ms] ease-out group-open:scale-100 group-open:opacity-100">
                        ?
                      </span>
                    </span>
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
