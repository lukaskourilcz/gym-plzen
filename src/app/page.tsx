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
} from "lucide-react";
import { loadSiteContent } from "@/lib/content/site";
import { formatMoney } from "@/lib/helpers/format";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

// Revalidate so CMS content edits appear without a redeploy.
export const revalidate = 60;

export default async function HomePage() {
  const content = await loadSiteContent();
  const t = content.get;
  const brand = t("brand.name");
  const price = formatMoney(content.entryPriceCents);
  const email = t("contact.email");
  const phone = t("contact.phone");

  return (
    <>
      <SiteHeader brand={brand} logoUrl={content.logoUrl} />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-ink text-ink-foreground">
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(oklch(0.97_0.005_260/.035)_1px,transparent_1px),linear-gradient(90deg,oklch(0.97_0.005_260/.035)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="pointer-events-none absolute inset-0 opacity-25 [background:radial-gradient(50%_60%_at_75%_10%,var(--color-primary)_0%,transparent_60%)]" />
          <Container className="relative grid gap-14 py-20 sm:py-24 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <h1 className="text-5xl font-black leading-[.98] tracking-[-0.035em] sm:text-6xl lg:text-[76px]">
                Celý gym.<br />Jen <em className="text-primary">pro vás</em>.
              </h1>
              <p className="mt-6 max-w-[460px] text-lg leading-relaxed text-ink-foreground/70">
                Zarezervujte si hodinu, zaplaťte online a dveře si odemknete kódem. Bez recepce, čekání a davů.
              </p>
              <div className="mt-8">
                <Button href="/rezervace" size="lg">
                  Rezervovat trénink <ArrowRight />
                </Button>
              </div>
            </div>

            <div className="lg:justify-self-end">
              <Card className="w-full max-w-md overflow-hidden border-0 bg-background text-card-foreground shadow-2xl">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between border-b border-border px-6 py-5">
                    <div className="flex items-center gap-2 text-sm font-extrabold">
                      <span className="size-2 rounded-full bg-emerald-500" /> Rezervace online
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">bez čekání</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 px-6 py-5">
                    {["06:00", "12:00", "17:00", "18:00", "19:00", "20:00"].map((slot) => (
                      <Link key={slot} href="/rezervace" className="rounded-lg border border-primary/40 bg-primary/10 py-2 text-center text-sm font-bold hover:bg-primary">
                        {slot}
                      </Link>
                    ))}
                  </div>
                  <div className="flex items-end justify-between border-t border-border px-6 py-5">
                    <div><strong className="text-2xl font-black">{price}</strong><span className="text-sm text-muted-foreground"> / hodina</span></div>
                    <Link href="/rezervace" className="inline-flex items-center gap-1 text-sm font-extrabold hover:underline">Celý kalendář <ArrowRight className="size-4" /></Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Container>
          <Container className="relative grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
            {[["60 min", "soukromý vstup"], [price, "za celý gym"], [`Každý ${content.freeEntryEvery}.`, "vstup zdarma"], ["Online", "rezervace i platba"]].map(([value, label]) => (
              <div key={label} className="border-l border-white/10 px-5 py-5"><div className="font-extrabold">{value}</div><div className="mt-0.5 text-xs text-white/50">{label}</div></div>
            ))}
          </Container>
        </section>

        {/* How it works */}
        <Section id="jak-to-funguje">
          <Container>
            <SectionHeading eyebrow="Jak to funguje" title="Tři kroky. Dvě minuty." />
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
              <SectionHeading eyebrow="Ceník" title="Jedna cena. Žádné hvězdičky." align="left" />
              <p className="mt-4 max-w-md text-muted-foreground">{t("home.pricing.note")}</p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Celý gym jen pro vás během rezervace",
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
              <div className="relative"><div className="text-xs font-bold uppercase tracking-[.14em] text-white/55">Vstupné</div><div className="mt-3 text-6xl font-black tracking-[-.04em] text-primary">{price}</div><p className="mt-2 text-sm text-white/65">za hodinu · celý gym jen pro vás</p><Button href="/rezervace" size="lg" className="mt-7 w-full">Rezervovat trénink</Button></div>
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
            <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-4 [&>*]:min-w-56 [&>*]:flex-1">
              <ContactCard icon={MapPin} label="Adresa" value={t("contact.address")} />
              {email && <ContactCard icon={Mail} label="E-mail" value={email} href={`mailto:${email}`} />}
              {phone && <ContactCard icon={Phone} label="Telefon" value={phone} href={`tel:${phone}`} />}
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
