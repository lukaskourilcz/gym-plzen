import Link from "next/link";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { getWeekSlots, mondayOf } from "@/lib/services/slots";
import { loadSiteContent } from "@/lib/content/site";
import { getSession } from "@/lib/auth/guards";
import { formatMoney, formatTime } from "@/lib/helpers/format";
import { addMinutes } from "@/lib/helpers/datetime";
import { Container, Section } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { RealtimeRefresher } from "@/components/realtime-refresher";
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
  const weekEnd = addMinutes(weekStart, 6 * 24 * 60);
  const weekLabel = `${weekStart.getDate()}. ${weekStart.getMonth() + 1}. – ${weekEnd.getDate()}. ${weekEnd.getMonth() + 1}. ${weekEnd.getFullYear()}`;

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} logoUrl={content.logoUrl} />
      {/* Live calendar: refresh when reservations change (no-op if unconfigured). */}
      <RealtimeRefresher table="reservation" />
      <main>
        <Section className="pb-28 pt-14">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[.14em] text-primary">Rezervace</div>
                <h1 className="mt-2 text-4xl font-black tracking-[-.03em] sm:text-[44px]">Vyberte si termín</h1>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  Hodinová rezervace celého prostoru stojí {price}. Vyberte volný termín a pokračujte k platbě.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Link
                  href={`/rezervace?w=${weekOffset - 1}`}
                  aria-disabled={weekOffset <= 0}
                  aria-label="Předchozí týden"
                  className={`grid size-10 place-items-center rounded-[10px] border border-border bg-card ${weekOffset <= 0 ? "pointer-events-none opacity-35" : "hover:bg-secondary"}`}
                >
                  <ChevronLeft className="size-4" />
                </Link>
                <div className="min-w-40 text-center text-sm font-extrabold">{weekLabel}</div>
                <Link
                  href={`/rezervace?w=${weekOffset + 1}`}
                  aria-label="Další týden"
                  className="grid size-10 place-items-center rounded-[10px] border border-border bg-card hover:bg-secondary"
                >
                  <ChevronRight className="size-4" />
                </Link>
                {weekOffset !== 0 && <Link href="/rezervace" className="ml-1 rounded-[10px] border border-border bg-card px-4 py-2.5 text-sm font-bold hover:bg-secondary">Dnes</Link>}
              </div>
            </div>

            {source === "demo" && (
              <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-accent/50 p-3 text-sm text-accent-foreground">
                <Info className="size-4 shrink-0" />
                Zobrazené termíny jsou ilustrační. Po připojení databáze se načte aktuální dostupnost.
              </div>
            )}

            <div className="mt-9 overflow-x-auto rounded-[18px] border border-border bg-card shadow-sm">
              <div className="grid min-w-[760px] grid-cols-7 border-b border-border">
                {days.map((day, i) => (
                  <div key={i} className={`border-l border-border/70 px-2 py-3.5 text-center first:border-l-0 ${day.date.toDateString() === now.toDateString() ? "bg-primary/10" : ""}`}>
                    <div className={`text-[11px] font-extrabold uppercase tracking-[.1em] ${day.date.toDateString() === now.toDateString() ? "text-accent-foreground" : "text-muted-foreground"}`}>{DAY_LABELS[i]}</div>
                    <div className="mt-0.5 text-xl font-extrabold">{day.date.getDate()}.</div>
                    {day.date.toDateString() === now.toDateString() && <div className="mx-auto mt-1 h-[3px] w-8 rounded-full bg-primary" />}
                  </div>
                ))}
              </div>
              <div className="grid min-w-[760px] grid-cols-7">
                {days.map((day, i) => (
                  <div key={i} className="flex flex-col gap-1.5 border-l border-border/70 px-2 py-3 first:border-l-0">
                    {day.slots.length === 0 && (
                      <div className="rounded-lg bg-muted py-4 text-center text-xs font-semibold text-muted-foreground">Zavřeno</div>
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
                            className="rounded-lg border-[1.5px] border-primary/40 bg-primary/10 py-2 text-center text-sm font-bold transition-colors hover:bg-primary"
                          >
                            {formatTime(slot.start)}
                          </Link>
                        )
                      ) : (
                        <div
                          key={j}
                          className="cursor-not-allowed rounded-lg bg-muted/70 py-2 text-center text-sm font-medium text-muted-foreground/60"
                        >
                          {formatTime(slot.start)}
                        </div>
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-6 text-sm font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Badge className="bg-primary/10">Volno</Badge>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Badge variant="muted">Obsazeno</Badge>
              </span>
            </div>

            <p className="mt-8 text-sm text-muted-foreground">
              Pro dokončení rezervace se přihlaste nebo si vytvořte účet.{" "}
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
