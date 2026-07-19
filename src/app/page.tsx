import Link from "next/link";
import {
  CalendarClock,
  CreditCard,
  KeyRound,
  ShieldCheck,
  MapPin,
  Mail,
  Phone,
  Clock,
  Lock,
  ArrowRight,
  Check,
  Dumbbell,
  Droplets,
  DoorOpen,
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
import { HeroAvailability, type HeroAvailabilityDay } from "@/components/site/hero-availability";

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
  const address = configuredAddress === "Plzeň" ? "Křížkova 424/23, 301 00 Plzeň 1" : configuredAddress;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const mapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const combinedDays = [...currentWeek.days, ...nextWeek.days];
  const todayIndex = Math.max(0, combinedDays.findIndex((day) => day.date.toDateString() === now.toDateString()));
  const previewDays: HeroAvailabilityDay[] = combinedDays.slice(todayIndex, todayIndex + 4).map((day, index) => {
    const firstAvailable = day.slots.findIndex((slot) => slot.available);
    const start = index === 0 && firstAvailable > 0 ? Math.min(firstAvailable, Math.max(0, day.slots.length - 8)) : 0;
    return {
      label: index === 0 ? "Dnes" : index === 1 ? "Zítra" : new Intl.DateTimeFormat("cs-CZ", { weekday: "short", day: "numeric" }).format(day.date),
      dateLabel: day.date.toISOString(),
      slots: day.slots.slice(start, start + 8).map((slot) => ({ label: formatTime(slot.start), available: slot.available })),
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
              <h1 className="text-5xl font-black leading-[.98] tracking-[-0.04em] sm:text-6xl lg:text-[78px] xl:text-[86px]">
                Celý gym.<br />Jen <em className="text-primary">pro vás</em>.
              </h1>
              <p className="mt-7 max-w-[520px] text-lg leading-relaxed text-ink-foreground/65 sm:text-xl">
                Zarezervujte si hodinu, zaplaťte online a dveře si odemknete osobním kódem. Prostor máte po celou dobu rezervace k dispozici sami.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button href="/rezervace" size="lg">
                  Rezervovat trénink <ArrowRight />
                </Button>
                <Button href="/#jak-to-funguje" size="lg" variant="outline" className="border-white/25 text-white hover:bg-white/10 hover:text-white">
                  Jak to funguje
                </Button>
              </div>
            </div>

            <div className="lg:w-full lg:max-w-[520px] lg:justify-self-end">
              <HeroAvailability days={previewDays} price={price} freeEntryEvery={content.freeEntryEvery} live={currentWeek.source === "live"} />
            </div>
          </Container>
          <Container className="relative grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
            {[["05:00–21:00", "otevřeno každý den"], ["1 osoba", "na každý hodinový slot"], [price, "za hodinu, bez závazku"], [`${content.freeEntryEvery}. vstup`, "vždy zdarma"]].map(([value, label]) => (
              <div key={label} className="border-l border-white/10 px-6 py-6"><div className="text-lg font-extrabold sm:text-xl">{value}</div><div className="mt-1 text-xs text-white/50 sm:text-sm">{label}</div></div>
            ))}
          </Container>
        </section>

        {/* How it works */}
        <Section id="jak-to-funguje">
          <Container>
            <SectionHeading eyebrow="Postup" title="Jak probíhá rezervace" />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                { icon: CalendarClock, title: t("home.about.step1.title"), body: t("home.about.step1.body") },
                { icon: CreditCard, title: t("home.about.step2.title"), body: t("home.about.step2.body") },
                { icon: KeyRound, title: t("home.about.step3.title"), body: t("home.about.step3.body") },
              ].map((step, i) => (
                <Card key={step.title} className="relative">
                  <CardContent className="p-6">
                    <div className="mb-5 grid size-12 place-items-center rounded-xl bg-ink text-primary">
                      <step.icon className="size-5" />
                    </div>
                    <div className="absolute right-5 top-3 text-6xl font-black text-primary/20">{i + 1}</div>
                    <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
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
              <SectionHeading eyebrow="Ceník" title="Cena jednorázového vstupu" align="left" />
              <p className="mt-4 max-w-md text-muted-foreground">{t("home.pricing.note")}</p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Soukromé využití gymu během rezervace",
                  "Platba kartou, Apple Pay i Google Pay",
                  "Vstupní údaje obdržíte před návštěvou",
                  `Každý ${content.freeEntryEvery}. vstup zdarma`,
                ].map((li) => (
                  <li key={li} className="flex items-start gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary"><Check className="size-3.5" /></span>
                    {li}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative overflow-hidden rounded-[20px] bg-ink p-9 text-center text-white lg:justify-self-end lg:w-[420px]">
              <div className="absolute inset-0 opacity-20 [background:radial-gradient(70%_50%_at_50%_0%,var(--color-primary),transparent_65%)]" />
              <div className="relative"><div className="text-xs font-bold uppercase tracking-[.14em] text-white/55">Vstupné</div><div className="mt-3 text-6xl font-black tracking-[-.04em] text-primary">{price}</div><p className="mt-2 text-sm text-white/65">za hodinovou rezervaci celého prostoru</p><Button href="/rezervace" size="lg" className="mt-7 w-full">Rezervovat trénink</Button></div>
            </div>
          </Container>
        </Section>

        <Section id="prostor">
          <Container>
            <SectionHeading eyebrow="Prostor" title="Vybavení pro samostatný trénink" />
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">Gym je připravený pro individuální silový a kondiční trénink. Během rezervace prostor nesdílíte s dalšími návštěvníky.</p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                { icon: Dumbbell, title: "Tréninková zóna", body: "Prostor pro silový i kondiční trénink s vybavením na jednom místě." },
                { icon: Droplets, title: "Šatna a sprcha", body: "Po skončení tréninku máte vyhrazený čas na převlečení a sprchu." },
                { icon: DoorOpen, title: "Samostatný vstup", body: "Osobní kód platí pouze v čase vaší potvrzené rezervace." },
              ].map((item) => (
                <Card key={item.title} className="group transition-colors hover:border-primary/50">
                  <CardContent className="p-7"><div className="grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground"><item.icon className="size-5" /></div><h3 className="mt-5 text-lg font-extrabold">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p></CardContent>
                </Card>
              ))}
            </div>
          </Container>
        </Section>

        {/* Rules */}
        <Section id="pravidla" className="bg-ink text-ink-foreground">
          <Container className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
            <SectionHeading eyebrow="Provoz" title={t("home.rules.title")} align="left" dark />
            <div className="space-y-4 text-ink-foreground/80">
              <p>{t("home.rules.body")}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Clock, label: "Vstup v čase rezervace" },
                  { icon: Lock, label: "Osobní vstupní kód" },
                  { icon: ShieldCheck, label: "Bezpečný soukromý prostor" },
                ].map((f) => (
                  <div key={f.label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <f.icon className="size-5 text-primary" />
                    <div className="mt-2 text-sm text-ink-foreground/80">{f.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </Section>

        {/* Contact */}
        <Section id="kontakt">
          <Container>
            <SectionHeading eyebrow="Kontakt" title={t("home.contact.title")} />
            <div className="mx-auto mt-10 grid max-w-5xl overflow-hidden rounded-[18px] border border-border bg-card shadow-sm lg:grid-cols-[.8fr_1.2fr]">
              <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
                <ContactCard icon={MapPin} label="Adresa" value={address} href={mapsUrl} />
                {email && <ContactCard icon={Mail} label="E-mail" value={email} href={`mailto:${email}`} />}
                {phone && <ContactCard icon={Phone} label="Telefon" value={phone} href={`tel:${phone}`} />}
                <p className="px-2 text-xs leading-relaxed text-muted-foreground">Kliknutím na adresu otevřete trasu v Google Maps.</p>
              </div>
              <div className="min-h-[320px] overflow-hidden border-t border-border bg-muted lg:border-l lg:border-t-0">
                <iframe
                  title={`Mapa: ${address}`}
                  src={mapsEmbedUrl}
                  className="h-full min-h-[320px] w-full border-0"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter brand={brand} email={email || undefined} phone={phone || undefined} termsUrl={content.termsUrl} />
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
      <div className={`text-sm font-semibold ${dark ? "text-primary" : "text-primary"}`}>{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
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
    <Card className="h-full">
      <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
        <Icon className="size-5 text-primary" />
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm">{value}</div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
