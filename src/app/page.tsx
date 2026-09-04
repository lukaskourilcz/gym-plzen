import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Check, Clock3, ImageIcon, MapPin } from "lucide-react";
import {
  footerProps,
  loadSiteContent,
  publicAddress,
  PUBLIC_MAP_QUERY,
} from "@/lib/content/site";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatMoney,
  formatTimeRange,
  minutesToHHmm,
  RANGE_DASH,
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
import { LocationMap } from "@/components/site/location-map";
import { publicEnv } from "@/lib/public-env";
import {
  HeroAvailability,
  type HeroAvailabilityDay,
} from "@/components/site/hero-availability";
import { NewsletterSignup } from "@/components/site/newsletter-signup";

const PUBLISHED_GYM_PHOTO =
  "https://static.wixstatic.com/media/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg/v1/fill/w_1600,h_900,al_c,q_90,enc_avif,quality_auto/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg";
/** Client-supplied interior shot, pinned behind the steps and pricing bands. */
const SECTIONS_PHOTO = "/images/gym-interior.webp";
/** Verified position of the entrance, used as the map's marker. */
const GYM_POSITION = { lat: 49.7550669, lng: 13.3785039 } as const;
const GYM_COORDINATES = `${GYM_POSITION.lat},${GYM_POSITION.lng}`;

const OPENING_HOURS = `${minutesToHHmm(DEFAULT_OPEN_MINUTE).replace(
  /^0/,
  "",
)}${RANGE_DASH}${minutesToHHmm(DEFAULT_CLOSE_MINUTE)}`;

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
    "NAVI Private Gym je soukromý prostor v Plzni. Vyberte termín online, zaplaťte bezpečně a obdržíte pokyny ke vstupu.",
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
  /*
   * The promotion is keyed to when a visitor books, so the note says exactly
   * that. The end date is appended from the configured window rather than
   * written into the copy, where it would go stale.
   */
  const promoNote = content.promoEndsAt
    ? `${t("home.pricing.promoNote")} Akce platí do ${formatDate(content.promoEndsAt)}.`
    : t("home.pricing.promoNote");
  const address = publicAddress(t("contact.address"));
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(PUBLIC_MAP_QUERY)}`;
  /*
   * `q` makes Google render its own marker anchored to the coordinates, so it
   * tracks the map on zoom and pan. An overlay drawn at the centre of the frame
   * only lines up at the initial view and drifts off the address as soon as the
   * visitor moves the map.
   */
  const mapsEmbedUrl = `https://www.google.com/maps?q=${GYM_COORDINATES}&ll=${GYM_COORDINATES}&z=17&output=embed`;
  const heroImageUrl = content.heroImageUrl || PUBLISHED_GYM_PHOTO;
  const heroImageAlt =
    content.heroImageAlt || "Prostor NAVI Private Gym v Plzni";
  const sectionsImageUrl = content.sectionsImageUrl || SECTIONS_PHOTO;
  const steps = STEP_KEYS.map(([titleKey, bodyKey]) => ({
    title: t(titleKey),
    body: t(bodyKey),
  }));
  const ctaQuote = t("home.cta.quote");
  const ctaQuoteSecondLine =
    "otherwise we shall not be able to keep our mind strong and clear.";
  const ctaQuoteBreakIndex = ctaQuote.indexOf(ctaQuoteSecondLine);
  const ctaQuoteFirstLine =
    ctaQuoteBreakIndex > 0
      ? ctaQuote.slice(0, ctaQuoteBreakIndex).trimEnd()
      : ctaQuote;
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
      addressRegion: "Roudná",
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
        price,
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
          <Container
            data-hero
            className="grid gap-12 py-14 lg:min-h-[calc(100svh-var(--header-h)-112px)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:content-center lg:items-center lg:gap-8 lg:py-8 xl:gap-12"
          >
            <div>
              <h1
                data-display="1"
                className="max-w-2xl whitespace-pre-line text-4xl font-extrabold leading-[1.1] tracking-[-.01em] sm:text-5xl lg:text-6xl"
              >
                {t("home.hero.title")}{" "}
                <span className="text-gold">{t("home.hero.titleAccent")}</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-ink-foreground/75">
                {t("home.hero.subtitle")}
              </p>
              <div className="mt-7 grid gap-4 text-sm text-ink-foreground/85 sm:grid-cols-2 sm:gap-6">
                <div className="flex items-center gap-3">
                  <MapPin
                    aria-hidden="true"
                    className="size-6 shrink-0 self-center text-gold"
                  />
                  <div className="leading-5">
                    <span className="block text-xs font-extrabold uppercase tracking-[.12em]">
                      {t("home.hero.addressLabel")}
                    </span>
                    {address.split(",").map((line, index) => (
                      <span
                        key={`${line}-${index}`}
                        className={cn("block font-bold", index === 0 && "mt-1")}
                      >
                        {line.trim()}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock3
                    aria-hidden="true"
                    className="size-6 shrink-0 self-center text-gold"
                  />
                  <div className="leading-5">
                    <span className="block text-xs font-extrabold uppercase tracking-[.12em]">
                      {t("home.hero.hoursLabel")}
                    </span>
                    <span className="mt-1 block font-bold">
                      {OPENING_HOURS}
                    </span>
                    <span className="block font-bold">otevřeno každý den</span>
                  </div>
                </div>
              </div>
              {/*
               * Mobile only. On desktop the persistent header booking button
               * carries the same action, and the client asked for the hero to
               * stay uncluttered there; below `lg` that header button competes
               * with the logo for width, so the hero keeps its own pair.
               */}
              <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2 lg:hidden">
                <Button href="/rezervace" size="lg" className="justify-center">
                  {t("home.hero.primaryCta")}{" "}
                  <ArrowRight data-cta-arrow aria-hidden="true" />
                </Button>
                <Button
                  href="/#jak-to-funguje"
                  size="lg"
                  variant="outline"
                  className="justify-center border-white/45 text-white hover:bg-white/10 hover:text-white"
                >
                  {t("home.hero.secondaryCta")}
                </Button>
              </div>
            </div>

            <HeroAvailability
              days={previewDays}
              source={availability.source}
              nowMs={now.getTime()}
            />
          </Container>
        </section>

        {/* The desktop hero reserves room for this strip so it is visible
            immediately, without requiring the first scroll. */}
        <div className="border-b border-border bg-background">
          <Container className="grid grid-cols-1 border-x border-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                value: t("home.facts.1.title"),
                label: t("home.facts.1.body"),
              },
              {
                value: t("home.facts.2.title"),
                label: t("home.facts.2.body"),
              },
              { value: OPENING_HOURS, label: t("home.facts.3.body") },
              {
                value: t("home.facts.4.title"),
                label: t("home.facts.4.body"),
              },
            ].map((item, index) => (
              <div
                key={item.value}
                className={cn(
                  "flex min-h-28 flex-col items-center justify-center border-border px-4 py-5 text-center",
                  FACT_BORDERS[index],
                )}
              >
                <div data-fact-value className="text-lg font-extrabold">
                  {item.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {item.label}
                </div>
              </div>
            ))}
          </Container>
        </div>

        {/*
         * Steps and pricing share one pinned photograph. The image sits in an
         * absolutely-positioned track and is `sticky top-0 h-svh` inside it, so
         * it stays put while both bands scroll over it. `background-attachment:
         * fixed` would be simpler but breaks on iOS Safari and cannot use
         * next/image.
         */}
        <div className="relative isolate">
          <div
            aria-hidden="true"
            /* No `overflow-hidden` here: it would become the scrollport for the
               sticky child and stop it pinning. */
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="sticky top-[var(--header-h)] h-[calc(100svh-var(--header-h))] w-full">
              <Image
                src={sectionsImageUrl}
                alt=""
                fill
                sizes="100vw"
                className="object-cover"
              />
              {/* Green veil: white copy and the sage tone read over any frame. */}
              <div className="absolute inset-0 bg-ink/82" />
            </div>
          </div>

          <Section
            id="jak-to-funguje"
            /* Paired with the pricing band below: the two read as one block,
               so the seam between them is tighter than a section boundary. */
            className="scroll-mt-[var(--header-h)] pb-8 pt-16 lg:pb-10 lg:pt-20"
          >
            <Container>
              <h2
                data-display="2"
                className="flex items-center justify-center gap-4 text-center text-3xl font-extrabold uppercase tracking-[.04em] text-ink-foreground sm:text-4xl"
              >
                <LotusMark
                  decorative
                  className="size-10 shrink-0 text-gold sm:size-12"
                />
                {t("home.about.title")}
              </h2>
              <ol className="mt-6 grid gap-px overflow-hidden rounded-lg bg-[color-mix(in_srgb,var(--ink)_30%,var(--card))] md:grid-cols-2 lg:grid-cols-3">
                {steps.map((step, index) => (
                  <li
                    key={step.title}
                    className="grid grid-cols-[2.75rem_minmax(0,1fr)] content-start items-start gap-x-4 bg-card px-5 py-6 text-left sm:grid-cols-[3rem_minmax(0,1fr)] sm:px-8 sm:py-7 lg:px-7 lg:py-8 xl:px-9"
                  >
                    <span
                      aria-hidden="true"
                      className="row-span-2 grid size-11 place-items-center rounded-sm bg-gold text-base font-extrabold text-gold-foreground"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="pt-1 text-lg font-extrabold uppercase leading-tight tracking-[.04em] text-accent-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {step.body}
                    </p>
                  </li>
                ))}
              </ol>
            </Container>
          </Section>

          <Section
            id="cenik"
            className="scroll-mt-[var(--header-h)] pb-16 pt-8 text-ink-foreground lg:pb-20 lg:pt-10"
          >
            {/* `items-stretch`: the card is sized to the copy beside it so the
                band reads as one block rather than a short card floating
                against a tall column. */}
            <Container className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-stretch">
              <div>
                <p
                  data-eyebrow
                  className="text-xs font-extrabold uppercase tracking-[.16em] text-gold"
                >
                  {t("home.pricing.eyebrow")}
                </p>
                {/* Three lines in the hero's format, the last one in gold. */}
                <h2
                  data-display="2"
                  className="mt-4 max-w-xl whitespace-pre-line text-3xl font-extrabold leading-[1.15] tracking-[-.01em] sm:text-4xl"
                >
                  {`${t("home.pricing.title")}\n`}
                  <span className="text-gold">
                    {t("home.pricing.titleAccent")}
                  </span>
                </h2>
                {/* Hairline rows echo the divided facts strip and step grid. */}
                <ul className="mt-8 grid border-t border-white/15">
                  {[
                    t("home.pricing.feature1"),
                    t("home.pricing.feature2"),
                    t("home.pricing.feature3"),
                    `Každý ${content.freeEntryEvery}. vstup zdarma pro registrované`,
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-4 border-b border-white/15 py-3.5 text-sm"
                    >
                      <Check
                        aria-hidden="true"
                        className="size-4 shrink-0 text-gold"
                      />
                      <span className="text-ink-foreground/85">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div
                data-testid="pricing-card"
                className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-md"
              >
                <p className="border-b border-border px-7 py-5 text-center text-lg font-extrabold uppercase tracking-[.14em] text-accent-foreground sm:text-xl">
                  {t("home.pricing.cardLabel")}
                </p>
                {/* Grows to fill whatever height the copy column sets. */}
                <div className="flex flex-1 flex-col justify-center border-b border-border px-7 py-12 text-center">
                  <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
                    {/* 60px: the top of the documented display range. */}
                    <span className="text-6xl font-extrabold leading-none tracking-[-.01em] text-gold">
                      {price}
                    </span>
                    <span className="text-base font-bold uppercase tracking-[.1em] text-muted-foreground">
                      / {DEFAULT_SLOT_MINUTES} minut
                    </span>
                  </div>
                  {/*
                   * During a promotion the standard price stays visible, so the
                   * saving is a fact the visitor can check rather than a claim.
                   */}
                  {content.isPromoPrice && (
                    <p className="mt-4 text-sm font-bold text-muted-foreground">
                      <span className="line-through">
                        {formatMoney(content.standardEntryPriceCents)}
                      </span>{" "}
                      <span className="text-accent-foreground">
                        {promoNote}
                      </span>
                    </p>
                  )}
                </div>
                <div className="px-7 py-7 text-center">
                  <Button href="/rezervace" size="lg" className="w-full">
                    {t("home.pricing.button")}{" "}
                    <ArrowRight data-cta-arrow aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </Container>
          </Section>
        </div>

        <Section
          id="prostor"
          className="scroll-mt-[var(--header-h)] lg:flex lg:min-h-[calc(100svh-var(--header-h))] lg:items-center lg:py-12"
        >
          <Container>
            <SectionHeading
              eyebrow={t("home.gallery.eyebrow")}
              title={t("home.gallery.title")}
              align="left"
            />
            <div className="mt-8 grid gap-4 lg:h-[46svh] lg:grid-cols-[1.35fr_.65fr]">
              <div className="relative min-h-[420px] overflow-hidden rounded-lg bg-muted lg:h-full lg:min-h-0">
                <Image
                  src={PUBLISHED_GYM_PHOTO}
                  alt={t("home.gallery.mainImageAlt")}
                  fill
                  sizes="(max-width: 1023px) 100vw, 66vw"
                  className="object-cover"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-3">
                {[
                  t("home.gallery.image2"),
                  t("home.gallery.image3"),
                  t("home.gallery.image4"),
                ].map((label) => (
                  <GalleryPlaceholder key={label} label={label} />
                ))}
              </div>
            </div>
            <div className="mt-7 border-t border-border pt-7">
              <Button href="/vybaveni" variant="outline">
                {t("home.gallery.button")}
              </Button>
            </div>
          </Container>
        </Section>

        <Section id="pridej-se" className="bg-ink text-ink-foreground">
          <Container className="grid gap-6 text-left lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-extrabold tracking-[-.01em] md:whitespace-nowrap lg:text-3xl xl:text-4xl">
                {t("home.cta.title")}
              </h2>
            </div>
            <Button
              href="/rezervace"
              size="lg"
              className="min-w-52 justify-center justify-self-center bg-gold text-gold-foreground hover:bg-gold/90 lg:justify-self-end"
            >
              {t("home.cta.button")}{" "}
              <ArrowRight data-cta-arrow aria-hidden="true" />
            </Button>
          </Container>
        </Section>

        <div
          id="kontakt"
          className="relative h-[480px] w-full scroll-mt-[var(--header-h)] bg-muted sm:h-[540px]"
        >
          <LocationMap
            address={address}
            apiKey={publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
            mapId={publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
            fallbackEmbedUrl={mapsEmbedUrl}
            position={GYM_POSITION}
          />
          <div
            data-testid="location-card"
            className="absolute left-5 top-5 max-w-[calc(100%_-_2.5rem)] border border-border bg-card p-5 shadow-md sm:left-8 sm:top-8 sm:max-w-sm sm:p-6"
          >
            <p className="text-sm font-extrabold uppercase tracking-[.08em] text-accent-foreground">
              {t("home.contact.mapHeading")}
            </p>
            <p className="mt-2 font-bold">{address}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("home.contact.hours").replace("{hours}", OPENING_HOURS)}
            </p>
          </div>
          <Button
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="ink"
            className="absolute bottom-5 left-5 sm:left-8"
          >
            {t("home.contact.mapsButton")}
          </Button>
        </div>

        <section className="bg-ink text-ink-foreground">
          <Container className="grid gap-10 py-12 md:grid-cols-2 md:items-center md:gap-12 lg:py-14">
            <blockquote className="flex items-center gap-5 text-base leading-7 text-ink-foreground/80 md:justify-self-center">
              <LotusMark
                decorative
                className="mt-1 size-14 shrink-0 text-gold sm:size-16"
              />
              <div>
                <p>
                  „{ctaQuoteFirstLine}
                  {ctaQuoteBreakIndex > 0 ? (
                    <>
                      <br />
                      {ctaQuoteSecondLine}
                    </>
                  ) : null}
                  “
                </p>
                <cite className="mt-2 block text-sm font-extrabold not-italic text-gold">
                  {t("home.cta.quoteAuthor")}
                </cite>
              </div>
            </blockquote>
            <div className="border-t border-white/15 pt-8 md:border-l md:border-t-0 md:pl-12 md:pt-0">
              <h2 className="text-2xl font-extrabold sm:text-3xl">
                Chcete se dozvědět novinky ze světa NAVI Private Gym jako první?
              </h2>
              <p className="mt-3 text-sm text-ink-foreground/75">
                Zanechte nám svou e-mailovou adresu.
              </p>
              <NewsletterSignup />
            </div>
          </Container>
        </section>
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
      <p
        data-eyebrow
        className="text-xs font-extrabold uppercase tracking-[.16em] text-accent-foreground"
      >
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
    <div className="flex min-h-44 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/60 p-5 text-center lg:min-h-0">
      <ImageIcon aria-hidden="true" className="size-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Fotografii doplní provozovatel
      </p>
    </div>
  );
}
