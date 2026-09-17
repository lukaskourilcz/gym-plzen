import type { Metadata } from "next";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import {
  parseRulesBody,
  RULES_EFFECTIVE_DATE,
  RULES_SUBTITLE,
} from "@/lib/content/rules";
import { Container, Section } from "@/components/ui/container";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Provozní řád",
  description:
    "Provozní řád a smluvní podmínky privátního studia NAVI Private Gym v Plzni.",
  alternates: { canonical: "/provozni-rad" },
};
// CMS text, contacts and the quoted price are read at request time and cached
// briefly, so an admin change or a price period switch never waits for a deploy.
export const revalidate = 300;

/** Structured operating rules; the approved clause copy remains CMS content. */
export default async function RulesPage() {
  const content = await loadSiteContent();
  const body = content.get("home.rules.body");
  const sections = parseRulesBody(body);

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} />
      <main id="main-content" tabIndex={-1}>
        <Section className="pb-12 pt-14 sm:pb-16 sm:pt-20">
          <Container>
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
                Dokument studia
              </p>
              <h1 className="mt-3 text-4xl font-extrabold tracking-[-.01em] sm:text-5xl lg:text-6xl">
                {content.get("home.rules.title")}
              </h1>
              <p className="mt-4 text-xl font-bold leading-8 sm:text-2xl">
                {RULES_SUBTITLE}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                (Dále jen „Provozní řád“)
              </p>
              <div className="mt-8 border-y border-border py-4 text-sm leading-6">
                Tento provozní řád je platný a účinný od: {RULES_EFFECTIVE_DATE}
              </div>
            </div>
          </Container>
        </Section>

        <Section className="border-t border-border bg-card py-12 sm:py-16">
          <Container className="lg:grid lg:grid-cols-[15rem_minmax(0,45rem)] lg:items-start lg:gap-16">
            {sections.length > 0 ? (
              <nav
                aria-label="Obsah provozního řádu"
                className="border-b border-border pb-8 lg:sticky lg:top-28 lg:border-b-0 lg:pb-0"
              >
                <h2 className="text-sm font-extrabold uppercase tracking-[.1em] text-accent-foreground">
                  Obsah dokumentu
                </h2>
                <ol className="mt-3 grid sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-1 lg:gap-x-0">
                  {sections.map((section) => (
                    <li key={section.number}>
                      <a
                        href={`#bod-${section.number}`}
                        className="flex min-h-11 items-center border-t border-border/70 py-2 text-sm font-bold leading-5 transition-colors hover:text-accent-foreground"
                      >
                        <span className="mr-3 text-accent-foreground">
                          {section.number.padStart(2, "0")}
                        </span>
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}

            <article className="mt-10 min-w-0 lg:mt-0">
              {sections.length > 0 ? (
                sections.map((section) => (
                  <section
                    key={section.number}
                    id={`bod-${section.number}`}
                    aria-labelledby={`bod-${section.number}-title`}
                    className="scroll-mt-28 border-t border-border py-10 first:border-t-0 first:pt-0 sm:py-12"
                  >
                    <div className="grid gap-2 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-4">
                      <span
                        aria-hidden="true"
                        className="text-sm font-extrabold text-accent-foreground sm:pt-2"
                      >
                        {section.number.padStart(2, "0")}
                      </span>
                      <h2
                        id={`bod-${section.number}-title`}
                        className="text-2xl font-extrabold leading-tight tracking-[-.01em] sm:text-3xl"
                      >
                        {section.title}
                      </h2>
                    </div>
                    <ol className="mt-7 grid gap-6 sm:ml-16">
                      {section.clauses.map((clause) => (
                        <li
                          key={clause.number}
                          className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3"
                        >
                          <span className="font-extrabold leading-7 text-accent-foreground">
                            {clause.number}.
                          </span>
                          <p className="min-w-0 break-words leading-7 text-muted-foreground">
                            {clause.text}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))
              ) : (
                <div className="grid gap-5">
                  {body
                    .split(/\n{2,}/)
                    .map((paragraph) => paragraph.trim())
                    .filter(Boolean)
                    .map((paragraph) => (
                      <p
                        key={paragraph}
                        className="leading-7 text-muted-foreground"
                      >
                        {paragraph}
                      </p>
                    ))}
                </div>
              )}
            </article>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
