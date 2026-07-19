import Link from "next/link";
import {
  CalendarClock,
  CreditCard,
  KeyRound,
  ShieldCheck,
  MapPin,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  Check,
  Dumbbell,
  DoorOpen,
  Baby,
  Refrigerator,
  Wifi,
  ImageIcon,
} from "lucide-react";
import { loadSiteContent } from "@/lib/content/site";
import { formatMoney, formatTime } from "@/lib/helpers/format";
import { addMinutes } from "@/lib/helpers/datetime";
import { getWeekSlots, mondayOf } from "@/lib/services/slots";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import {
  HeroAvailability,
  type HeroAvailabilityDay,
} from "@/components/site/hero-availability";

// Revalidate so CMS content edits appear without a redeploy.
export const revalidate = 60;

export default async function HomePage() {
  const now = new Date();
  const monday = mondayOf(now);
  const [content, currentWeek, nextWeek] = await Promise.all([
    loadSiteContent(),
    getWeekSlots(monday, now),
    getWeekSlots(addMinutes(monday, 7 * 24 * 60), now),
  ]);
  const t = content.get;
  const brand = t("brand.name");
  const price = formatMoney(content.entryPriceCents);
  const email = t("contact.email");
  const phone = t("contact.phone");
  const configuredAddress = t("contact.address");
  const address =
    configuredAddress === "Plzeň"
      ? "Křížkova 424/23, 301 00 Plzeň 1"
      : configuredAddress;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const combinedDays = [...currentWeek.days, ...nextWeek.days];
  const todayIndex = Math.max(
    0,
    combinedDays.findIndex(
      (day) => day.date.toDateString() === now.toDateString(),
    ),
  );
  const previewDays: HeroAvailabilityDay[] = combinedDays
    .slice(todayIndex, todayIndex + 4)
    .map((day, index) => {
      const firstAvailable = day.slots.findIndex((slot) => slot.available);
      const start =
        index === 0 && firstAvailable > 0
          ? Math.min(firstAvailable, Math.max(0, day.slots.length - 8))
          : 0;
      return {
        label:
          index === 0
            ? "Dnes"
            : index === 1
              ? "Zítra"
              : new Intl.DateTimeFormat("cs-CZ", {
                  weekday: "short",
                  day: "numeric",
                }).format(day.date),
        dateLabel: day.date.toISOString(),
        slots: day.slots
          .slice(start, start + 8)
          .map((slot) => ({
            label: formatTime(slot.start),
            available: slot.available,
          })),
      };
    });

  return (
    <>
      <SiteHeader brand={brand} logoUrl={content.logoUrl} />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-ink text-ink-foreground">
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(oklch(0.97_0.005_260/.035)_1px,transparent_1px),linear-gradient(90deg,oklch(0.97_0.005_260/.035)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="pointer-events-none absolute inset-0 opacity-25 [background:radial-gradient(50%_60%_at_75%_10%,var(--color-primary)_0%,transparent_60%)]" />
          <Container className="relative grid min-h-[640px] gap-14 py-20 sm:py-24 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <div className="mb-5 text-xs font-extrabold uppercase tracking-[.16em] text-primary">
                NAMASTÉ Private Gym
              </div>
              <h1 className="text-5xl font-black leading-[.98] tracking-[-0.04em] sm:text-6xl lg:text-[78px] xl:text-[86px]">
                Celý gym.
                <br />
                Jen <em className="text-primary">pro vás</em>.
              </h1>
              <p className="mt-7 max-w-[520px] text-lg leading-relaxed text-ink-foreground/65 sm:text-xl">
                Pronajměte si celý prostor pro sebe nebo vezměte přátele. Žádné
                čekání na stroje, žádné cizí pohledy. Jen soustředění na váš
                trénink.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button href="/rezervace" size="lg">
                  Rezervovat trénink <ArrowRight />
                </Button>
                <Button
                  href="/#jak-to-funguje"
                  size="lg"
                  variant="outline"
                  className="border-white/25 text-white hover:bg-white/10 hover:text-white"
                >
                  Jak to funguje
                </Button>
              </div>
            </div>

            <div className="lg:w-full lg:max-w-[520px] lg:justify-self-end">
              <HeroAvailability
                days={previewDays}
                price={price}
                freeEntryEvery={content.freeEntryEvery}
                live={currentWeek.source === "live"}
              />
            </div>
          </Container>
          <Container className="relative grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
            {[
              ["06:00–22:00", "otevřeno každý den"],
              ["Privátní prostor", "pro vás i vaše přátele"],
              [price, "za rezervaci, bez závazku"],
              ["Dětský koutek", "bezpečné zázemí pro děti"],
            ].map(([value, label]) => (
              <div key={label} className="border-l border-white/10 px-6 py-6">
                <div className="text-lg font-extrabold sm:text-xl">{value}</div>
                <div className="mt-1 text-xs text-white/50 sm:text-sm">
                  {label}
                </div>
              </div>
            ))}
          </Container>
        </section>

        {/* How it works */}
        <Section id="jak-to-funguje">
          <Container>
            <SectionHeading eyebrow="Postup" title="Jak probíhá rezervace" />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: CalendarClock,
                  title: t("home.about.step1.title"),
                  body: t("home.about.step1.body"),
                },
                {
                  icon: CreditCard,
                  title: t("home.about.step2.title"),
                  body: t("home.about.step2.body"),
                },
                {
                  icon: KeyRound,
                  title: t("home.about.step3.title"),
                  body: t("home.about.step3.body"),
                },
              ].map((step, i) => (
                <Card key={step.title} className="relative">
                  <CardContent className="p-6">
                    <div className="mb-5 grid size-12 place-items-center rounded-xl bg-ink text-primary">
                      <step.icon className="size-5" />
                    </div>
                    <div className="absolute right-5 top-3 text-6xl font-black text-primary/20">
                      {i + 1}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {step.body}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Container>
        </Section>

        {/* Pricing */}
        <Section id="cenik" className="bg-secondary/50">
          <Container className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHeading
                eyebrow="Ceník"
                title="Cena jednorázového vstupu"
                align="left"
              />
              <p className="mt-4 max-w-md text-muted-foreground">
                {t("home.pricing.note")}
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Soukromé využití gymu během rezervace",
                  "Platba kartou, Apple Pay i Google Pay",
                  "Vstupní údaje obdržíte před návštěvou",
                  `Každý ${content.freeEntryEvery}. vstup zdarma`,
                ].map((li) => (
                  <li key={li} className="flex items-start gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary">
                      <Check className="size-3.5" />
                    </span>
                    {li}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative overflow-hidden rounded-[20px] bg-ink p-9 text-center text-white lg:justify-self-end lg:w-[420px]">
              <div className="absolute inset-0 opacity-20 [background:radial-gradient(70%_50%_at_50%_0%,var(--color-primary),transparent_65%)]" />
              <div className="relative">
                <div className="text-xs font-bold uppercase tracking-[.14em] text-white/55">
                  Vstupné
                </div>
                <div className="mt-3 text-6xl font-black tracking-[-.04em] text-primary">
                  {price}
                </div>
                <p className="mt-2 text-sm text-white/65">
                  za hodinovou rezervaci celého prostoru
                </p>
                <Button href="/rezervace" size="lg" className="mt-7 w-full">
                  Rezervovat trénink
                </Button>
              </div>
            </div>
          </Container>
        </Section>

        <Section id="prostor">
          <Container>
            <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
              <SectionHeading
                eyebrow="Prostor"
                title="Podívejte se dovnitř"
                align="left"
              />
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground lg:justify-self-end">
                Soukromé fitness se silovou i kardio zónou, šatnou a chytrým
                vstupem. Další fotografie prostoru postupně doplníme.
              </p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              <div className="min-h-[380px] overflow-hidden rounded-[20px] bg-muted lg:min-h-[580px]">
                {/* Genuine photo published by NAMASTÉ Private Gym on its original Wix site. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://static.wixstatic.com/media/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg/v1/fill/w_1600,h_900,al_c,q_90,enc_avif,quality_auto/7bc428_dabb1d2f234245e0ac56794a83548bbf~mv2.jpeg"
                  alt="Hlavní prostor NAMASTÉ Private Gym"
                  className="h-full min-h-[380px] w-full object-cover lg:min-h-[580px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  "Kardio zóna",
                  "Činky a vybavení",
                  "Šatna a sprcha",
                  "Vstup s chytrým zámkem",
                ].map((label) => (
                  <GalleryPlaceholder key={label} label={label} />
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Dumbbell,
                  title: "Silová zóna",
                  body: "Stroje a pomůcky pro samostatný silový trénink.",
                },
                {
                  icon: DoorOpen,
                  title: "Kardio a protažení",
                  body: "Samostatná zóna pro kardio, mobilitu a strečink.",
                },
                {
                  icon: Baby,
                  title: "Dětský koutek",
                  body: "Vybavené bezpečné zázemí pro děti včetně pískoviště.",
                },
                {
                  icon: Refrigerator,
                  title: "Vybavená lednice",
                  body: "Občerstvení a doplňky dostupné přímo ve fitness.",
                },
              ].map((item) => (
                <Card
                  key={item.title}
                  className="group transition-colors hover:border-primary/50"
                >
                  <CardContent className="p-7">
                    <div className="grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <item.icon className="size-5" />
                    </div>
                    <h3 className="mt-5 text-lg font-extrabold">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Container>
        </Section>

        {/* Rules */}
        <Section
          id="pravidla"
          className="bg-ink py-20 text-ink-foreground sm:py-24"
        >
          <Container className="grid gap-12 lg:grid-cols-[.9fr_1.35fr] lg:items-center">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[.16em] text-primary">
                Provoz
              </div>
              <h2 className="mt-4 text-4xl font-black tracking-[-.035em] sm:text-5xl">
                Férová pravidla
              </h2>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/60">
                {t("home.rules.body")}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Wifi,
                  label: "Nonstop hlídaný zámek",
                  body: "Chytrý vstupní systém je pod stálým dohledem.",
                },
                {
                  icon: Lock,
                  label: "Jednorázový vstupní kód",
                  body: "Platí pouze pro vás a v čase vaší rezervace.",
                },
                {
                  icon: ShieldCheck,
                  label: "Každé odemčení zaznamenáno",
                  body: "Kniha vstupů pomáhá chránit soukromí i bezpečnost.",
                },
              ].map((f) => (
                <div
                  key={f.label}
                  className="rounded-[16px] border border-white/15 bg-white/[.035] p-7 sm:min-h-[250px]"
                >
                  <f.icon className="size-7 text-primary" />
                  <h3 className="mt-8 text-lg font-extrabold leading-snug">
                    {f.label}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/50">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </Section>

        {/* Contact */}
        <Section id="kontakt">
          <Container>
            <SectionHeading
              eyebrow="Kde nás najdete"
              title="Kontakt a adresa"
            />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <ContactCard
                icon={MapPin}
                label="Adresa"
                value={address}
                href={mapsUrl}
              />
              {email && (
                <ContactCard
                  icon={Mail}
                  label="E-mail"
                  value={email}
                  href={`mailto:${email}`}
                />
              )}
              {phone && (
                <ContactCard
                  icon={Phone}
                  label="Telefon"
                  value={phone}
                  href={`tel:${phone.replace(/\s/g, "")}`}
                />
              )}
            </div>
            <div className="mt-4 min-h-[360px] overflow-hidden rounded-[20px] border border-border bg-muted">
              <iframe
                title={`Mapa: ${address}`}
                src={mapsEmbedUrl}
                className="h-full min-h-[360px] w-full border-0"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </Container>
        </Section>
      </main>
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
  dark = false,
}: {
  eyebrow: string;
  title: string;
  align?: "center" | "left";
  dark?: boolean;
}) {
  return (
    <div className={align === "center" ? "text-center" : ""}>
      <div
        className={`text-sm font-semibold ${dark ? "text-primary" : "text-primary"}`}
      >
        {eyebrow}
      </div>
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}

function ContactCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <Card className="h-full transition-colors hover:border-primary/50">
      <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-7 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <Icon className="size-6" />
        </span>
        <div className="text-xs font-extrabold uppercase tracking-[.16em] text-muted-foreground">
          {label}
        </div>
        <div className="text-base font-extrabold sm:text-lg">{value}</div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function GalleryPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[20px] border border-dashed border-border bg-muted/70 p-5 text-center lg:min-h-0">
      <span className="grid size-11 place-items-center rounded-xl bg-card text-muted-foreground shadow-sm">
        <ImageIcon className="size-5" />
      </span>
      <div className="mt-3 text-sm font-bold text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xs text-muted-foreground/70">
        Fotografie připravujeme
      </div>
    </div>
  );
}
