import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section } from "@/components/ui/container";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { getOperations } from "@/lib/services/operations";
import { isComgateConfigured } from "@/lib/integrations/comgate";

export const metadata: Metadata = {
  title: "Doprava a platba",
  description:
    "Jak zaplatit rezervaci NAVI Private Gym přes Comgate a kde získat pomoc s platbou.",
  alternates: { canonical: "/doprava-a-platba" },
};
// CMS text, contacts and the quoted price are read at request time and cached
// briefly, so an admin change or a price period switch never waits for a deploy.
export const revalidate = 300;

const linkStyle =
  "font-bold underline underline-offset-4 hover:text-accent-foreground";

export default async function PaymentInformationPage() {
  const [content, operations] = await Promise.all([
    loadSiteContent(),
    getOperations(),
  ]);
  const paymentsAvailable = operations.paymentsEnabled && isComgateConfigured();
  return (
    <>
      <SiteHeader brand={content.get("brand.name")} />
      <main id="main-content" tabIndex={-1}>
        <Section className="py-14 sm:py-20">
          <Container className="max-w-3xl">
            <h1 className="text-4xl font-extrabold sm:text-5xl">
              Doprava a platba
            </h1>
            <div className="mt-10 space-y-10 leading-7">
              <section>
                <h2 className="mb-3 text-2xl font-extrabold">
                  Rezervace bez dopravy
                </h2>
                <p>
                  Objednáváte si vstup do soukromého fitness, nikoli fyzické
                  zboží. Doprava se proto neúčtuje. Potvrzení rezervace a
                  informace ke vstupu dostanete elektronicky na e-mail uvedený
                  při rezervaci.
                </p>
              </section>
              <section>
                <h2 className="mb-3 text-2xl font-extrabold">
                  Online platby přes Comgate
                </h2>
                <p>
                  Pro úhradu rezervací využíváme platební bránu společnosti
                  Comgate, a.s. Po dokončení objednávky přejdete na zabezpečenou
                  stránku brány a zvolíte některou z dostupných platebních
                  metod. Údaje pro platbu zadáváte v prostředí brány nebo své
                  banky, nikoli na našem webu.
                </p>
                <p className="mt-3">
                  <a
                    className={linkStyle}
                    href="https://www.comgate.eu/cs/platebni-brana"
                  >
                    Více o platební bráně Comgate
                  </a>
                </p>
                <p className="mt-4 rounded-md border border-border bg-card p-4">
                  {paymentsAvailable
                    ? "Rezervaci můžete zaplatit kartou Visa nebo Mastercard, bankovním převodem a na podporovaných zařízeních také přes Apple Pay nebo Google Pay. Dostupné možnosti uvidíte přímo v platební bráně."
                    : "Online úhrady momentálně nejsou dostupné. Zkuste to prosím později."}
                </p>
              </section>
              <section>
                <h2 className="mb-3 text-2xl font-extrabold">
                  Bankovní tlačítka
                </h2>
                <p>
                  Vyberete svou banku a přejdete do internetového bankovnictví.
                  Přihlásíte se obvyklým způsobem, zkontrolujete předvyplněný
                  platební příkaz a potvrdíte jej. Poté se vrátíte na stránku
                  rezervace. Rezervaci potvrdíme až po ověření úspěšné platby.
                </p>
                <p className="mt-3">
                  <a
                    className={linkStyle}
                    href="https://help.comgate.eu/docs/bankovni-prevody"
                  >
                    Podrobnosti o bankovních převodech
                  </a>
                </p>
              </section>
              <section>
                <h2 className="mb-3 text-2xl font-extrabold">Platba kartou</h2>
                <p>
                  V bráně zvolíte platbu kartou, zadáte číslo karty, platnost a
                  bezpečnostní kód a případně potvrdíte platbu u své banky
                  pomocí 3D Secure. Po návratu na web uvidíte stav rezervace.
                  Údaje o kartě na našem webu neukládáme.
                </p>
                <p className="mt-3">
                  <a
                    className={linkStyle}
                    href="https://help.comgate.eu/docs/platby-kartou"
                  >
                    Podrobnosti o platbách kartou
                  </a>
                </p>
              </section>
              <section>
                <h2 className="mb-3 text-2xl font-extrabold">
                  Dotazy a reklamace k platbě
                </h2>
                <address className="not-italic">
                  Comgate, a.s.
                  <br />
                  Gočárova třída 1754 / 48b
                  <br />
                  Hradec Králové
                  <br />
                  E-mail:{" "}
                  <a className={linkStyle} href="mailto:podpora@comgate.cz">
                    podpora@comgate.cz
                  </a>
                  <br />
                  Telefon:{" "}
                  <a className={linkStyle} href="tel:+420228224267">
                    +420 228 224 267
                  </a>
                </address>
                <p className="mt-4">
                  Dotazy ke vstupu, změnám rezervace a stornu řešte přímo s NAVI
                  Private Gym na{" "}
                  <a
                    className={linkStyle}
                    href={`mailto:${content.get("contact.email")}`}
                  >
                    {content.get("contact.email")}
                  </a>
                  . Podmínky najdete v{" "}
                  <Link className={linkStyle} href="/obchodni-podminky">
                    obchodních podmínkách
                  </Link>
                  .
                </p>
              </section>
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
