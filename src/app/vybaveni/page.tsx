import type { Metadata } from "next";
import Image from "next/image";
import {
  footerProps,
  loadSiteContent,
  type SiteContentKey,
} from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { LotusMark } from "@/components/site/brand";
import { cn } from "@/lib/utils";

const PHOTO =
  "https://static.wixstatic.com/media/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg/v1/fill/w_1600,h_900,al_c,q_90,enc_avif,quality_auto/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg";

export const metadata: Metadata = {
  title: "Vybavení a prostor",
  description: "Informace a fotografie prostoru NAVI Private Gym v Plzni.",
  alternates: { canonical: "/vybaveni" },
};

export default async function EquipmentPage() {
  const content = await loadSiteContent();
  const zones = Array.from({ length: 6 }, (_, index) => {
    const number = index + 1;
    return {
      title: content.get(`equipment.zone${number}.title` as SiteContentKey),
      body: content.get(`equipment.zone${number}.body` as SiteContentKey),
    };
  });
  return (
    <>
      <SiteHeader brand={content.get("brand.name")} />
      <main id="main-content" tabIndex={-1}>
        <Section className="pt-14 sm:pt-20">
          <Container>
            <div>
              <p
                data-eyebrow
                className="text-xs font-extrabold uppercase tracking-[.16em] text-accent-foreground"
              >
                {content.get("equipment.eyebrow")}
              </p>
              <h1 className="mt-4 text-4xl font-extrabold tracking-[-.01em] sm:text-6xl">
                {content.get("equipment.title")}
              </h1>
            </div>
            <div className="relative mt-12 aspect-[16/9] overflow-hidden rounded-lg bg-muted">
              <Image
                src={PHOTO}
                alt={content.get("equipment.imageAlt")}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            </div>

            <h2 className="mt-16 text-3xl font-extrabold tracking-[-.01em] sm:text-4xl">
              {content.get("equipment.zonesTitle")}
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
              {content.get("equipment.zonesIntro")}
            </p>
            <ul className="mt-8 grid gap-5 lg:grid-cols-2">
              {zones.map((zone, index) => (
                <li
                  key={zone.title}
                  /* Gold titles are a modern touch, and only legible on ink. */
                  data-zone={index % 2 === 0 ? "ink" : "soft"}
                  className={cn(
                    "grid overflow-hidden rounded-lg sm:grid-cols-2",
                    index % 2 === 0
                      ? "bg-ink text-ink-foreground"
                      : "bg-sage-soft text-sage-foreground",
                  )}
                >
                  <div className="p-7">
                    <h3
                      data-zone-title
                      className="text-xl font-extrabold uppercase tracking-[.05em]"
                    >
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
