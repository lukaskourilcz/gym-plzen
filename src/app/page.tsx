import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  CreditCard,
  DoorOpen,
  Dumbbell,
  HeartPulse,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Music,
  PersonStanding,
  Phone,
  ShieldCheck,
  ShowerHead,
  Smartphone,
  Sparkles,
  Wifi,
} from "lucide-react";
import { loadSiteContent, type SiteContentKey } from "@/lib/content/site";
import { getSession } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/helpers/format";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

// Revalidate so CMS content edits appear without a redeploy.
export const revalidate = 60;

/*
 * Homepage layout applies the Elysium Gyms inspiration (docs/INSPIRATIONS.md,
 * admin → Inspirace): hero → five-icon "proč my" row above the fold →
 * six-step "jak to funguje" strip (book → pay → code → train) → space
 * carousel — carried out in our own dark-ink + lime token palette.
 */

/** The five differentiators shown Elysium-style right under the hero. */
const WHY_US = [
  { icon: Dumbbell, label: "Celý gym jen pro vás", sub: "žádné sdílení prostoru" },
  { icon: CalendarClock, label: "Hodinové sloty", sub: "rezervace online" },
  { icon: KeyRound, label: "Vstup na kód", sub: "bez recepce a obsluhy" },
  { icon: CreditCard, label: "Platba předem", sub: "karta, Apple i Google Pay" },
  { icon: Sparkles, label: "Věrnost se vyplácí", sub: "každý 10. vstup zdarma" },
] as const;

/** Icons for the six how-it-works steps (copy comes from the CMS). */
const STEP_ICONS = [CalendarClock, CreditCard, Smartphone, DoorOpen, KeyRound, Dumbbell] as const;

/** Space carousel placeholders until real photos land in the CMS. */
const SPACES = [
  { icon: Dumbbell, label: "Silová zóna", note: "činky, rack a osa" },
  { icon: HeartPulse, label: "Kardio", note: "rozehřátí i finisher" },
  { icon: PersonStanding, label: "Stretching", note: "prostor na protažení" },
  { icon: Music, label: "Hudba a TV", note: "prostor hraje podle vás" },
  { icon: ShowerHead, label: "Sprcha a zázemí", note: "čas navíc po tréninku" },
  { icon: DoorOpen, label: "Vstup na kód", note: "chytrý zámek Nuki" },
] as const;

export default async function HomePage() {
  const [content, session] = await Promise.all([loadSiteContent(), getSession()]);
  const t = content.get;
  const brand = t("brand.name");
  const price = formatMoney(content.entryPriceCents);
  const email = t("contact.email");
  const phone = t("contact.phone");

  const steps = Array.from({ length: 6 }, (_, i) => ({
    icon: STEP_ICONS[i]!,
    title: t(`home.about.step${i + 1}.title` as SiteContentKey),
    body: t(`home.about.step${i + 1}.body` as SiteContentKey),
  }));

  return (
    <>
      <SiteHeader brand={brand} logoUrl={content.logoUrl} user={session?.user ?? null} />
      <main>
        {/* Hero — dark ink, one dominant CTA */}
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
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <Button href="/rezervace" size="lg">
                  {t("home.hero.cta")}
                </Button>
                <Link
                  href="/#jak-to-funguje"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-foreground/80 transition-colors hover:text-ink-foreground"
                >
                  Jak to funguje <ArrowRight className="size-4" />
                </Link>
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

        {/* Five-icon "proč my" row above the fold (Elysium) */}
        <section aria-label="Proč trénovat u nás" className="border-b border-border bg-background">
          <Container>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 py-10 sm:grid-cols-3 lg:grid-cols-5">
              {WHY_US.map((item) => (
                <li key={item.label} className="flex flex-col items-center gap-2 text-center">
                  <span className="grid size-11 place-items-center rounded-full bg-primary/15 text-foreground">
                    <item.icon className="size-5" />
                  </span>
                  <span className="text-sm font-semibold leading-tight">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.sub}</span>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* How it works — six-step strip (Elysium: book → pay → code → train) */}
        <Section id="jak-to-funguje">
          <Container>
            <SectionHeading eyebrow="Jednoduše" title={t("home.about.title")} />
            <ol className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {steps.map((step, i) => (
                <li key={step.title} className="relative">
                  {/* Connector line between steps on wide screens */}
                  {i < steps.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[calc(50%+2rem)] right-[calc(-50%+2rem)] top-6 hidden h-px bg-border xl:block"
                    />
                  )}
                  <div className="flex flex-col items-center text-center">
                    <span className="relative grid size-12 place-items-center rounded-full border border-primary/40 bg-primary/10">
                      <step.icon className="size-5" />
                      <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                    </span>
                    <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-12 text-center">
              <Button href="/rezervace" size="lg">
                {t("home.hero.cta")}
              </Button>
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
            <Card className="lg:w-96 lg:justify-self-end">
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

        {/* Space carousel (Elysium's rotating spaces; photos come via the CMS) */}
        <Section id="galerie">
          <Container>
            <SectionHeading eyebrow="Prostor" title={t("home.gallery.title")} />
          </Container>
          <div className="mt-12 overflow-x-auto pb-4 [scrollbar-width:thin]">
            <ul className="mx-auto flex w-max snap-x snap-mandatory gap-4 px-4 sm:px-6">
              {SPACES.map((space, i) => (
                <li
                  key={space.label}
                  className="w-64 shrink-0 snap-center overflow-hidden rounded-xl border border-border bg-card sm:w-72"
                >
                  <div
                    className={`grid aspect-[4/3] place-items-center bg-gradient-to-br ${
                      i % 2 === 0 ? "from-secondary to-muted" : "from-primary/15 via-secondary to-muted"
                    }`}
                  >
                    <space.icon className="size-10 text-muted-foreground/70" strokeWidth={1.5} />
                  </div>
                  <div className="p-4">
                    <div className="text-sm font-semibold">{space.label}</div>
                    <div className="text-xs text-muted-foreground">{space.note}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Skutečné fotografie prostoru doplníte v administraci (Obsah webu).
          </p>
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
