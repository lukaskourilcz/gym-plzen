import Link from "next/link";
import {
  CalendarClock,
  CreditCard,
  KeyRound,
  ShieldCheck,
  Sparkles,
  MapPin,
  Mail,
  Phone,
  Clock,
  Wifi,
  Lock,
} from "lucide-react";
import { loadSiteContent } from "@/lib/content/site";
import { formatMoney } from "@/lib/helpers/format";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
          <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(60%_60%_at_70%_0%,var(--color-primary)_0%,transparent_60%)]" />
          <Container className="relative grid gap-10 py-20 sm:py-28 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="accent" className="mb-5 bg-white/10 text-ink-foreground">
                <Sparkles className="mr-1 size-3.5" /> {t("home.hero.badge")}
              </Badge>
              <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                {t("home.hero.title")}
              </h1>
              <p className="mt-5 max-w-lg text-lg text-ink-foreground/75">
                {t("home.hero.subtitle")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href="/rezervace" size="lg">
                  {t("home.hero.cta")}
                </Button>
                <Button href="/#jak-to-funguje" size="lg" variant="outline" className="border-white/25 text-ink-foreground hover:bg-white/10">
                  Jak to funguje
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-foreground/60">
                <span className="inline-flex items-center gap-1.5"><Clock className="size-4" /> Otevřeno dle rezervací</span>
                <span className="inline-flex items-center gap-1.5"><Lock className="size-4" /> Vstup na kód</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4" /> Data v EU</span>
              </div>
            </div>

            {/* Price / loyalty teaser card */}
            <div className="lg:justify-self-end">
              <Card className="w-full max-w-sm bg-card/95 text-card-foreground shadow-xl">
                <CardContent className="p-6">
                  <div className="text-sm font-medium text-muted-foreground">Jednorázový vstup</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold tracking-tight">{price}</span>
                    <span className="text-muted-foreground">/ trénink</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Bez závazků a měsíčních plateb. A každý{" "}
                    <strong className="text-foreground">{content.freeEntryEvery}. vstup zdarma</strong>.
                  </p>
                  <div className="mt-5 flex items-center gap-2 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
                    <Sparkles className="size-4 shrink-0" />
                    Věrnostní počítadlo vidíte ve svém účtu.
                  </div>
                  <Button href="/rezervace" className="mt-5 w-full">
                    Vybrat termín
                  </Button>
                </CardContent>
              </Card>
            </div>
          </Container>
        </section>

        {/* How it works */}
        <Section id="jak-to-funguje">
          <Container>
            <SectionHeading eyebrow="Jednoduše" title={t("home.about.title")} />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                { icon: CalendarClock, title: t("home.about.step1.title"), body: t("home.about.step1.body") },
                { icon: CreditCard, title: t("home.about.step2.title"), body: t("home.about.step2.body") },
                { icon: KeyRound, title: t("home.about.step3.title"), body: t("home.about.step3.body") },
              ].map((step, i) => (
                <Card key={step.title} className="relative">
                  <CardContent className="p-6">
                    <div className="mb-4 grid size-11 place-items-center rounded-lg bg-primary/15 text-foreground">
                      <step.icon className="size-5" />
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground">Krok {i + 1}</div>
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
              <SectionHeading eyebrow="Ceník" title={t("home.pricing.title")} align="left" />
              <p className="mt-4 max-w-md text-muted-foreground">{t("home.pricing.note")}</p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Celý gym jen pro vás během rezervace",
                  "Platba kartou, Apple Pay i Google Pay",
                  "Vstupní kód e-mailem i na WhatsApp",
                  `Každý ${content.freeEntryEvery}. vstup zdarma`,
                ].map((li) => (
                  <li key={li} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    {li}
                  </li>
                ))}
              </ul>
            </div>
            <Card className="lg:justify-self-end lg:w-96">
              <CardContent className="p-8 text-center">
                <div className="text-sm font-medium text-muted-foreground">Vstupné</div>
                <div className="mt-2 text-5xl font-extrabold tracking-tight">{price}</div>
                <div className="mt-1 text-sm text-muted-foreground">za jeden trénink</div>
                <Button href="/rezervace" size="lg" className="mt-6 w-full">
                  Rezervovat trénink
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">Bez registračních poplatků a bez závazku.</p>
              </CardContent>
            </Card>
          </Container>
        </Section>

        {/* Gallery (placeholders until real photos are added via the CMS) */}
        <Section id="galerie">
          <Container>
            <SectionHeading eyebrow="Prostor" title={t("home.gallery.title")} />
            <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl border border-border bg-gradient-to-br from-secondary to-muted"
                  aria-hidden
                />
              ))}
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Fotografie prostoru doplníte v administraci (Obsah webu).
            </p>
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
                  { icon: Wifi, label: "Nonstop hlídaný zámek" },
                  { icon: Lock, label: "Jednorázový vstupní kód" },
                  { icon: ShieldCheck, label: "Každé odemčení zaznamenáno" },
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
            <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
              <ContactCard icon={MapPin} label="Adresa" value={t("contact.address")} />
              <ContactCard icon={Mail} label="E-mail" value={email || "doplňte v administraci"} href={email ? `mailto:${email}` : undefined} />
              <ContactCard icon={Phone} label="Telefon" value={phone || "doplňte v administraci"} href={phone ? `tel:${phone}` : undefined} />
            </div>
            <div className="mt-10 text-center">
              <Button href="/rezervace" size="lg">
                Rezervovat trénink
              </Button>
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
