import type { Metadata } from "next";
import Image from "next/image";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { LotusMark } from "@/components/site/brand";
import { cn } from "@/lib/utils";

const PHOTO =
  "https://static.wixstatic.com/media/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg/v1/fill/w_1600,h_900,al_c,q_90,enc_avif,quality_auto/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg";

/**
 * Zones the operator has confirmed. Descriptions stay within what the client
 * stated : no unverified machines, loads or counts.
 */
const ZONES = [
  {
    title: "Silová zóna",
    body: "Stroje a pomůcky pro silový trénink máte po celou dobu rezervace jen pro sebe.",
  },
  {
    title: "Kardio zóna",
    body: "Prostor pro rozehřátí i vytrvalostní trénink ve vlastním tempu.",
  },
  {
    title: "Strečink zóna",
    body: "Místo na protažení, mobilitu a zklidnění po tréninku.",
  },
  {
    title: "Zázemí pro děti",
    body: "Plně vybavený dětský koutek s pískovištěm a zahrádkou.",
  },
  {
    title: "Vybavená lednice",
    body: "Plná lednice a automat se svačinou i oblíbenými suplementy.",
  },
  {
    title: "Zázemí pro vás",
    body: "Relax zóna a koupelna se sprchou včetně české přírodní kosmetiky.",
  },
];

export const metadata: Metadata = {
  title: "Vybavení a prostor",
  description: "Informace a fotografie prostoru NAMASTÉ Private Gym v Plzni.",
  alternates: { canonical: "/vybaveni" },
};

export default async function EquipmentPage() {
  const content = await loadSiteContent();
  return (
    <>
      <SiteHeader brand={content.get("brand.name")} />
      <main id="main-content" tabIndex={-1}>
        <Section className="pt-14 sm:pt-20">
          <Container>
            <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.16em] text-accent-foreground">
                  Prostor
                </p>
                <h1 className="mt-4 text-4xl font-extrabold tracking-[-.01em] sm:text-6xl">
                  Vybavení a prostor
                </h1>
              </div>
              <p className="max-w-xl leading-7 text-muted-foreground">
                Zveřejňujeme pouze informace potvrzené provozovatelem. Přesný
                seznam strojů a pomůcek bude na této stránce doplněn po finální
                kontrole.
              </p>
            </div>
            <div className="relative mt-12 aspect-[16/9] overflow-hidden rounded-lg bg-muted">
              <Image
                src={PHOTO}
                alt="Interiér NAMASTÉ Private Gym"
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </div>

            <h2 className="mt-16 text-3xl font-extrabold tracking-[-.01em] sm:text-4xl">
              Jednotlivé zóny
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
              Fotografie jednotlivých zón doplní provozovatel v administraci.
            </p>
            <ul className="mt-8 grid gap-5 lg:grid-cols-2">
              {ZONES.map((zone, index) => (
                <li
                  key={zone.title}
                  className={cn(
                    "grid overflow-hidden rounded-lg sm:grid-cols-2",
                    index % 2 === 0
                      ? "bg-ink text-ink-foreground"
                      : "bg-sage-soft text-sage-foreground",
                  )}
                >
                  <div className="p-7">
                    <h3 className="text-xl font-extrabold uppercase tracking-[.05em]">
                      {zone.title}
                    </h3>
                    <p className="mt-4 text-sm leading-6 opacity-85">
                      {zone.body}
                    </p>
                  </div>
                  <div
                    aria-hidden="true"
                    className={cn(
                      "grid min-h-44 place-items-center",
                      index % 2 === 0 ? "bg-ink-elevated" : "bg-sage",
                    )}
                  >
                    <LotusMark decorative className="size-16 opacity-30" />
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
