"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addDaysToDateKey,
  cachedDateTimeFormat,
  dateKeyInTimeZone,
  monthGrid,
} from "@/lib/helpers/datetime";
import { formatMoney } from "@/lib/helpers/format";
import {
  detailsHref,
  rewardPositions,
  withSelectedStarts,
} from "@/lib/helpers/booking-selection";
import { MAX_SLOTS_PER_ORDER } from "@/lib/config/orders";
import { Button, buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

/**
 * One calendar cell. Only the selected day needs its slots; every other day
 * needs a single flag, which keeps the month payload to a few kilobytes.
 */
export interface BookingDayView {
  dateKey: string;
  isClosed: boolean;
  hasAvailability: boolean;
}

/** An available slot of the selected day, ready to render. */
export interface BookingSlotView {
  startISO: string;
  label: string;
  durationMinutes: number;
}

/** A slot in the visitor's selection, possibly on another day. */
export interface SelectedSlotView {
  startISO: string;
  /** "čt 1. 10., 10:00 – 11:15" */
  label: string;
  priceCents: number;
}

/** A member's loyalty position, so the selection total can show rewards. */
export interface SelectionLoyalty {
  entriesUntilFree: number;
  cadence: number;
}

/** "3 termíny" / "5 termínů". */
function termCount(n: number): string {
  if (n === 1) return "1 termín";
  if (n >= 2 && n <= 4) return `${n} termíny`;
  return `${n} termínů`;
}

const weekdays = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

function displayDate(dateKey: string, options: Intl.DateTimeFormatOptions) {
  return cachedDateTimeFormat("cs-CZ", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export function BookingCalendar({
  monthKey,
  selectedDateKey,
  todayKey,
  minDateKey,
  maxDateKey,
  horizonDays,
  days,
  selectedSlots,
  selected,
  loyalty,
  source,
  priceCents,
}: {
  monthKey: string;
  selectedDateKey: string | null;
  todayKey: string;
  /** Earliest bookable day: opening day before launch, today afterwards. */
  minDateKey: string;
  maxDateKey: string;
  horizonDays: number;
  days: BookingDayView[];
  /** Available slots of `selectedDateKey`; empty when no day is selected. */
  selectedSlots: BookingSlotView[];
  /** The slots already picked, from the URL, in start order. */
  selected: SelectedSlotView[];
  /** Present for a signed-in member. */
  loyalty: SelectionLoyalty | null;
  source: "live" | "preview" | "unavailable";
  /** Price of a slot on the selected day, in cents. */
  priceCents: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRefreshing, startRefresh] = useTransition();
  const gridRef = useRef<HTMLDivElement>(null);
  const grid = monthGrid(monthKey);
  const byDate = new Map(days.map((day) => [day.dateKey, day]));
  const selectedDay = selectedDateKey ? byDate.get(selectedDateKey) : undefined;
  const availableSlots = selectedDateKey ? selectedSlots : [];
  // Months before the first bookable day hold nothing to book, so the calendar
  // does not go there: before opening day, paging back stops at the opening
  // month instead of showing a month of struck-through days.
  const minMonth = minDateKey.slice(0, 7);
  const maxMonth = maxDateKey.slice(0, 7);
  /*
   * The grid keeps one tab stop, and on a day that can be chosen: the
   * selected one, otherwise this month's first bookable day. It used to fall
   * on today, so a month reached through the next-month control had neither a
   * selection nor today in it and the grid could not be reached from the
   * keyboard.
   */
  const isSelectable = (dateKey: string) =>
    dateKey >= minDateKey && dateKey <= maxDateKey;
  const tabStopDateKey =
    selectedDateKey && isSelectable(selectedDateKey)
      ? selectedDateKey
      : (grid.find((cell) => cell.inMonth && isSelectable(cell.dateKey))
          ?.dateKey ?? null);
  const previousSelectedDate = useRef(selectedDateKey);

  /*
   * The selection lives in the URL (`start=…` repeated) so it survives a
   * reload and day or month changes. Picking a slot only rewrites the URL in
   * place: no request, no new history entry, and focus stays on the slot.
   */
  const [selection, setSelection] = useState(selected);
  const selectedKey = selected.map((slot) => slot.startISO).join(",");
  useEffect(() => {
    setSelection(selected);
    // The key stands for the array: a fresh render with the same selection
    // must not reset what the visitor has just picked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);
  const selectedStarts = new Set(selection.map((slot) => slot.startISO));
  const selectedPerDay = new Map<string, number>();
  for (const slot of selection) {
    const key = dateKeyInTimeZone(new Date(slot.startISO));
    selectedPerDay.set(key, (selectedPerDay.get(key) ?? 0) + 1);
  }
  const full = selection.length >= MAX_SLOTS_PER_ORDER;
  const rewards = loyalty
    ? rewardPositions(
        selection.length,
        loyalty.entriesUntilFree,
        loyalty.cadence,
      )
    : selection.map(() => false);
  const totalCents = selection.reduce(
    (sum, slot, index) => sum + (rewards[index] ? 0 : slot.priceCents),
    0,
  );
  const freeCount = rewards.filter(Boolean).length;
  const dayPrefix = selectedDateKey
    ? displayDate(selectedDateKey, {
        weekday: "short",
        day: "numeric",
        month: "numeric",
      })
    : "";

  useEffect(() => {
    if (
      selectedDateKey &&
      previousSelectedDate.current &&
      selectedDateKey !== previousSelectedDate.current
    ) {
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-date="${selectedDateKey}"]`)
        ?.focus();
    }
    previousSelectedDate.current = selectedDateKey;
  }, [selectedDateKey]);

  const buildHref = (
    next: { month?: string; date?: string | null },
    starts: readonly SelectedSlotView[] = selection,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("stav");
    if (next.month) params.set("month", next.month);
    if (next.date === null) params.delete("date");
    else if (next.date) params.set("date", next.date);
    return `/rezervace?${withSelectedStarts(
      params,
      starts.map((slot) => slot.startISO),
    ).toString()}`;
  };

  const updateSelection = (next: SelectedSlotView[]) => {
    const sorted = [...next].sort((a, b) =>
      a.startISO.localeCompare(b.startISO),
    );
    setSelection(sorted);
    window.history.replaceState(
      null,
      "",
      buildHref({ month: monthKey, date: selectedDateKey }, sorted),
    );
  };

  const toggleSlot = (slot: BookingSlotView) => {
    if (selectedStarts.has(slot.startISO)) {
      updateSelection(
        selection.filter((item) => item.startISO !== slot.startISO),
      );
      return;
    }
    if (full) return;
    updateSelection([
      ...selection,
      {
        startISO: slot.startISO,
        label: `${dayPrefix}, ${slot.label}`,
        priceCents,
      },
    ]);
  };

  const moveMonth = (delta: number) => {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(Date.UTC(year!, month! - 1 + delta, 1))
      .toISOString()
      .slice(0, 7);
  };

  const focusDate = (dateKey: string) => {
    const element = gridRef.current?.querySelector<HTMLElement>(
      `[data-date="${dateKey}"]`,
    );
    element?.focus();
  };

  const onDateKeyDown = (
    event: React.KeyboardEvent<HTMLAnchorElement>,
    dateKey: string,
  ) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      router.push(buildHref({ month: monthKey, date: dateKey }));
      return;
    }
    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -(grid.findIndex((cell) => cell.dateKey === dateKey) % 7),
      End: 6 - (grid.findIndex((cell) => cell.dateKey === dateKey) % 7),
    };
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const targetMonth = moveMonth(event.key === "PageUp" ? -1 : 1);
      if (targetMonth < minMonth || targetMonth > maxMonth) return;
      router.push(
        buildHref({
          month: targetMonth,
          date: null,
        }),
      );
      return;
    }
    const delta = deltas[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    focusDate(addDaysToDateKey(dateKey, delta));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.78fr)] lg:gap-12">
      <section aria-labelledby="calendar-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
              1. Datum
            </div>
            <h2 id="calendar-heading" className="mt-1 text-2xl font-extrabold">
              {displayDate(`${monthKey}-01`, {
                month: "long",
                year: "numeric",
              })}
            </h2>
          </div>
          <div className="flex gap-2">
            <Button
              href={buildHref({ month: moveMonth(-1), date: null })}
              variant="outline"
              size="icon"
              aria-disabled={monthKey <= minMonth}
              className={cn(
                monthKey <= minMonth && "pointer-events-none opacity-40",
              )}
              aria-label="Předchozí měsíc"
              tabIndex={monthKey <= minMonth ? -1 : undefined}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              href={buildHref({ month: moveMonth(1), date: null })}
              variant="outline"
              size="icon"
              aria-disabled={monthKey >= maxMonth}
              className={cn(
                monthKey >= maxMonth && "pointer-events-none opacity-40",
              )}
              aria-label="Následující měsíc"
              tabIndex={monthKey >= maxMonth ? -1 : undefined}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>

        {source === "unavailable" ? (
          <Notice
            tone="error"
            title="Termíny teď nelze načíst"
            className="mt-6"
            role="alert"
          >
            <p>Termíny se nepodařilo načíst. Zkuste načtení zopakovat.</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              disabled={isRefreshing}
              onClick={() => startRefresh(() => router.refresh())}
            >
              {isRefreshing ? "Načítám…" : "Zkusit znovu"}
            </Button>
          </Notice>
        ) : (
          <>
            {source === "preview" ? (
              <Notice
                tone="warning"
                title="Ilustrační náhled"
                className="mt-6"
                role="status"
              >
                Databáze není připojená. Tyto termíny slouží pouze k vyzkoušení
                rozhraní a nelze je považovat za aktuální dostupnost.
              </Notice>
            ) : null}
            <div
              ref={gridRef}
              role="grid"
              aria-label={`Kalendář, ${displayDate(`${monthKey}-01`, { month: "long", year: "numeric" })}`}
              className="mt-6 rounded-lg border border-border bg-card p-2 shadow-sm sm:p-4"
            >
              <div role="row" className="grid grid-cols-7 gap-1">
                {weekdays.map((day) => (
                  <div
                    key={day}
                    role="columnheader"
                    className="py-2 text-center text-xs font-extrabold uppercase tracking-wider text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid gap-1">
                {Array.from({ length: 6 }, (_, weekIndex) => (
                  <div
                    key={weekIndex}
                    role="row"
                    className="grid grid-cols-7 gap-1"
                  >
                    {grid
                      .slice(weekIndex * 7, weekIndex * 7 + 7)
                      .map((cell) => {
                        const day = byDate.get(cell.dateKey);
                        const isPast = cell.dateKey < todayKey;
                        // Before opening day: today, but still nothing to book.
                        const beforeOpening =
                          !isPast && cell.dateKey < minDateKey;
                        const outsideHorizon = cell.dateKey > maxDateKey;
                        const disabled =
                          !cell.inMonth ||
                          isPast ||
                          beforeOpening ||
                          outsideHorizon;
                        const hasAvailability = Boolean(day?.hasAvailability);
                        const selected = cell.dateKey === selectedDateKey;
                        const pickedHere =
                          selectedPerDay.get(cell.dateKey) ?? 0;
                        const label = displayDate(cell.dateKey, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        });
                        const cellClass = cn(
                          "relative flex aspect-square min-h-11 min-w-0 items-center justify-center rounded-sm border text-lg font-bold outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-xl",
                          !cell.inMonth && "invisible",
                          cell.inMonth && "border-transparent",
                          (isPast || beforeOpening || outsideHorizon) &&
                            "cursor-not-allowed text-muted-foreground/45 line-through",
                          cell.dateKey === todayKey && "border-border bg-muted",
                          hasAvailability &&
                            !selected &&
                            "border-primary/35 bg-primary/10",
                          selected &&
                            "border-primary bg-primary text-primary-foreground",
                        );
                        const content = Number(cell.dateKey.slice(-2));
                        const ariaLabel = `${label}${isPast ? ", minulý termín" : beforeOpening ? ", před otevřením" : outsideHorizon ? ", mimo rezervační období" : hasAvailability ? ", dostupné termíny" : ", bez volných termínů"}${pickedHere > 0 ? `, vybráno ${termCount(pickedHere)}` : ""}`;

                        return disabled ? (
                          <span
                            key={cell.dateKey}
                            role="gridcell"
                            aria-disabled="true"
                            aria-current={
                              cell.dateKey === todayKey ? "date" : undefined
                            }
                            aria-label={ariaLabel}
                            className={cellClass}
                          >
                            {content}
                          </span>
                        ) : (
                          <Link
                            key={cell.dateKey}
                            href={buildHref({
                              month: monthKey,
                              date: cell.dateKey,
                            })}
                            role="gridcell"
                            data-date={cell.dateKey}
                            aria-selected={selected}
                            aria-current={
                              cell.dateKey === todayKey ? "date" : undefined
                            }
                            aria-label={ariaLabel}
                            tabIndex={cell.dateKey === tabStopDateKey ? 0 : -1}
                            onKeyDown={(event) =>
                              onDateKeyDown(event, cell.dateKey)
                            }
                            className={cn(
                              cellClass,
                              !selected &&
                                "hover:border-primary/50 hover:bg-primary/10",
                            )}
                          >
                            {content}
                            {pickedHere > 0 ? (
                              <span
                                aria-hidden="true"
                                className="absolute right-0.5 top-0.5 min-w-4 rounded-sm bg-gold px-1 text-center text-xs font-extrabold leading-4 text-ink"
                              >
                                {pickedHere}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                {minDateKey > todayKey ? (
                  <span>
                    Termíny přijímáme od{" "}
                    {displayDate(minDateKey, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    , nejvýše {horizonDays} dní od dneška.
                  </span>
                ) : (
                  <span>Rezervovat lze nejvýše {horizonDays} dní dopředu.</span>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="slots-heading" className="lg:pt-[4.75rem]">
        <div className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
          2. Čas
        </div>
        <h2 id="slots-heading" className="mt-1 text-2xl font-extrabold">
          {selectedDateKey
            ? displayDate(selectedDateKey, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : "Vyberte datum"}
        </h2>

        <div aria-live="polite" aria-atomic="true" className="mt-6">
          {!selectedDateKey && source !== "unavailable" ? (
            <Notice title="Nejprve zvolte den">
              Po výběru data se zde zobrazí přesné časy začátku a konce.
            </Notice>
          ) : null}
          {selectedDateKey && selectedDay?.isClosed ? (
            <Notice tone="warning" title="Tento den je zavřeno">
              Vyberte jiné datum v kalendáři.
            </Notice>
          ) : null}
          {selectedDateKey &&
          selectedDay &&
          !selectedDay.isClosed &&
          availableSlots.length === 0 ? (
            <Notice tone="warning" title="Žádný volný termín">
              Pro tento den už nejsou k dispozici volné časy.
            </Notice>
          ) : null}
        </div>

        {availableSlots.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <p className="col-span-full text-sm font-semibold text-foreground">
              Uvedená cena platí za celý prostor, nikoli za osobu.
            </p>
            {/*
             * A slot is a toggle: it adds the time to the selection or takes
             * it out again, and the details step takes every selected slot
             * at once. It used to lead straight to that step, one slot per
             * payment.
             *
             * Solid `border-primary`: the border is the control's only
             * boundary, and at 35% it computed to 1.95:1 against the page,
             * under the 3:1 floor. The visible "Vybrat" / "Vybráno" is part
             * of the accessible name, and `aria-pressed` carries the state.
             */}
            {availableSlots.map((slot) => {
              const picked = selectedStarts.has(slot.startISO);
              return (
                <button
                  key={slot.startISO}
                  type="button"
                  aria-pressed={picked}
                  disabled={!picked && full}
                  onClick={() => toggleSlot(slot)}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-auto min-h-16 justify-between px-4 py-3",
                    picked
                      ? "border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      : "border-primary bg-primary/10 hover:bg-primary/20",
                  )}
                >
                  <span className="text-left">
                    <span className="block font-extrabold">{slot.label}</span>
                    <span
                      className={cn(
                        "mt-0.5 block text-sm font-medium",
                        picked
                          ? "text-primary-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {slot.durationMinutes} min · {formatMoney(priceCents)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-sm font-extrabold",
                      !picked && "text-accent-foreground",
                    )}
                  >
                    {picked ? (
                      <>
                        <Check aria-hidden="true" />
                        Vybráno
                      </>
                    ) : (
                      "Vybrat"
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {selectedDateKey && availableSlots.length > 0 ? (
          <div className="mt-6 flex gap-3 border-t border-border pt-5 text-sm text-muted-foreground">
            <Clock3
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-accent-foreground"
            />
            <p>
              Vyberte jeden nebo více termínů, i v různých dnech, a zaplaťte je
              najednou (nejvýše {MAX_SLOTS_PER_ORDER}). Opětovným klepnutím
              termín z výběru odeberete. Registrace není potřeba.
            </p>
          </div>
        ) : null}
      </section>

      {selection.length > 0 ? (
        /*
         * Sticky rather than fixed: it rides along at the bottom of the
         * viewport while the calendar is in view and settles into the page
         * before the footer, so it never covers the footer's links.
         */
        <div
          role="region"
          aria-label="Vybrané termíny"
          className="sticky bottom-0 z-30 -mx-5 border-t border-border bg-card px-5 py-3 shadow-md sm:mx-0 sm:rounded-lg sm:border lg:col-span-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p aria-live="polite" aria-atomic="true" className="text-sm">
              <span className="block text-base font-extrabold">
                Vybráno {termCount(selection.length)} ·{" "}
                {totalCents === 0 ? "zdarma" : formatMoney(totalCents)}
              </span>
              <span
                className={cn(
                  "text-muted-foreground",
                  // The slot list already says it on a phone; keep the bar short.
                  freeCount > 0 || full ? "block" : "hidden sm:block",
                )}
              >
                {freeCount > 0
                  ? `Z toho ${freeCount === 1 ? "jeden vstup" : `${freeCount} vstupy`} zdarma za věrnost. `
                  : ""}
                {full
                  ? `Najednou lze vybrat nejvýše ${MAX_SLOTS_PER_ORDER} termínů.`
                  : "Cena platí za celý prostor."}
              </span>
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => updateSelection([])}
              >
                Zrušit výběr
              </Button>
              <Button
                href={detailsHref(selection.map((slot) => slot.startISO))}
                className="flex-1 sm:flex-none"
              >
                Pokračovat <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
