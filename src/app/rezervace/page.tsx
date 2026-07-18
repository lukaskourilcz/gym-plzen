import Link from "next/link";
import { Info } from "lucide-react";
import { getWeekSlots, mondayOf } from "@/lib/services/slots";
import { loadSiteContent } from "@/lib/content/site";
import { getSession } from "@/lib/auth/guards";
import { formatMoney, formatTime } from "@/lib/helpers/format";
import { addMinutes } from "@/lib/helpers/datetime";
import { Container, Section } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { SlotButton } from "./slot-button";

export const metadata = { title: "Rezervace" };
// Availability must be fresh on every request.
export const dynamic = "force-dynamic";

const DAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const now = new Date();
  const baseMonday = mondayOf(now);
  const weekOffset = Number.isFinite(Number(w)) ? Number(w) : 0;
  const weekStart = addMinutes(baseMonday, weekOffset * 7 * 24 * 60);

  const [{ days, source }, content, session] = await Promise.all([
    getWeekSlots(weekStart, now),
    loadSiteContent(),
    getSession(),
  ]);
  const price = formatMoney(content.entryPriceCents);
  const isAuthed = Boolean(session);

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} logoUrl={content.logoUrl} />
      <main>
        <Section className="py-12 sm:py-16">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-primary">Rezervace</div>
                <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Vyberte si termín</h1>
                <p className="mt-2 text-muted-foreground">
                  Celý gym jen pro vás. Jeden trénink za {price}. Kliknutím na volný čas pokračujete k platbě.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/rezervace?w=${weekOffset - 1}`}
                  aria-disabled={weekOffset <= 0}
                  className={`rounded-md border border-border px-3 py-1.5 text-sm ${weekOffset <= 0 ? "pointer-events-none opacity-40" : "hover:bg-secondary"}`}
                >
                  ← Předchozí
                </Link>
                <Link
                  href={`/rezervace?w=${weekOffset + 1}`}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
                >
                  Další →
                </Link>
              </div>
            </div>

            {source === "demo" && (
              <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-accent/50 p-3 text-sm text-accent-foreground">
                <Info className="size-4 shrink-0" />
                Ukázkový rozvrh. Po připojení databáze se zobrazí skutečná dostupnost v reálném čase.
              </div>
            )}

            {/* Week grid */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {days.map((day, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <div className="mb-3 text-center">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">{DAY_LABELS[i]}</div>
                    <div className="text-lg font-bold">{day.date.getDate()}.</div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {day.slots.length === 0 && (
                      <div className="rounded-md bg-muted py-2 text-center text-xs text-muted-foreground">Zavřeno</div>
                    )}
                    {day.slots.map((slot, j) =>
                      slot.available ? (
                        isAuthed ? (
                          <SlotButton
                            key={j}
                            startsAtISO={slot.start.toISOString()}
                            label={formatTime(slot.start)}
                          />
                        ) : (
                          <Link
                            key={j}
                            href={`/login?next=${encodeURIComponent(`/rezervace?w=${weekOffset}`)}`}
                            className="rounded-md border border-primary/30 bg-primary/10 py-1.5 text-center text-sm font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
                          >
                            {formatTime(slot.start)}
                          </Link>
                        )
                      ) : (
                        <div
                          key={j}
                          className="cursor-not-allowed rounded-md border border-border bg-muted py-1.5 text-center text-sm text-muted-foreground line-through"
                        >
                          {formatTime(slot.start)}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Badge className="bg-primary/10">volno</Badge> lze rezervovat
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Badge variant="muted">obsazeno</Badge> už zabráno
              </span>
            </div>

            <p className="mt-8 text-sm text-muted-foreground">
              Platbu a doručení vstupního kódu (e-mail + WhatsApp) dokončíte po přihlášení. Nemáte účet?{" "}
              <Link href="/login" className="font-medium text-foreground underline">
                Zaregistrujte se
              </Link>
              .
            </p>
          </Container>
        </Section>
      </main>
      <SiteFooter brand={content.get("brand.name")} termsUrl={content.termsUrl} />
    </>
  );
}
