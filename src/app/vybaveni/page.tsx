import type { Metadata } from "next";
import Image from "next/image";
import { Camera, ListChecks } from "lucide-react";
import { loadSiteContent } from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

const PHOTO =
  "https://static.wixstatic.com/media/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg/v1/fill/w_1600,h_900,al_c,q_90,enc_avif,quality_auto/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg";

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
                <h1 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-6xl">
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
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Notice title="Skutečné fotografie" className="min-h-32">
                <span className="flex gap-3">
                  <Camera
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-accent-foreground"
                  />
                  Galerii může provozovatel rozšířit v administraci bez změny
                  kódu.
                </span>
              </Notice>
              <Notice
                tone="warning"
                title="Finální seznam se připravuje"
                className="min-h-32"
              >
                <span className="flex gap-3">
                  <ListChecks
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0"
                  />
                  Neuvádíme neověřené stroje, nosnosti ani další parametry.
                </span>
              </Notice>
            </div>
            <div className="mt-10 border-t border-border pt-8">
              <Button href="/rezervace">Vybrat termín</Button>
            </div>
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
