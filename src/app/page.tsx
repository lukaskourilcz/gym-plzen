import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CreditCard,
  ImageIcon,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { loadSiteContent } from "@/lib/content/site";
import { formatMoney, formatTimeRange } from "@/lib/helpers/format";
import { addDaysToDateKey, dateKeyInTimeZone } from "@/lib/helpers/datetime";
import { getSlotsForRange } from "@/lib/services/slots";
import { cms } from "@/lib/services";
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
  const email = t("contact.email").trim();
  const phone = t("contact.phone").trim();
  const address = t("contact.address").trim() || ADDRESS;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const heroImageUrl = content.heroImageUrl || PUBLISHED_GYM_PHOTO;
  const heroImageAlt =
    content.heroImageAlt || "Prostor NAMASTÉ Private Gym v Plzni";
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
        <section className="bg-ink text-ink-foreground">
          <Container className="grid min-h-[680px] gap-12 py-14 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:py-20">
            <div className="relative z-10">
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-primary">
                Soukromý gym · Plzeň
              </p>
              <h1 className="mt-5 max-w-2xl text-5xl font-black leading-[.98] tracking-[-.05em] sm:text-6xl lg:text-7xl">
                Celý gym.
                <br />
                Jen pro vás.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-ink-foreground/68">
                Rezervujte si soukromý prostor na konkrétní čas. Online
                zaplatíte a po potvrzení dostanete pokyny ke vstupu.
              </p>
              <p className="mt-5 flex items-center gap-2 text-sm font-bold text-ink-foreground/85">
                <MapPin aria-hidden="true" className="size-4 text-primary" />
                {address}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button href="/rezervace" size="lg">
                  Vybrat termín <ArrowRight aria-hidden="true" />
                </Button>
                <Button
                  href="/#jak-to-funguje"
                  size="lg"
                  variant="outline"
                  className="border-white/25 text-white hover:bg-white/10 hover:text-white"
                >
                  Jak rezervace funguje
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="relative aspect-[16/10] overflow-hidden rounded-sm border border-white/10 bg-ink-muted">
                {heroImageUrl ? (
                  <Image
                    src={heroImageUrl}
                    alt={heroImageAlt}
                    fill
                    priority
                    sizes="(max-width: 1023px) 100vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-center text-white/60">
                    <div>
                      <LotusMark className="mx-auto size-20 text-primary" />
                      <p className="mt-4 text-sm">
                        Fotografie prostoru bude doplněna v administraci.
                      </p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              </div>
              <div className="relative -mt-8 ml-3 sm:ml-10">
                <HeroAvailability
                  days={previewDays}
                  price={price}
                  freeEntryEvery={content.freeEntryEvery}
                  source={availability.source}
                  nowMs={now.getTime()}
                />
              </div>
            </div>
          </Container>
        </section>

        <div className="border-b border-border bg-background">
          <Container className="grid sm:grid-cols-3">
            {[
              ["Soukromí", "prostor je po dobu rezervace váš"],
              [price, "cena jednorázového vstupu"],
              [
                `${content.freeEntryEvery}. vstup`,
                "zdarma v rámci věrnostního programu",
              ],
            ].map(([value, label]) => (
              <div
                key={label}
                className="border-b border-border px-1 py-6 last:border-0 sm:border-b-0 sm:border-l sm:px-6 sm:first:border-l-0"
              >
                <div className="text-xl font-black">{value}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {label}
                </div>
              </div>
            ))}
          </Container>
        </div>

        <Section id="jak-to-funguje">
          <Container>
            <SectionHeading
              eyebrow="Tři kroky"
              title="Od výběru času ke vstupu"
            />
            <ol className="mt-12 grid border-y border-border md:grid-cols-3">
              {[
                {
                  icon: CalendarDays,
                  title: t("home.about.step1.title"),
                  body: t("home.about.step1.body"),
                },
                {
                  icon: CreditCard,
                  title: t("home.about.step2.title"),
                  body: `${t("home.about.step2.body")} Platba probíhá online kartou.`,
                },
                {
                  icon: KeyRound,
                  title: t("home.about.step3.title"),
                  body: t("home.about.step3.body"),
                },
              ].map((step, index) => (
                <li
                  key={step.title}
                  className="relative border-b border-border py-8 last:border-0 md:border-b-0 md:border-l md:px-8 md:first:border-l-0"
                >
                  <div className="flex items-center justify-between">
                    <step.icon
                      aria-hidden="true"
                      className="size-7 text-accent-foreground"
                    />
                    <span className="text-sm font-black text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-8 text-xl font-extrabold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </Container>
        </Section>

        <Section id="cenik" className="bg-secondary/55">
          <Container className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
            <div>
              <SectionHeading
                eyebrow="Ceník"
                title="Jednorázový vstup bez předplatného"
                align="left"
              />
              <p className="mt-5 max-w-xl leading-7 text-muted-foreground">
                {t("home.pricing.note")}
              </p>
              <ul className="mt-7 grid gap-3 text-sm sm:grid-cols-2">
                {[
                  "Soukromé využití prostoru během rezervace",
                  "Platba online kartou",
                  "Pokyny ke vstupu po potvrzení rezervace",
                  `Každý ${content.freeEntryEvery}. vstup zdarma`,
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-accent-foreground"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-ink p-8 text-white shadow-lg">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-white/55">
                Jednorázový vstup
              </p>
              <div className="mt-3 text-6xl font-black tracking-[-.05em] text-primary">
                {price}
              </div>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Přesnou délku uvidíte u každého termínu v kalendáři.
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

        <Section id="pravidla" className="bg-ink text-ink-foreground">
          <Container className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-primary">
                Provoz
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-5xl">
                Férová pravidla
              </h2>
              <p className="mt-6 max-w-xl leading-7 text-white/60">
                {t("home.rules.body")}
              </p>
            </div>
            <div className="grid border border-white/15 sm:grid-cols-3">
              {[
                {
                  icon: CalendarDays,
                  title: "Vstup v rezervovaný čas",
                  body: "Přijďte pouze v čase uvedeném u vaší rezervace.",
                },
                {
                  icon: ShieldCheck,
                  title: "Osobní vstupní kód",
                  body: "Kód nesdílejte a použijte ho podle pokynů k rezervaci.",
                },
                {
                  icon: RotateCcw,
                  title: "Prostor po sobě ukliďte",
                  body: "Vraťte vybavení na místo a otřete použité nářadí.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="border-b border-white/15 p-7 last:border-0 sm:border-b-0 sm:border-l sm:first:border-l-0"
                >
                  <item.icon
                    aria-hidden="true"
                    className="size-7 text-primary"
                  />
                  <h3 className="mt-8 text-lg font-extrabold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/55">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </Section>

        <Section id="kontakt" className="pb-10">
          <Container>
            <SectionHeading eyebrow="Plzeň" title="Kde nás najdete" />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <ContactItem
                icon={MapPin}
                label="Adresa"
                value={address}
                href={mapsUrl}
              />
              {email ? (
                <ContactItem
                  icon={Mail}
                  label="E-mail"
                  value={email}
                  href={`mailto:${email}`}
                />
              ) : null}
              {phone ? (
                <ContactItem
                  icon={Phone}
                  label="Telefon"
                  value={phone}
                  href={`tel:${phone.replace(/\s/g, "")}`}
                />
              ) : null}
            </div>
          </Container>
        </Section>

        <div className="relative h-[420px] w-full bg-muted sm:h-[520px]">
          <iframe
            title={`Mapa, ${address}`}
            src={mapsEmbedUrl}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
          <Button
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="ink"
            className="absolute bottom-5 left-5 text-primary sm:left-8"
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
      <SiteFooter
        brand={brand}
        email={email || undefined}
        phone={phone || undefined}
        termsUrl={content.termsUrl}
      />
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
      <h2 className="mt-3 text-3xl font-black tracking-[-.035em] sm:text-5xl">
        {title}
      </h2>
    </div>
  );
}

function ContactItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex min-h-40 items-center gap-5 rounded-md border border-border bg-card p-6 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-sm bg-primary/12 text-accent-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <span>
        <span className="block text-xs font-extrabold uppercase tracking-[.14em] text-muted-foreground">
          {label}
        </span>
        <span className="mt-2 block font-extrabold">{value}</span>
      </span>
    </a>
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
