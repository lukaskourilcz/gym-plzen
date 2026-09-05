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
import { BrandMark } from "@/components/site/brand";
import { IllustrativePhoto } from "@/components/site/illustrative-photo";
import { cn } from "@/lib/utils";
import {
  DEFAULT_HERO_IMAGE_URL,
  DEFAULT_ZONE_IMAGE_URLS,
} from "@/lib/config/branding";

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
                src={DEFAULT_HERO_IMAGE_URL}
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
                  <IllustrativePhoto
                    src={
                      content.zoneImageUrls[index] ||
                      DEFAULT_ZONE_IMAGE_URLS[index]!
                    }
                    alt={zone.title}
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
                    illustrative={content.illustrativePhotos}
                    className={cn(
                      "min-h-44",
                      index % 2 === 0 ? "bg-ink-elevated" : "bg-sage",
                    )}
                  >
                    <div
                      aria-hidden="true"
                      className={cn(
                        "grid min-h-44 place-items-center",
                        index % 2 === 0 ? "bg-ink-elevated" : "bg-sage",
                      )}
                    >
                      <BrandMark decorative className="size-16 opacity-30" />
                    </div>
                  </IllustrativePhoto>
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
