import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  Clock3,
  ImageIcon,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import {
  footerProps,
  loadSiteContent,
  publicAddress,
  PUBLIC_MAP_QUERY,
} from "@/lib/content/site";
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

const PUBLISHED_GYM_PHOTO =
  "https://static.wixstatic.com/media/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg/v1/fill/w_1600,h_900,al_c,q_90,enc_avif,quality_auto/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg";
/** Client-supplied interior shot, pinned behind the steps and pricing bands. */
const SECTIONS_PHOTO = "/images/gym-interior.webp";

const OPENING_HOURS = `${minutesToHHmm(DEFAULT_OPEN_MINUTE).replace(
  /^0/,
  "",
)}–${minutesToHHmm(DEFAULT_CLOSE_MINUTE)}`;

/**
 * Fixed brand copy, deliberately NOT read from the CMS. The `home.hero.*`
 * blocks were seeded with older wording, and a seeded row overrides the code
 * default, so the hero would keep rendering the superseded headline.
 */
const HERO_TITLE = "Tvůj čas. Tvůj prostor. Tvoje Namasté.";
const HERO_SUBTITLE =
  "Rezervujte si celé samoobslužné fitness v Plzni jen pro sebe a svůj doprovod.";

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
  const address = publicAddress(t("contact.address"));
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(PUBLIC_MAP_QUERY)}`;
  const mapsEmbedUrl =
    "https://www.google.com/maps?ll=49.7550669,13.3785039&z=17&output=embed";
  const phone = t("contact.phone").trim();
  const email = t("contact.email").trim();
  const heroImageUrl = content.heroImageUrl || PUBLISHED_GYM_PHOTO;
  const heroImageAlt =
    content.heroImageAlt || "Prostor NAMASTÉ Private Gym v Plzni";
  const sectionsImageUrl = content.sectionsImageUrl || SECTIONS_PHOTO;
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
          <Container className="grid gap-12 py-14 lg:min-h-[calc(100svh-var(--header-h)-112px)] lg:grid-cols-[1fr_1fr] lg:content-center lg:items-center lg:gap-8 lg:py-8 xl:gap-12">
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
              <div className="mt-3 flex items-start gap-2 text-sm text-ink-foreground/85">
                <Clock3 aria-hidden="true" className="size-4 text-gold" />
                <div>
                  <span className="block text-xs font-extrabold uppercase tracking-[.12em]">
                    Otevírací doba
                  </span>
                  <span className="mt-1 block font-bold">
                    {OPENING_HOURS} · otevřeno každý den
                  </span>
                </div>
              </div>
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

        {/* The desktop hero reserves room for this strip so it is visible
            immediately, without requiring the first scroll. */}
        <div className="border-b border-border bg-background">
          <Container className="grid grid-cols-1 border-x border-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: OPENING_HOURS, label: "otevřeno každý den" },
              { value: "Dětský koutek", label: "plně vybavený s pískovištěm" },
              {
                value: "Samoobslužné fitness",
                label: "kardio, silová zóna a strečink",
              },
              { value: "Komfortní zázemí", label: "plná lednice, relax zóna" },
            ].map((item, index) => (
              <div
                key={item.value}
                className={cn(
                  "flex min-h-28 flex-col items-center justify-center border-border px-4 py-5 text-center",
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
            className="scroll-mt-[var(--header-h)] py-16 lg:py-20"
          >
            <Container>
              <h2 className="flex items-center justify-center gap-4 text-center text-3xl font-extrabold uppercase tracking-[.04em] text-ink-foreground sm:text-4xl">
                <LotusMark
                  decorative
                  className="size-10 shrink-0 text-gold sm:size-12"
                />
                {t("home.about.title")}
              </h2>
              <ol className="mt-8 grid auto-rows-fr gap-px overflow-hidden rounded-lg bg-white/25 md:grid-cols-2 lg:grid-cols-3">
                {steps.map((step, index) => (
                  <li
                    key={step.title}
                    className="grid h-full grid-rows-[3rem_1fr] items-start gap-4 bg-card p-7 text-center sm:p-8"
                  >
                    <h3 className="flex h-12 items-center justify-center gap-3 text-lg font-extrabold uppercase leading-tight tracking-[.04em] text-accent-foreground">
                      <span
                        aria-hidden="true"
                        className="grid size-11 shrink-0 place-items-center rounded-sm bg-gold text-base font-extrabold tracking-normal text-gold-foreground"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{step.title}</span>
                    </h3>
                    <p className="self-start text-sm leading-6 text-muted-foreground">
                      {step.body}
                    </p>
                  </li>
                ))}
              </ol>
            </Container>
          </Section>

          <Section
            id="cenik"
            className="scroll-mt-[var(--header-h)] py-16 text-ink-foreground lg:py-20"
          >
            <Container className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              <div>
                <p className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-[.16em] text-gold">
                  <LotusMark decorative className="size-6 shrink-0" />
                  Ceník
                </p>
                <h2 className="mt-4 max-w-xl text-3xl font-extrabold uppercase tracking-[.04em] sm:text-4xl">
                  Jednorázový vstup bez předplatného
                </h2>
                <p className="mt-6 max-w-xl leading-7 text-ink-foreground/75">
                  {t("home.pricing.note")}
                </p>
                {/* Hairline rows echo the divided facts strip and step grid. */}
                <ul className="mt-8 grid border-t border-white/15">
                  {[
                    "Soukromé využití prostoru během rezervace",
                    "Platba online kartou",
                    "Pokyny ke vstupu po potvrzení rezervace",
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
                className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-md"
              >
                <p className="border-b border-border px-7 py-4 text-center text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
                  Jednorázový vstup
                </p>
                <div className="border-b border-border px-7 py-10 text-center">
                  <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
                    <span className="text-5xl font-extrabold leading-none tracking-[-.01em] text-gold">
                      {price}
                    </span>
                    <span className="text-sm font-bold uppercase tracking-[.1em] text-muted-foreground">
                      / {DEFAULT_SLOT_MINUTES} minut
                    </span>
                  </div>
                </div>
                <div className="px-7 py-6 text-center">
                  <Button href="/rezervace" size="lg" className="w-full">
                    Rezervovat trénink <ArrowRight aria-hidden="true" />
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
              eyebrow="Prostor"
              title="Podívejte se dovnitř"
              align="left"
            />
            <div className="mt-8 grid gap-4 lg:h-[46svh] lg:grid-cols-[1.35fr_.65fr]">
              <div className="relative min-h-[420px] overflow-hidden rounded-lg bg-muted lg:h-full lg:min-h-0">
                <Image
                  src={PUBLISHED_GYM_PHOTO}
                  alt="Interiér NAMASTÉ Private Gym"
                  fill
                  sizes="(max-width: 1023px) 100vw, 66vw"
                  className="object-cover"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-3">
                {[
                  "Další pohled na prostor",
                  "Detail tréninkové zóny",
                  "Zázemí a vstup",
                ].map((label) => (
                  <GalleryPlaceholder key={label} label={label} />
                ))}
              </div>
            </div>
            <div className="mt-7 border-t border-border pt-7">
              <Button href="/vybaveni" variant="outline">
                Informace o vybavení
              </Button>
            </div>
          </Container>
        </Section>

        <Section id="pridej-se" className="bg-ink text-ink-foreground">
          <Container className="flex flex-col items-center gap-8 text-center sm:flex-row sm:justify-center sm:gap-20">
            <h2 className="max-w-3xl text-3xl font-extrabold tracking-[-.01em] sm:text-4xl">
              {t("home.cta.title")}
            </h2>
            <Button href="/rezervace" size="lg" className="shrink-0">
              Rezervovat <ArrowRight aria-hidden="true" />
            </Button>
          </Container>
        </Section>

        <Section
          id="kontakt"
          className="scroll-mt-[var(--header-h)] border-b border-border py-14 sm:py-16"
        >
          <Container>
            <div className="max-w-2xl">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.16em] text-accent-foreground">
                  Kontakt
                </p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-.01em] sm:text-5xl">
                  Kde nás najdete
                </h2>
              </div>
              <div className="mt-8 grid gap-2">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center gap-3 font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MapPin
                    aria-hidden="true"
                    className="size-5 shrink-0 text-accent-foreground"
                  />
                  {address}
                </a>
                {email ? (
                  <a
                    href={`mailto:${email}`}
                    className="flex min-h-11 items-center gap-3 font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Mail
                      aria-hidden="true"
                      className="size-5 shrink-0 text-accent-foreground"
                    />
                    {email}
                  </a>
                ) : null}
                {phone ? (
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="flex min-h-11 items-center gap-3 font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Phone
                      aria-hidden="true"
                      className="size-5 shrink-0 text-accent-foreground"
                    />
                    {phone}
                  </a>
                ) : null}
              </div>
            </div>
          </Container>
        </Section>

        <div className="relative h-[480px] w-full bg-muted sm:h-[540px]">
          <iframe
            title={`Mapa, ${address}`}
            src={mapsEmbedUrl}
            data-testid="location-map"
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
          <div className="absolute left-5 top-5 max-w-[calc(100%_-_2.5rem)] border border-border bg-card p-5 shadow-md sm:left-8 sm:top-8 sm:max-w-sm sm:p-6">
            <p className="text-sm font-extrabold uppercase tracking-[.08em] text-accent-foreground">
              NAMASTÉ Private Gym
            </p>
            <p className="mt-2 font-bold">{address}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Otevírací doba {OPENING_HOURS}, každý den
            </p>
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
    <div className="flex min-h-44 flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/60 p-5 text-center lg:min-h-0">
      <ImageIcon aria-hidden="true" className="size-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Fotografii doplní provozovatel
      </p>
    </div>
  );
}
