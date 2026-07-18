import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Info,
  KeyRound,
  Moon,
  ShowerHead,
  Sun,
  Sunrise,
} from "lucide-react";
import { getDaySlots, BOOKING_DAYS_AHEAD, type Slot } from "@/lib/services/slots";
import { loadSiteContent } from "@/lib/content/site";
import { getSession } from "@/lib/auth/guards";
import { GYM_PHOTOS } from "@/lib/data/gym-photos";
import { formatMoney, formatTime } from "@/lib/helpers/format";
import { addMinutes, minuteOfDay, startOfDayTz } from "@/lib/helpers/datetime";
import { cn } from "@/lib/utils";
import { Container, Section } from "@/components/ui/container";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { PhotoCarousel } from "@/components/site/photo-carousel";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { SlotButton, slotCardClass } from "./slot-button";

export const metadata = { title: "Rezervace" };
// Availability must be fresh on every request.
export const dynamic = "force-dynamic";

// All labels follow the gym's timezone, same as slot generation (see slots.ts).
const TZ = "Europe/Prague";
const WEEKDAY_LONG = new Intl.DateTimeFormat("cs-CZ", { weekday: "long", timeZone: TZ });
const WEEKDAY_SHORT = new Intl.DateTimeFormat("cs-CZ", { weekday: "short", timeZone: TZ });
const DATE_LONG = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", timeZone: TZ });
const DAY_NUM = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", timeZone: TZ });

/** "Dnes" / "Zítra" / capitalized weekday for the day navigation heading. */
function dayLabel(offset: number, date: Date): string {
  if (offset === 0) return "Dnes";
  if (offset === 1) return "Zítra";
  const weekday = WEEKDAY_LONG.format(date);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

/** Group label + icon for a slot by its start hour (in the gym's timezone). */
function daypartOf(slot: Slot): "Ráno" | "Odpoledne" | "Večer" {
  const hour = Math.floor(minuteOfDay(slot.start) / 60);
  if (hour < 12) return "Ráno";
  if (hour < 17) return "Odpoledne";
  return "Večer";
}

const DAYPART_ICONS = { Ráno: Sunrise, Odpoledne: Sun, Večer: Moon } as const;

/**
 * Public booking page — one day at a time (arrows + a day strip on top switch
 * days), slots grouped into morning / afternoon / evening. Past slots of the
 * current day are hidden; taken ones show as "obsazeno".
 */
export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const now = new Date();
  const today = startOfDayTz(now);

  const parsed = Number(d);
  const dayOffset = Number.isFinite(parsed)
    ? Math.min(Math.max(Math.trunc(parsed), 0), BOOKING_DAYS_AHEAD - 1)
    : 0;
  // Anchor at the day's local noon so labels/queries stay put across DST.
  const dayStart = addMinutes(today, dayOffset * 24 * 60 + 12 * 60);

  const [{ slots, source }, content, session] = await Promise.all([
    getDaySlots(dayStart, now),
    loadSiteContent(),
    getSession(),
  ]);
  const price = formatMoney(content.entryPriceCents);
  const isAuthed = Boolean(session);

  // Hide slots that already ended today; group the rest by daypart.
  const visible = slots.filter((s) => !s.inPast);
  const freeCount = visible.filter((s) => s.available).length;
  const dayparts = (["Ráno", "Odpoledne", "Večer"] as const)
    .map((label) => ({ label, slots: visible.filter((s) => daypartOf(s) === label) }))
    .filter((g) => g.slots.length > 0);

  const prevDisabled = dayOffset <= 0;
  const nextDisabled = dayOffset >= BOOKING_DAYS_AHEAD - 1;

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} logoUrl={content.logoUrl} user={session?.user ?? null} />
      {/* Live calendar: refresh when reservations change (no-op if unconfigured). */}
      <RealtimeRefresher table="reservation" />
      <main>
        <Section className="py-10 sm:py-14">
          <Container>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-12">
              {/* Photos — the space sells itself (booking stays first on mobile) */}
              <div className="order-2 lg:order-1">
                <div className="lg:sticky lg:top-24">
                  <PhotoCarousel photos={GYM_PHOTOS} className="aspect-[16/10] lg:aspect-[4/5]" />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { icon: Dumbbell, label: "Celý gym jen pro vás" },
                      { icon: KeyRound, label: "Vstup kódem, bez recepce" },
                      { icon: ShowerHead, label: "Sprcha po tréninku" },
                    ].map((f) => (
                      <div
                        key={f.label}
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-3 text-center"
                      >
                        <f.icon className="size-4 text-primary" />
                        <span className="text-xs font-medium leading-snug">{f.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-center text-xs text-muted-foreground/80">
                    Ilustrační vizualizace — skutečné fotografie doplníme před spuštěním.
                  </p>
                </div>
              </div>

              {/* Booking — compact column on the right */}
              <div className="order-1 lg:order-2">
            <div className="text-center lg:text-left">
              <div className="text-sm font-semibold text-primary">Rezervace</div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Vyberte si termín</h1>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground lg:mx-0">
                Celý gym jen pro vás. Jeden trénink za {price}.
              </p>
            </div>

            {/* Day navigation: ← Dnes — pátek 18. července → */}
            <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
              <DayArrow
                href={`/rezervace?d=${dayOffset - 1}`}
                disabled={prevDisabled}
                label="Předchozí den"
              >
                <ChevronLeft className="size-5" />
              </DayArrow>
              <div className="text-center">
                <div className="text-base font-bold sm:text-lg">
                  {dayLabel(dayOffset, dayStart)}{" "}
                  <span className="font-medium text-muted-foreground">
                    · {WEEKDAY_LONG.format(dayStart)} {DATE_LONG.format(dayStart)}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {freeCount > 0
                    ? `Volných termínů: ${freeCount}`
                    : "Žádný volný termín"}
                </div>
              </div>
              <DayArrow
                href={`/rezervace?d=${dayOffset + 1}`}
                disabled={nextDisabled}
                label="Další den"
              >
                <ChevronRight className="size-5" />
              </DayArrow>
            </div>

            {/* Quick day strip — today + the next few days (BOOKING_DAYS_AHEAD) */}
            <div className="mt-4">
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {Array.from({ length: BOOKING_DAYS_AHEAD }, (_, i) => {
                  const date = addMinutes(today, i * 24 * 60 + 12 * 60);
                  const active = i === dayOffset;
                  return (
                    <Link
                      key={i}
                      href={`/rezervace?d=${i}`}
                      aria-current={active ? "date" : undefined}
                      className={cn(
                        "flex min-w-14 flex-col items-center rounded-xl border px-3 py-2 text-sm transition-colors",
                        active
                          ? "border-transparent bg-primary font-semibold text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      <span className="text-[11px] uppercase tracking-wide">
                        {i === 0 ? "dnes" : WEEKDAY_SHORT.format(date).replace(".", "")}
                      </span>
                      <span className="text-base font-bold leading-tight">{DAY_NUM.format(date)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {source === "demo" && (
              <div className="mt-6 flex items-center gap-2 rounded-lg border border-border bg-accent/50 p-3 text-sm text-accent-foreground">
                <Info className="size-4 shrink-0" />
                Ukázkový rozvrh. Po připojení databáze se zobrazí skutečná dostupnost v reálném čase.
              </div>
            )}

            {/* Slots for the selected day, grouped by daypart */}
            {dayparts.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-border bg-card p-10 text-center">
                <p className="font-medium">
                  {slots.length === 0
                    ? "Tento den je zavřeno."
                    : "Dnes už žádné termíny nezbývají."}
                </p>
                {!nextDisabled && (
                  <Link
                    href={`/rezervace?d=${dayOffset + 1}`}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    Zkusit další den <ChevronRight className="size-4" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="mt-8 space-y-8">
                {dayparts.map((group) => {
                  const GroupIcon = DAYPART_ICONS[group.label];
                  return (
                    <section key={group.label} aria-label={group.label}>
                      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        <GroupIcon className="size-4" /> {group.label}
                      </h2>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3">
                        {group.slots.map((slot) => {
                          const label = `${formatTime(slot.start)} – ${formatTime(slot.end)}`;
                          if (!slot.available) {
                            return (
                              <div
                                key={slot.start.toISOString()}
                                className={cn(slotCardClass, "cursor-not-allowed border-border bg-muted/60 text-muted-foreground/80")}
                              >
                                <span className="line-through">{label}</span>
                                <span className="block text-[10px] font-normal uppercase tracking-wider">obsazeno</span>
                              </div>
                            );
                          }
                          return isAuthed ? (
                            <SlotButton
                              key={slot.start.toISOString()}
                              startsAtISO={slot.start.toISOString()}
                              label={label}
                            />
                          ) : (
                            <Link
                              key={slot.start.toISOString()}
                              href={`/login?next=${encodeURIComponent(`/rezervace?d=${dayOffset}`)}`}
                              className={cn(
                                slotCardClass,
                                "border-primary/40 bg-primary/10 hover:bg-primary hover:text-primary-foreground",
                              )}
                            >
                              {label}
                              <span className="block text-[10px] font-normal uppercase tracking-wider opacity-70">volno</span>
                            </Link>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {!isAuthed && (
              <p className="mt-10 text-center text-sm text-muted-foreground lg:text-left">
                Platbu a doručení vstupního kódu (e-mail + WhatsApp) dokončíte po přihlášení. Nemáte účet?{" "}
                <Link href="/login" className="font-medium text-foreground underline">
                  Zaregistrujte se
                </Link>
                .
              </p>
            )}
              </div>
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter brand={content.get("brand.name")} termsUrl={content.termsUrl} />
    </>
  );
}

/** Round arrow button for day navigation; renders inert when disabled. */
function DayArrow({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className = cn(
    "grid size-11 shrink-0 place-items-center rounded-full border border-border transition-colors",
    disabled ? "opacity-35" : "hover:border-primary/50 hover:bg-primary/10",
  );
  if (disabled) {
    return (
      <span aria-hidden className={className}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={className}>
      {children}
    </Link>
  );
}
