import type { Metadata } from "next";
import { loadSiteContent } from "@/lib/content/site";
import { formatMoney } from "@/lib/helpers/format";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Časté dotazy",
  description:
    "Odpovědi k rezervaci, platbě, vstupu a poloze NAMASTÉ Private Gym.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const content = await loadSiteContent();
  const price = formatMoney(content.entryPriceCents);
  const items = [
    [
      "Jak si vyberu termín?",
      "V měsíčním kalendáři zvolíte datum a potom konkrétní volný čas. U každého termínu uvidíte začátek, konec, délku a cenu.",
    ],
    [
      "Kolik stojí jednorázový vstup?",
      `Aktuální cena jednorázového vstupu je ${price}. Délka se může lišit podle provozního nastavení a je vždy uvedena u termínu.`,
    ],
    [
      "Jak mohu zaplatit?",
      "Platba probíhá online kartou přes zabezpečenou platební stránku Stripe.",
    ],
    [
      "Jak se dostanu dovnitř?",
      "Po potvrzení rezervace obdržíte osobní vstupní údaje. Použijte je pouze podle pokynů a v čase své rezervace.",
    ],
    [
      "Potřebuji účet?",
      "Ano. Účet propojí rezervaci s platbou a umožní vám najít nadcházející návštěvy na jednom místě.",
    ],
    [
      "Kde se gym nachází?",
      "NAMASTÉ Private Gym najdete na adrese Křížkova 424/23, 301 00 Plzeň 1.",
    ],
  ];
  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} />
      <main>
        <Section className="pt-14 sm:pt-20">
          <Container className="max-w-4xl">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-accent-foreground">
              Informace před návštěvou
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-6xl">
              Časté dotazy
            </h1>
            <div className="mt-10 divide-y divide-border border-y border-border">
              {items.map(([question, answer]) => (
                <details key={question} className="group py-1">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {question}
                    <span
                      aria-hidden="true"
                      className="text-accent-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="max-w-2xl pb-6 leading-7 text-muted-foreground">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 bg-secondary p-6">
              <p className="font-bold">Vyberte datum a volný čas.</p>
              <Button href="/rezervace">Otevřít kalendář</Button>
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
      <SiteFooter
        brand={content.get("brand.name")}
        termsUrl={content.termsUrl}
      />
    </>
  );
}
