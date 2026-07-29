"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

export interface HeroAvailabilitySlot {
  label: string;
  startMs: number;
  booked: boolean;
}

export interface HeroAvailabilityDay {
  label: string;
  dateLabel: string;
  slots: HeroAvailabilitySlot[];
}

type SlotState = "available" | "past" | "booked";

function getSlotState(slot: HeroAvailabilitySlot, nowMs: number): SlotState {
  if (slot.startMs <= nowMs) return "past";
  if (slot.booked) return "booked";
  return "available";
}

function getVisibleSlots(slots: HeroAvailabilitySlot[], nowMs: number) {
  const firstCurrent = slots.findIndex(
    (slot) => getSlotState(slot, nowMs) !== "past",
  );
  const start = firstCurrent > 1 ? firstCurrent - 2 : 0;
  return slots.slice(start, start + 8);
}

export function HeroAvailability({
  days,
  price,
  freeEntryEvery,
  source,
  nowMs,
}: {
  days: HeroAvailabilityDay[];
  price: string;
  freeEntryEvery: number;
  source: "live" | "preview" | "unavailable";
  nowMs: number;
}) {
  const [now, setNow] = useState(nowMs);
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const dayCount = days.length;
  const activeIndex = Math.min(selectedDay, Math.max(0, dayCount - 1));
  const day = days[activeIndex];
  const visibleSlots = getVisibleSlots(day?.slots ?? [], now);
  const reservationHref = day
    ? `/rezervace?date=${encodeURIComponent(day.dateLabel)}`
    : "/rezervace";

  return (
    <section
      aria-labelledby="hero-availability-title"
      className="w-full overflow-hidden rounded-sm border border-border bg-background text-foreground shadow-md"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
        <div
          id="hero-availability-title"
          className="flex items-center gap-2.5 text-sm font-extrabold sm:text-base"
        >
          <span
            aria-hidden="true"
            className={`size-2.5 rounded-full ${source === "live" ? "bg-success" : source === "preview" ? "bg-warning" : "bg-destructive"}`}
          />
          Nejbližší termíny
        </div>
        {source === "live" ? null : (
          <span
            className="text-right text-xs font-bold text-muted-foreground"
            aria-live="polite"
          >
            {source === "preview"
              ? "Ukázková dostupnost"
              : "Dočasně nedostupné"}
          </span>
        )}
      </div>

      {day ? (
        <>
          <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
            <button
              type="button"
              onClick={() => setSelectedDay((value) => Math.max(0, value - 1))}
              disabled={activeIndex === 0}
              aria-label="Předchozí den"
              className="grid size-11 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground transition-colors enabled:hover:border-primary enabled:hover:text-foreground disabled:opacity-35"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <div className="min-w-0 text-center">
              <div className="truncate text-sm font-extrabold">{day.label}</div>
              <div className="text-xs text-muted-foreground">
                {new Intl.DateTimeFormat("cs-CZ", {
                  day: "numeric",
                  month: "long",
                  timeZone: "UTC",
                }).format(new Date(`${day.dateLabel}T12:00:00Z`))}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setSelectedDay((value) => Math.min(dayCount - 1, value + 1))
              }
              disabled={activeIndex >= dayCount - 1}
              aria-label="Další den"
              className="grid size-11 shrink-0 place-items-center rounded-sm border border-border text-muted-foreground transition-colors enabled:hover:border-primary enabled:hover:text-foreground disabled:opacity-35"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>

          {visibleSlots.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 px-4 py-4 sm:grid-cols-4 sm:px-5">
              {visibleSlots.map((slot) => {
                const state = getSlotState(slot, now);
                if (state === "available") {
                  return (
                    <Link
                      key={slot.startMs}
                      href={reservationHref}
                      className="min-h-11 rounded-sm border border-primary/45 bg-primary/10 px-2 py-2 text-center text-xs font-extrabold transition-colors hover:border-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {slot.label}
                    </Link>
                  );
                }
                return (
                  <span
                    key={slot.startMs}
                    title={state === "booked" ? "Obsazeno" : "Čas už proběhl"}
                    className="grid min-h-11 place-items-center rounded-sm bg-muted px-2 py-2 text-center text-xs font-semibold text-muted-foreground line-through"
                  >
                    {slot.label}
                    <span className="sr-only">
                      {state === "booked" ? ", obsazeno" : ", čas už proběhl"}
                    </span>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="mx-4 my-4 border border-border bg-muted/55 px-4 py-5 text-center text-sm text-muted-foreground sm:mx-5">
              Pro tento den nejsou vypsané termíny. Zkuste následující den.
            </p>
          )}
        </>
      ) : (
        <p className="mx-4 my-4 border border-destructive/30 bg-destructive/5 px-4 py-5 text-center text-sm text-destructive sm:mx-5">
          Dostupnost teď nelze načíst. Zkuste to prosím později.
        </p>
      )}

      <div className="mx-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border py-4 sm:mx-5">
        <p className="text-base font-extrabold text-accent-foreground">
          {price} za vstup
          <span className="font-bold text-foreground">
            {" "}
            · každý {freeEntryEvery}. zdarma
          </span>
        </p>
        <Link
          href={reservationHref}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Otevřít kalendář <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}
