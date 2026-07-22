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
import { BrandLogo, LotusMark } from "@/components/site/brand";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Design systém" };

const swatches = [
  ["Ink", "bg-ink text-white"],
  ["Primární", "bg-primary text-primary-foreground"],
  ["Plocha", "bg-card text-card-foreground"],
  ["Tlumená", "bg-muted text-muted-foreground"],
  ["Úspěch", "bg-success text-success-foreground"],
  ["Varování", "bg-warning text-warning-foreground"],
] as const;

export default function DesignSystemPage() {
  return (
    <div>
      <PageHeader
        title="Design systém"
        description="Referenční galerie komponent. Pravidla a tokeny jsou v docs/DESIGN_SYSTEM.md."
      />

      <div className="grid gap-8">
        <section aria-labelledby="kit-brand">
          <h2 id="kit-brand" className="mb-4 text-xl font-extrabold">
            Značka a typografie
          </h2>
          <Card>
            <CardContent className="grid gap-8 p-6 lg:grid-cols-2">
              <div className="flex flex-wrap items-center gap-8">
                <LotusMark className="size-14 text-accent-foreground" />
                <BrandLogo />
              </div>
              <div>
                <p className="text-4xl font-extrabold tracking-[-0.04em]">
                  Celý gym jen pro vás
                </p>
                <p className="mt-4 text-2xl font-extrabold tracking-[-0.025em]">
                  Klidný prostor pro soustředěný trénink
                </p>
                <p className="mt-3 max-w-xl text-muted-foreground">
                  Manrope s českou a Latin Extended sadou je společný font pro
                  rozhraní i marketing.
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
                  <span className="ml-2 font-medium text-white/60">
                    Přehled
                  </span>
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

        <section aria-labelledby="kit-colors">
          <h2 id="kit-colors" className="mb-4 text-xl font-extrabold">
            Barvy a plochy
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {swatches.map(([label, classes]) => (
              <div
                key={label}
                className={`${classes} min-h-24 rounded-lg border p-4 font-extrabold`}
              >
                {label}
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
              <label className="grid gap-1.5 text-sm font-bold">
                Neplatná hodnota
                <Input
                  aria-invalid="true"
                  defaultValue="chybná hodnota"
                  className="border-destructive"
                />
              </label>
              <Input disabled value="Pole je vypnuté" readOnly />
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
                <button className="min-h-12 rounded-md border border-primary bg-accent px-4 text-left font-extrabold">
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
              <p className="mt-1 text-white/65">
                Pouze pro hero, pravidla, patičku a provozní navigaci.
              </p>
            </div>
            <div className="flex gap-3">
              <Dumbbell className="text-primary" />
              <AlertTriangle className="text-warning" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
