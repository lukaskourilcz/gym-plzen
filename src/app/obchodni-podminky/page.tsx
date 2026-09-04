import type { Metadata } from "next";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import {
  DEFAULT_TERMS_BODY,
  TERMS_EFFECTIVE_DATE,
  TERMS_SUBTITLE,
  TERMS_TITLE,
  parseTermsBody,
} from "@/lib/content/terms";
import { Container, Section } from "@/components/ui/container";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Všeobecné obchodní podmínky",
  description:
    "Všeobecné obchodní podmínky samoobslužného studia NAVI Private Gym v Plzni.",
  alternates: { canonical: "/obchodni-podminky" },
};

const INLINE_LINK_PATTERN = /(\[[^\]]+\]\(https?:\/\/[^)]+\))/g;

function linkedText(text: string) {
  return text.split(INLINE_LINK_PATTERN).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    return link ? (
      <a
        key={`${part}-${index}`}
        href={link[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-accent-foreground underline underline-offset-4"
      >
        {link[1]}
      </a>
    ) : (
      part
    );
  });
}

export default async function TermsPage() {
  const content = await loadSiteContent();
  const sections = parseTermsBody(DEFAULT_TERMS_BODY);

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
                {TERMS_TITLE}
              </h1>
              <p className="mt-4 text-xl font-bold leading-8 sm:text-2xl">
                {TERMS_SUBTITLE}
              </p>
              <div className="mt-8 border-y border-border py-4 text-sm leading-6">
                Účinnost od {TERMS_EFFECTIVE_DATE}
              </div>
            </div>
          </Container>
        </Section>

        <Section className="border-t border-border bg-card py-12 sm:py-16">
          <Container className="lg:grid lg:grid-cols-[15rem_minmax(0,45rem)] lg:items-start lg:gap-16">
            <nav
              aria-label="Obsah všeobecných obchodních podmínek"
              className="border-b border-border pb-8 lg:sticky lg:top-28 lg:border-b-0 lg:pb-0"
            >
              <h2 className="text-sm font-extrabold uppercase tracking-[.1em] text-accent-foreground">
                Obsah dokumentu
              </h2>
              <ol className="mt-3 grid sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-1 lg:gap-x-0">
                {sections.map((section) => (
                  <li key={section.number}>
                    <a
                      href={`#clanek-${section.number}`}
                      className="flex min-h-11 items-center border-t border-border/70 py-2 text-sm font-bold leading-5 transition-colors hover:text-accent-foreground"
                    >
                      <span className="mr-3 text-accent-foreground">
                        {section.number}.
                      </span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <article className="mt-10 min-w-0 lg:mt-0">
              {sections.map((section) => (
                <section
                  key={section.number}
                  id={`clanek-${section.number}`}
                  aria-labelledby={`clanek-${section.number}-title`}
                  className="scroll-mt-28 border-t border-border py-10 first:border-t-0 first:pt-0 sm:py-12"
                >
                  <div className="grid gap-2 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-4">
                    <span
                      aria-hidden="true"
                      className="text-sm font-extrabold text-accent-foreground sm:pt-2"
                    >
                      {section.number}.
                    </span>
                    <h2
                      id={`clanek-${section.number}-title`}
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
                        <div className="min-w-0">
                          <p className="whitespace-pre-line break-words leading-7 text-muted-foreground">
                            {linkedText(clause.text)}
                          </p>
                          {clause.subitems.length > 0 ? (
                            <ul className="mt-3 grid gap-2">
                              {clause.subitems.map((item, index) => (
                                <li
                                  key={`${item.marker ?? "line"}-${index}`}
                                  className={
                                    item.marker
                                      ? "grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 leading-7 text-muted-foreground"
                                      : "leading-7 text-muted-foreground"
                                  }
                                >
                                  {item.marker ? (
                                    <>
                                      <span
                                        aria-hidden="true"
                                        className="font-bold text-accent-foreground"
                                      >
                                        {item.marker})
                                      </span>
                                      <span>{linkedText(item.text)}</span>
                                    </>
                                  ) : (
                                    linkedText(item.text)
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </article>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
