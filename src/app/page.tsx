import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Check, Clock3, ImageIcon, MapPin } from "lucide-react";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { cn } from "@/lib/utils";
import {
  formatMoney,
  formatTimeRange,
  minutesToHHmm,
} from "@/lib/helpers/format";
import { addDaysToDateKey, dateKeyInTimeZone } from "@/lib/helpers/datetime";
import { getSlotsForRange } from "@/lib/services/slots";
import { cms } from "@/lib/services";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
  DEFAULT_SLOT_MINUTES,
} from "@/lib/config/schedule";
import {
  DEFAULT_HERO_PREVIEW_DAYS,
  HERO_PREVIEW_DAYS_KEY,
  clampHeroPreviewDays,
} from "@/lib/config/hero";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { LotusMark } from "@/components/site/brand";
import {
  HeroAvailability,
  type HeroAvailabilityDay,
} from "@/components/site/hero-availability";

const ADDRESS = "Křížkova 424/23, 301 00 Plzeň 1";
const PUBLISHED_GYM_PHOTO =
  "https://static.wixstatic.com/media/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg/v1/fill/w_1600,h_900,al_c,q_90,enc_avif,quality_auto/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg";

const OPENING_HOURS = `${minutesToHHmm(DEFAULT_OPEN_MINUTE)}–${minutesToHHmm(
  DEFAULT_CLOSE_MINUTE,
)}`;

/**
 * Fixed brand copy, deliberately NOT read from the CMS. The `home.hero.*`
 * blocks were seeded with older wording, and a seeded row overrides the code
 * default, so the hero would keep rendering the superseded headline.
 */
const HERO_TITLE = "Tvůj čas. Tvůj prostor. Tvoje Namasté";
const HERO_SUBTITLE =
  "Rezervujte si prémiové soukromé samoobslužné fitness v Plzni.";

/*
 * Desktop hero sizing, expressed as a literal Tailwind arbitrary value so the
 * class is statically scannable. Header (68px + 1px border) plus hero fill the
 * first viewport exactly, so nothing else shows above the fold and the facts
 * strip is the first thing revealed on scroll. Applied from `lg` only; on
 * smaller screens the hero content is taller than the viewport anyway.
 */

/** Six operating steps, all editable in the admin under "Obsah webu". */
const STEP_KEYS = [
  ["home.about.step1.title", "home.about.step1.body"],
  ["home.about.step2.title", "home.about.step2.body"],
  ["home.about.step3.title", "home.about.step3.body"],
  ["home.about.step4.title", "home.about.step4.body"],
  ["home.about.step5.title", "home.about.step5.body"],
  ["home.about.step6.title", "home.about.step6.body"],
] as const;

/** Divider rules for the four facts: horizontal stacked, vertical in a row. */
const FACT_BORDERS = [
  "",
  "border-t sm:border-t-0 sm:border-l",
  "border-t lg:border-t-0 lg:border-l",
  "border-t sm:border-l lg:border-t-0",
] as const;

export const metadata: Metadata = {
  title: "Soukromý gym v Plzni",
  description:
    "NAMASTÉ Private Gym je soukromý prostor v Plzni. Vyberte termín online, zaplaťte bezpečně a obdržíte pokyny ke vstupu.",
  alternates: { canonical: "/" },
};
export const revalidate = 60;

export default async function HomePage() {
  const now = new Date();
  const today = dateKeyInTimeZone(now);
  const [content, heroDaysSetting] = await Promise.all([
    loadSiteContent(),
    cms.getSetting<number>(HERO_PREVIEW_DAYS_KEY).catch(() => null),
  ]);
  const heroPreviewDays = clampHeroPreviewDays(
    heroDaysSetting ?? DEFAULT_HERO_PREVIEW_DAYS,
  );
  const availability = await getSlotsForRange(
    today,
    addDaysToDateKey(today, heroPreviewDays),
    now,
  );
  const t = content.get;
  const brand = t("brand.name");
  const price = formatMoney(content.entryPriceCents);
  const address = t("contact.address").trim() || ADDRESS;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const heroImageUrl = content.heroImageUrl || PUBLISHED_GYM_PHOTO;
  const heroImageAlt =
    content.heroImageAlt || "Prostor NAMASTÉ Private Gym v Plzni";
  const steps = STEP_KEYS.map(([titleKey, bodyKey]) => ({
    title: t(titleKey),
    body: t(bodyKey),
  }));
  const businessJson = {
    "@context": "https://schema.org",
    "@type": "HealthClub",
    name: brand,
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Křížkova 424/23",
      postalCode: "301 00",
      addressLocality: "Plzeň",
      addressCountry: "CZ",
    },
    openingHours: `Mo-Su ${minutesToHHmm(DEFAULT_OPEN_MINUTE)}-${minutesToHHmm(DEFAULT_CLOSE_MINUTE)}`,
  };
  const previewDays: HeroAvailabilityDay[] = availability.days.map(
    (day, index) => ({
      label:
        index === 0
          ? "Dnes"
          : index === 1
            ? "Zítra"
            : new Intl.DateTimeFormat("cs-CZ", {
                weekday: "long",
                day: "numeric",
                timeZone: "UTC",
              }).format(new Date(`${day.dateKey}T12:00:00Z`)),
      dateLabel: day.dateKey,
      slots: day.slots.map((slot) => ({
        label: formatTimeRange(slot.start, slot.end),
        startMs: slot.start.getTime(),
        booked: slot.booked,
      })),
    }),
  );

  return (
    <>
      <SiteHeader brand={brand} />
      <main id="main-content" tabIndex={-1}>
        <section className="relative isolate overflow-hidden bg-ink text-ink-foreground">
          <Image
            src={heroImageUrl}
            alt={heroImageAlt}
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover"
          />
          {/* Solid brand veil: white hero copy must stay legible over any photo. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-ink/88"
          />
          <Container className="grid gap-12 py-14 lg:min-h-[calc(100svh-69px)] lg:grid-cols-[1fr_1fr] lg:content-center lg:items-start lg:gap-8 lg:py-10 xl:gap-12">
            <div>
              <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-[-.01em] sm:text-5xl lg:text-6xl">
                {HERO_TITLE}
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-ink-foreground/75">
                {HERO_SUBTITLE}
              </p>
              <p className="mt-6 flex items-center gap-2 text-sm font-bold text-ink-foreground/85">
                <MapPin aria-hidden="true" className="size-4 text-gold" />
                {address}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[.12em] text-ink-foreground/85">
                <Clock3 aria-hidden="true" className="size-4 text-gold" />
                Otevírací doba {OPENING_HOURS}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button href="/rezervace" size="lg">
                  Vybrat termín <ArrowRight aria-hidden="true" />
                </Button>
                <Button
                  href="/#jak-to-funguje"
                  size="lg"
                  variant="outline"
                  className="border-white/45 text-white hover:bg-white/10 hover:text-white"
                >
                  Jak rezervovat
                </Button>
              </div>
            </div>

            <HeroAvailability
              days={previewDays}
              price={price}
              freeEntryEvery={content.freeEntryEvery}
              source={availability.source}
              nowMs={now.getTime()}
            />
          </Container>
        </section>

        {/* Sits directly below the fold: the first thing revealed on scroll. */}
        <div className="border-b border-border bg-background">
          <Container className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: OPENING_HOURS, label: "otevírací doba" },
              { value: "Dětský koutek", label: "plně vybavený s pískovištěm" },
              { value: "Kardio & strečink", label: "a silová zóna" },
              { value: "Komfortní zázemí", label: "plná lednice, relax zóna" },
            ].map((item, index) => (
              <div
                key={item.value}
                className={cn(
                  // The first cell keeps the container gutter so its value
                  // lines up with the hero heading above it.
                  "flex flex-col justify-center border-border py-7 sm:px-6 sm:first:pl-0",
                  FACT_BORDERS[index],
                )}
              >
                <div className="text-lg font-extrabold">{item.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {item.label}
                </div>
              </div>
            ))}
          </Container>
        </div>

        <Section id="jak-to-funguje" className="bg-sage">
          <Container>
            <h2 className="text-center text-3xl font-extrabold uppercase tracking-[.06em] text-sage-foreground sm:text-4xl">
              {t("home.about.title")}
            </h2>
            <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-md border border-white/25 bg-sage-soft p-7 text-sage-foreground"
                >
                  <h3 className="text-center text-xl font-extrabold uppercase tracking-[.05em]">
                    {step.title}
                  </h3>
                  <p className="mt-5 text-sm leading-6">{step.body}</p>
                  <span className="sr-only">Krok {index + 1}</span>
                </li>
              ))}
            </ol>
          </Container>
        </Section>

        <Section id="cenik" className="bg-ink text-ink-foreground">
          <Container className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-gold">
                Ceník
              </p>
              <h2 className="mt-3 rounded-md bg-white/10 px-5 py-3 text-3xl font-extrabold tracking-[-.01em] text-white sm:text-4xl">
                Jednorázový vstup bez předplatného
              </h2>
              <p className="mt-6 max-w-xl leading-7 text-ink-foreground/75">
                {t("home.pricing.note")}
              </p>
              <ul className="mt-7 grid gap-3 text-sm sm:grid-cols-2">
                {[
                  "Soukromé využití prostoru během rezervace",
                  "Platba online kartou",
                  "Pokyny ke vstupu po potvrzení rezervace",
                  `Každý ${content.freeEntryEvery}. vstup zdarma pro registrované`,
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-gold"
                    />
                    <span className="text-ink-foreground/85">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Gold hairline: charcoal and ink are near-identical in luminance,
                so the card needs a non-hue cue to read as a separate surface. */}
            <div className="border border-gold/40 bg-charcoal p-8 text-charcoal-foreground shadow-md sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-charcoal-foreground/60">
                Jednorázový vstup
              </p>
              <div className="mt-3 text-6xl font-extrabold tracking-[-.01em] text-gold">
                {price}
              </div>
              <p className="mt-4 text-sm leading-6 text-charcoal-foreground/75">
                Rezervujete si {DEFAULT_SLOT_MINUTES}minutové časové okno.
                Přesný začátek a konec uvidíte u každého termínu v kalendáři.
              </p>
              <Button href="/rezervace" size="lg" className="mt-7 w-full">
                Vybrat termín
              </Button>
            </div>
          </Container>
        </Section>

        <Section id="prostor">
          <Container>
            <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
              <SectionHeading
                eyebrow="Prostor"
                title="Podívejte se dovnitř"
                align="left"
              />
              <p className="max-w-xl leading-7 text-muted-foreground lg:justify-self-end">
                Ukázka skutečného prostoru NAMASTÉ. Další fotografie může
                provozovatel doplnit přímo v administraci.
              </p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
              <div className="relative min-h-[420px] overflow-hidden rounded-lg bg-muted lg:min-h-[600px]">
                <Image
                  src={PUBLISHED_GYM_PHOTO}
                  alt="Interiér NAMASTÉ Private Gym"
                  fill
                  sizes="(max-width: 1023px) 100vw, 66vw"
                  className="object-cover"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  "Další pohled na prostor",
                  "Detail tréninkové zóny",
                  "Zázemí a vstup",
                ].map((label) => (
                  <GalleryPlaceholder key={label} label={label} />
                ))}
              </div>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-7">
              <p className="max-w-2xl text-sm text-muted-foreground">
                Konkrétní přehled vybavení zveřejní provozovatel po potvrzení
                finálního seznamu.
              </p>
              <Button href="/vybaveni" variant="outline">
                Informace o vybavení
              </Button>
            </div>
          </Container>
        </Section>

        <Section id="pridej-se" className="bg-ink text-ink-foreground">
          <Container className="flex flex-col items-center gap-8 text-center">
            <h2 className="max-w-3xl text-3xl font-extrabold tracking-[-.01em] sm:text-4xl">
              {t("home.cta.title")}
            </h2>
            <Button href="/rezervace" size="lg">
              Rezervace <ArrowRight aria-hidden="true" />
            </Button>
          </Container>
        </Section>

        <Section id="kontakt" className="pb-10">
          <Container>
            <h2 className="text-center text-3xl font-extrabold tracking-[-.01em] sm:text-5xl">
              Kde nás najdete
            </h2>
          </Container>
        </Section>

        <div className="relative h-[420px] w-full bg-muted sm:h-[520px]">
          <iframe
            title={`Mapa, ${address}`}
            src={mapsEmbedUrl}
            className="absolute inset-0 h-full w-full border-0 grayscale"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
          {/* Brand marker: covers the generic map pin sitting at the centre. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[calc(100%+2px)]"
          >
            <span className="grid size-16 place-items-center rounded-full bg-ink shadow-md ring-4 ring-white/70">
              <LotusMark decorative className="size-9 text-gold" />
            </span>
            <span className="mx-auto block size-0 border-x-8 border-t-[12px] border-x-transparent border-t-ink" />
          </div>
          <Button
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="ink"
            className="absolute bottom-5 left-5 sm:left-8"
          >
            Otevřít v Mapách Google
          </Button>
        </div>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(businessJson).replace(/</g, "\\u003c"),
        }}
      />
      <SiteFooter {...footerProps(content)} />
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <p className="text-xs font-extrabold uppercase tracking-[.16em] text-accent-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-[-.01em] sm:text-5xl">
        {title}
      </h2>
    </div>
  );
}

function GalleryPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/60 p-5 text-center">
      <ImageIcon aria-hidden="true" className="size-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Fotografii doplní provozovatel
      </p>
    </div>
  );
}
