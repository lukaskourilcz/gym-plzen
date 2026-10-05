import type { Metadata } from "next";
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
// CMS text, contacts and the quoted price are read at request time and cached
// briefly, so an admin change or a price period switch never waits for a deploy.
export const revalidate = 300;

export default async function EquipmentPage() {
  const content = await loadSiteContent();
  const zones = [0, 1, 2, 5, 4, 3].map((sourceIndex) => {
    const number = sourceIndex + 1;
    return {
      sourceIndex,
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
            <IllustrativePhoto
              src={DEFAULT_HERO_IMAGE_URL}
              alt={content.get("equipment.imageAlt")}
              priority
              sizes="100vw"
              illustrative={content.illustrativePhotos}
              className="mt-12 aspect-[16/9] rounded-lg bg-muted"
            />

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
                    <p className="mt-4 whitespace-pre-line text-sm leading-6 opacity-85">
                      {zone.body}
                    </p>
                  </div>
                  <IllustrativePhoto
                    src={
                      content.zoneImageUrls[zone.sourceIndex] ||
                      DEFAULT_ZONE_IMAGE_URLS[zone.sourceIndex]!
                    }
                    alt={zone.title}
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 25vw"
                    illustrative={content.illustrativePhotos}
                    imageClassName={
                      zone.sourceIndex === 2
                        ? "origin-[72%_25%] object-[center_20%] scale-[1.55] sm:scale-[1.8]"
                        : undefined
                    }
                    className={cn(
                      "min-h-0 sm:aspect-auto sm:min-h-44",
                      index === 0 ? "aspect-[6/5]" : "aspect-[3/4]",
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
