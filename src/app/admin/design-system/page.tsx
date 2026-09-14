import { CustomerAvatar } from "@/components/site/customer-avatar";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Dumbbell,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { BrandLockup, BrandLogo, BrandMark } from "@/components/site/brand";
import {
  FacebookIcon,
  InstagramIcon,
  WhatsAppIcon,
} from "@/components/site/social-icons";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Design systém" };

const swatches = [
  ["Primární zelená", "#004534", "bg-primary text-primary-foreground"],
  ["Ink zelená", "#003527", "bg-ink text-ink-foreground"],
  ["Zvýšená ink", "#0A4230", "bg-ink-elevated text-ink-foreground"],
  ["Šalvějová", "#7E9C8B", "bg-sage text-sage-foreground"],
  ["Jemná šalvějová", "#B9CBBE", "bg-sage-soft text-sage-foreground"],
  ["Zelený akcent", "#DDE8E1", "bg-accent text-accent-foreground"],
  ["Zlatá", "#DDB255", "bg-gold text-gold-foreground"],
  ["Taupe", "#7C6650", "bg-taupe text-taupe-foreground"],
  ["Uhlová", "#2E2E2E", "bg-charcoal text-charcoal-foreground"],
] as const;

/** Mirrors the `[data-design="modern"]` block in globals.css. */
const designVariantTokens = [
  ["--display-1", "Tailwind 36/48/60", "40 to 72px"],
  ["--display-2", "Tailwind 30/36", "32 to 48px"],
  ["--section-space", "80px", "88px"],
  ["--section-space-lg", "96px", "120px"],
  ["--eyebrow-rule", "0px", "2px"],
  ["--header-lift", "0px", "24px"],
] as const;

export default function DesignSystemPage() {
  return (
    <div>
      <PageHeader
        title="Design systém"
        description="Referenční galerie komponent. Pravidla a tokeny jsou v docs/DESIGN_SYSTEM.md."
      />

      <div className="grid gap-8">
        <section aria-labelledby="kit-avatar">
          <h2 id="kit-avatar" className="mb-4 text-xl font-extrabold">
            Zákaznický avatar
          </h2>
          <div className="flex flex-wrap items-center gap-5">
            <CustomerAvatar name="Klára Nováková" />
            <p>
              Fotka z Googlu nebo iniciály. Při nedostupné fotce se zobrazí
              iniciály.
            </p>
          </div>
        </section>
        <section aria-labelledby="kit-brand">
          <h2 id="kit-brand" className="mb-4 text-xl font-extrabold">
            Značka a typografie
          </h2>
          <Card>
            <CardContent className="grid gap-8 p-6 lg:grid-cols-2">
              <div className="flex flex-wrap items-center gap-8">
                <BrandMark className="size-14" />
                <BrandLogo />
                <span className="rounded-lg bg-ink p-6">
                  <BrandLockup className="w-32 text-gold" />
                </span>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Značka se kreslí jako maska obarvená{" "}
                  <code className="font-bold">currentColor</code>: na světlém
                  podkladu zelená, na ink zlatá. Zlatá na krémovém pozadí má
                  kontrast jen ~1,9:1, proto se tam nikdy nepoužívá.
                </p>
              </div>
              <div>
                <p className="text-4xl font-extrabold tracking-[-0.01em]">
                  Tvůj čas. Tvůj prostor. Tvoje NAVI.
                </p>
                <p className="mt-4 text-2xl font-extrabold tracking-[-0.01em]">
                  Klidný prostor pro soustředěný trénink
                </p>
                <p className="mt-3 max-w-xl text-muted-foreground">
                  Bitter je společný font pro rozhraní i marketing a načítá se s
                  českou znakovou sadou. U velkých nadpisů držte prostrkání
                  blízko nule.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="kit-navigation">
          <h2 id="kit-navigation" className="mb-4 text-xl font-extrabold">
            Mobilní navigace administrace
          </h2>
          <Card>
            <CardContent className="max-w-sm p-5">
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between rounded-md bg-ink px-3 text-left text-sm font-bold text-white"
              >
                <span>
                  Menu administrace
                  <span className="ml-2 font-medium text-white/60">Dnes</span>
                </span>
                <ChevronDown aria-hidden="true" className="size-4" />
              </button>
              <p className="mt-3 text-sm text-muted-foreground">
                Na mobilu nahrazuje horizontální pás. Otevřené menu seskupuje
                moduly, označuje aktivní route a zavírá se klávesou Escape.
              </p>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="kit-patterns">
          <h2 id="kit-patterns" className="mb-4 text-xl font-extrabold">
            Schválené vzory veřejného webu
          </h2>
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg bg-ink p-6">
              <h3 className="flex items-center gap-3 text-lg font-extrabold uppercase tracking-[.04em] text-ink-foreground">
                <BrandMark decorative className="size-8 shrink-0 text-gold" />
                Jak to u nás funguje
              </h3>
              <div className="mt-4 grid gap-px overflow-hidden rounded-lg bg-white/20 sm:grid-cols-2">
                {["Vyber si termín", "Po zaplacení"].map((title, index) => (
                  <div
                    key={title}
                    className="grid h-full grid-cols-[3rem_minmax(0,1fr)] content-start items-start gap-x-4 bg-card p-5 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className="row-span-2 grid size-11 shrink-0 place-items-center rounded-sm bg-gold text-base font-extrabold text-gold-foreground"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h4 className="pt-1 text-base font-extrabold uppercase leading-tight tracking-[.04em] text-accent-foreground">
                      {title}
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Zlatá číslice nese pořadí kroku, text zůstává na bílé
                      ploše kvůli čitelnosti.
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-ink-foreground/80">
                Na webu je za pásem připnutá fotografie tělocvičny se zeleným
                závojem. Karty mají stejnou výšku, pevný sloupec pro číslo a
                text zarovnaný vlevo.
              </p>
            </div>

            <div className="grid gap-5">
              <div className="grid overflow-hidden rounded-lg bg-ink text-ink-foreground sm:grid-cols-2">
                <div className="p-6">
                  <h3 className="text-lg font-extrabold uppercase tracking-[.05em]">
                    Dlaždice zóny
                  </h3>
                  <p className="mt-3 text-sm leading-6 opacity-85">
                    Střídá se tmavě zelená a její zvýšená plocha. Média drží
                    lotos, dokud provozovatel nedodá fotografii.
                  </p>
                </div>
                <div className="grid min-h-32 place-items-center bg-ink-elevated">
                  <BrandMark decorative className="size-14 opacity-30" />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="mb-2 text-sm font-extrabold">
                  Rozbalovací dotaz
                </h3>
                <details className="group border-y border-border py-1">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 py-3 font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <BrandMark
                      decorative
                      className="size-7 shrink-0 text-muted-foreground transition-[rotate,color] duration-[320ms] ease-brand-spring group-open:rotate-90 group-open:text-accent-foreground"
                    />
                    Jak si vyberu termín?
                  </summary>
                  <p className="pb-4 pl-11 text-sm leading-6 text-muted-foreground">
                    Otočení lotosu o 90 stupňů je jediný schválený pohyb značky
                    a stav je vždy čitelný i bez animace.
                  </p>
                </details>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-5 rounded-lg bg-ink p-6 text-ink-foreground lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.14em] text-gold">
                Ceník
              </p>
              <h3 className="mt-3 whitespace-pre-line text-2xl font-extrabold leading-[1.15]">
                {"Bez závazků.\nBez předplatného.\n"}
                <span className="text-gold">Bez měsíčních plateb.</span>
              </h3>
              <p className="mt-3 text-sm leading-6 text-ink-foreground/75">
                Cena stojí na bílé kartě. Výzva k rezervaci používá samostatný
                pás s textem vlevo a tlačítkem vpravo.
              </p>
            </div>
            {/* Stretches to the copy column beside it; gold figure at the top
                of the display range. Mirrors the homepage pricing band. */}
            <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-center text-foreground shadow-md">
              <p className="border-b border-border px-6 py-5 text-lg font-extrabold uppercase tracking-[.14em] text-accent-foreground sm:text-xl">
                Jednorázový vstup
              </p>
              <div className="flex flex-1 flex-col justify-center border-b border-border px-6 py-10">
                <p className="text-6xl font-extrabold leading-none tracking-[-.01em] text-gold">
                  229 Kč
                </p>
                <p className="mt-2 text-base font-bold uppercase tracking-[.1em] text-muted-foreground">
                  / 75 minut
                </p>
              </div>
              <div className="px-6 py-7">
                <Button className="w-full">Rezervovat trénink</Button>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="kit-variants">
          <h2 id="kit-variants" className="mb-4 text-xl font-extrabold">
            Designové varianty
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>Klasický a Moderní</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <p className="text-muted-foreground">
                Veřejný web umí dvě varianty vzhledu. Volba se ukládá do cookie{" "}
                <code className="font-bold">ns_design</code> a ještě před
                vykreslením ji inline skript propíše jako{" "}
                <code className="font-bold">data-design</code> na{" "}
                <code className="font-bold">&lt;html&gt;</code>. Servrované HTML
                proto zůstává pro obě varianty stejné a úvodní stránka si drží
                ISR. Přepínač je jen na stránce /dev. Administrace variantu
                nepoužívá.
              </p>
              <p className="text-muted-foreground">
                Rozdíly smí vzniknout <strong>jen</strong> předefinováním těchto
                tokenů v bloku{" "}
                <code className="font-bold">
                  [data-design=&quot;modern&quot;]
                </code>{" "}
                v <code className="font-bold">globals.css</code>. Žádné nové
                barvy, gradienty ani jiné komponenty.
              </p>
              <p className="text-muted-foreground">
                Přepínač je interní nástroj a je jen na stránce{" "}
                <code className="font-bold">/dev</code> : nikde jinde se
                nevykresluje, takže na něj návštěvník nemůže narazit. Volba
                zapíše cookie <code className="font-bold">ns_design</code> a
                skript před vykreslením doplní{" "}
                <code className="font-bold">data-design</code>, podle kterého se
                řídí vzhled zbytku webu.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 font-extrabold">Token</th>
                      <th className="py-2 pr-4 font-extrabold">Klasický</th>
                      <th className="py-2 font-extrabold">Moderní</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    {designVariantTokens.map(([token, classic, modern]) => (
                      <tr key={token} className="border-b border-border/60">
                        <td className="py-2 pr-4 font-bold text-foreground">
                          {token}
                        </td>
                        <td className="py-2 pr-4">{classic}</td>
                        <td className="py-2">{modern}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-muted-foreground">
                Kde se podoby liší tvarem, jsou v DOM obě a CSS jednu zobrazí:
                věrnostní ukazatel v účtu je klasicky segmentový pás a v Moderní
                zlatý prstenec. Skrytá podoba je{" "}
                <code className="font-bold">display: none</code>, takže mizí i z
                přístupnostního stromu.
              </p>
              <p className="text-muted-foreground">
                Varianta je dočasná pomůcka pro srovnání s klientem. Po
                schválení se Moderní stane výchozí a přepínač se odstraní.
              </p>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="kit-colors">
          <h2 id="kit-colors" className="mb-4 text-xl font-extrabold">
            Barvy a plochy
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {swatches.map(([label, hex, classes]) => (
              <div
                key={label}
                className={`${classes} flex min-h-28 flex-col justify-between rounded-lg border p-5`}
              >
                <span className="font-extrabold">{label}</span>
                <code className="mt-6 text-sm font-bold tracking-[.08em]">
                  {hex}
                </code>
              </div>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="kit-controls"
          className="grid gap-6 xl:grid-cols-2"
        >
          <Card>
            <CardHeader>
              <CardTitle id="kit-controls">Tlačítka a štítky</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button>
                Primární <Check />
              </Button>
              <Button variant="ink">Tmavé</Button>
              <Button variant="outline">Sekundární</Button>
              <Button variant="ghost">Textové</Button>
              <Button disabled>Zakázané</Button>
              <Badge>Volno</Badge>
              <Badge variant="muted">Obsazeno</Badge>
              <Badge variant="outline">Dnes</Badge>
            </CardContent>
            <CardContent className="flex flex-wrap items-center gap-4 rounded-b-lg bg-ink p-6 text-ink-foreground">
              <span className="text-sm font-bold">
                Na tmavé ploše akcentuje jen zlatá:
              </span>
              <BrandMark decorative className="size-8 text-gold" />
              <span className="text-2xl font-extrabold text-gold">229 Kč</span>
              <span className="flex items-center gap-2 text-gold">
                <FacebookIcon />
                <InstagramIcon />
                <WhatsAppIcon />
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Formuláře</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-bold">
                E-mail
                <Input type="email" placeholder="jmeno@example.cz" />
              </label>
              <div>
                <label htmlFor="kit-invalid" className="text-sm font-bold">
                  Neplatná hodnota
                </label>
                <Input
                  id="kit-invalid"
                  aria-invalid="true"
                  aria-describedby="kit-invalid-error"
                  defaultValue="chybná hodnota"
                  className="mt-1.5 border-destructive"
                />
                {/* The error is wired to the input, not merely placed near it. */}
                <p
                  id="kit-invalid-error"
                  className="mt-1 text-xs text-destructive"
                >
                  Zadejte prosím platnou hodnotu.
                </p>
              </div>
              <Input disabled value="Pole je vypnuté" readOnly />
              {/* Combined consent: links stay outside the plain-text label and
                  the full sentence supplies the accessible name. */}
              <div className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  id="kit-consent"
                  type="checkbox"
                  aria-labelledby="kit-consent-label"
                  className="size-5 shrink-0 accent-[var(--color-primary)]"
                />
                <span id="kit-consent-label">
                  <label htmlFor="kit-consent">Souhlasím s</label>{" "}
                  <span className="font-bold text-accent-foreground underline">
                    provozním řádem
                  </span>{" "}
                  a{" "}
                  <span className="font-bold text-accent-foreground underline">
                    obchodními podmínkami
                  </span>
                  .
                </span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section
          aria-labelledby="kit-notices"
          className="grid gap-3 lg:grid-cols-2"
        >
          <h2 id="kit-notices" className="sr-only">
            Stavová sdělení
          </h2>
          <Notice tone="info" title="Informace">
            Dostupnost se po změně automaticky obnoví.
          </Notice>
          <Notice tone="success" title="Hotovo">
            Rezervace byla potvrzena.
          </Notice>
          <Notice tone="warning" title="Termín není vybraný">
            Nejprve vyberte datum v kalendáři.
          </Notice>
          <Notice tone="error" title="Služba není dostupná">
            Termíny teď nelze načíst. Zkuste to znovu později.
          </Notice>
        </section>

        <section aria-labelledby="kit-booking">
          <h2 id="kit-booking" className="mb-4 text-xl font-extrabold">
            Kalendář a rezervace
          </h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">
                  {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((day) => (
                    <span key={day} className="py-2">
                      {day}
                    </span>
                  ))}
                  {[20, 21, 22, 23, 24, 25, 26].map((day) => (
                    <span
                      key={day}
                      className={`grid min-h-11 place-items-center rounded-md border ${day === 23 ? "border-accent-foreground bg-accent font-extrabold" : day < 22 ? "bg-muted text-muted-foreground line-through" : "bg-card"}`}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
                {/* Solid `border-primary` on a 10% fill: the border is the
                    control's only boundary and must clear 3:1 on its own. */}
                <button className="min-h-12 rounded-md border border-primary bg-primary/10 px-4 text-left font-extrabold">
                  <Clock3 className="mr-2 inline size-4" />
                  08:00 až 09:15
                </button>
                <button
                  className="min-h-12 rounded-md border-2 border-accent-foreground bg-accent px-4 text-left font-extrabold"
                  aria-pressed="true"
                >
                  <Check className="mr-2 inline size-4" />
                  10:30 až 11:45
                </button>
                <button
                  disabled
                  className="min-h-12 rounded-md bg-muted px-4 text-left text-muted-foreground line-through"
                >
                  <CalendarDays className="mr-2 inline size-4" />
                  12:00 až 13:15
                </button>
                <div className="flex min-h-12 items-center gap-2 rounded-md border border-dashed px-4 text-sm text-muted-foreground">
                  <Info className="size-4" />
                  Žádné další termíny
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section
          aria-labelledby="kit-dark"
          className="rounded-lg bg-ink p-6 text-white"
        >
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2 id="kit-dark" className="text-2xl font-extrabold">
                Tmavá plocha
              </h2>
              <p className="mt-1 text-white/75">
                Pouze pro hero, ceník, závěrečnou výzvu, dlaždice zón, patičku a
                provozní navigaci. Akcentem je vždy zlatá, nikdy primární
                zelená.
              </p>
            </div>
            <div className="flex gap-3 text-gold">
              <Dumbbell aria-hidden="true" />
              <AlertTriangle aria-hidden="true" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
