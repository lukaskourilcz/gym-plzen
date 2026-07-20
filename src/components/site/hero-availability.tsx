"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

export interface HeroAvailabilitySlot {
  label: string;
  /** Slot start as epoch milliseconds — used to compute the "past" state live. */
  startMs: number;
  /** Taken by a reservation or an admin block. */
  booked: boolean;
}

export interface HeroAvailabilityDay {
  label: string;
  dateLabel: string;
  slots: HeroAvailabilitySlot[];
}

type SlotState = "available" | "past" | "booked";

function slotState(slot: HeroAvailabilitySlot, nowMs: number): SlotState {
  // The clock wins first: once the start time has passed, the slot can no longer
  // be reached, regardless of whether it was ever booked.
  if (slot.startMs <= nowMs) return "past";
  if (slot.booked) return "booked";
  return "available";
}

export function HeroAvailability({
  days,
  price,
  freeEntryEvery,
  live,
  nowMs,
}: {
  days: HeroAvailabilityDay[];
  price: string;
  freeEntryEvery: number;
  live: boolean;
  /** Server clock at render time; the client keeps ticking from here so slots go live. */
  nowMs: number;
}) {
  // Start from the server clock to avoid a hydration mismatch, then tick live.
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [selectedDay, setSelectedDay] = useState(0);
  const dayCount = days.length;
  const day = days[Math.min(selectedDay, dayCount - 1)] ?? days[0];
  const availableCount =
    day?.slots.filter((slot) => slotState(slot, now) === "available").length ?? 0;

  const goPrev = () => setSelectedDay((d) => Math.max(0, d - 1));
  const goNext = () => setSelectedDay((d) => Math.min(dayCount - 1, d + 1));
  const canPrev = selectedDay > 0;
  const canNext = selectedDay < dayCount - 1;

  return (
    <div className="w-full overflow-hidden rounded-[18px] bg-background text-foreground shadow-[0_32px_64px_-16px_rgb(0_0_0/.5)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2.5 text-sm font-extrabold sm:text-base">
          <span className="relative flex size-2.5">
            {live && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-50" />}
            <span className="relative size-2.5 rounded-full bg-emerald-500" />
          </span>
          Volné termíny{live ? " · živě" : ""}
        </div>
        <span className="text-xs font-bold text-muted-foreground">{availableCount} volných hodin</span>
      </div>

      {/* Day navigation: arrows step through the nearest configured days. */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-6">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canPrev}
          aria-label="Předchozí den"
          className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-border bg-card text-muted-foreground transition-colors enabled:hover:border-primary/50 enabled:hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-extrabold">{day?.label}</div>
          <div className="text-xs font-semibold text-muted-foreground">
            {day ? new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long" }).format(new Date(day.dateLabel)) : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={!canNext}
          aria-label="Další den"
          className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-border bg-card text-muted-foreground transition-colors enabled:hover:border-primary/50 enabled:hover:text-foreground disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Day dots — position within the configured look-ahead window. */}
      <div className="flex justify-center gap-1.5 pt-3">
        {days.map((item, index) => (
          <button
            key={item.dateLabel}
            type="button"
            onClick={() => setSelectedDay(index)}
            aria-label={item.label}
            className={`size-1.5 rounded-full transition-colors ${index === selectedDay ? "bg-primary" : "bg-border hover:bg-primary/50"}`}
          />
        ))}
      </div>

      {/* Fixed grid: the layout never changes, only each slot's state does. */}
      <div className="grid grid-cols-4 gap-2 px-5 py-5 sm:px-6">
        {(day?.slots ?? []).map((slot) => {
          const state = slotState(slot, now);
          if (state === "available") {
            return (
              <Link
                key={slot.startMs}
                href="/rezervace"
                className="rounded-[9px] border-2 border-primary/40 bg-primary/10 py-2 text-center text-sm font-bold transition-colors hover:border-primary hover:bg-primary"
              >
                {slot.label}
              </Link>
            );
          }
          if (state === "booked") {
            return (
              <span
                key={slot.startMs}
                title="Obsazeno"
                className="rounded-[9px] border-2 border-destructive/30 bg-destructive/10 py-2 text-center text-sm font-bold text-destructive"
              >
                {slot.label}
              </span>
            );
          }
          // past — blacked out
          return (
            <span
              key={slot.startMs}
              title="Čas už proběhl"
              className="rounded-[9px] bg-ink py-2 text-center text-sm font-medium text-ink-foreground/35 line-through"
            >
              {slot.label}
            </span>
          );
        })}
      </div>

      {day && (day.slots.length === 0 || availableCount === 0) && (
        <div className="mx-5 mb-5 rounded-xl bg-muted/70 px-4 py-4 text-center sm:mx-6">
          <div className="text-sm font-extrabold">Tento den už není volný termín</div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">Šipkou přejděte na další den.</div>
        </div>
      )}

      <div className="mx-5 flex items-end justify-between border-t border-border py-4 sm:mx-6">
        <div>
          <strong className="text-2xl font-black tracking-[-.02em]">{price}</strong>
          <span className="text-xs font-semibold text-muted-foreground sm:text-sm"> / hodina · každý {freeEntryEvery}. vstup zdarma</span>
        </div>
        <Link href="/rezervace" className="ml-3 inline-flex shrink-0 items-center gap-1 text-sm font-extrabold text-accent-foreground hover:underline">
          Celý kalendář <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
