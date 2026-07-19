"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface HeroAvailabilityDay {
  label: string;
  dateLabel: string;
  slots: { label: string; available: boolean }[];
}

export function HeroAvailability({
  days,
  price,
  freeEntryEvery,
  live,
}: {
  days: HeroAvailabilityDay[];
  price: string;
  freeEntryEvery: number;
  live: boolean;
}) {
  const availableDay = days.findIndex((day) => day.slots.some((slot) => slot.available));
  const [selectedDay, setSelectedDay] = useState(Math.max(0, availableDay));
  const day = days[selectedDay] ?? days[0];
  const availableCount = day?.slots.filter((slot) => slot.available).length ?? 0;

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

      <div className="flex gap-2 overflow-x-auto px-5 pb-1 pt-4 sm:px-6">
        {days.map((item, index) => (
          <button
            key={item.dateLabel}
            type="button"
            onClick={() => setSelectedDay(index)}
            className={`shrink-0 rounded-full border-2 px-4 py-1.5 text-xs font-bold transition-colors ${selectedDay === index ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/50"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {day && availableCount === 0 && (
        <div className="mx-5 mt-4 rounded-xl bg-muted/70 px-4 py-5 text-center sm:mx-6">
          <div className="text-sm font-extrabold">Tento den už není volný termín</div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">Vyberte další den a zobrazíme dostupné hodiny.</div>
        </div>
      )}
      <div className="grid grid-cols-4 gap-2 px-5 py-5 sm:px-6">
        {(day?.slots ?? []).slice(0, 8).map((slot) =>
          slot.available ? (
            <Link key={slot.label} href="/rezervace" className="rounded-[9px] border-2 border-primary/40 bg-primary/10 py-2 text-center text-sm font-bold transition-colors hover:border-primary hover:bg-primary">
              {slot.label}
            </Link>
          ) : (
            <span key={slot.label} className="rounded-[9px] bg-muted py-2 text-center text-sm font-medium text-muted-foreground/55 line-through">
              {slot.label}
            </span>
          ),
        )}
      </div>

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
