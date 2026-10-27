"use client";
import {
  changedReservationPrice,
  creditTender,
  type ReservationPriceSnapshot,
} from "@/lib/config/credits";
import { formatMoney } from "@/lib/helpers/format";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck2, ChevronLeft, ChevronRight } from "lucide-react";
import { cachedDateTimeFormat, monthGrid } from "@/lib/helpers/datetime";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePublicNotices } from "@/components/site/public-notices-provider";
import { Notice } from "@/components/ui/notice";
import { receiveAction } from "@/lib/helpers/action-response";
import { reportTransportError } from "@/lib/helpers/report-transport-error";
import { rescheduleReservationAction } from "./actions";

import type { CalendarView } from "@/lib/config/booking-calendar";
import {
  useCalendarAvailability,
  CALENDAR_CHANGE_EVENT,
} from "@/app/rezervace/use-calendar-availability";
import { addDaysToDateKey } from "@/lib/helpers/datetime";

const weekdays = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

function displayDate(dateKey: string, options: Intl.DateTimeFormatOptions) {
  return cachedDateTimeFormat("cs-CZ", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export function RescheduleCalendar({
  reservationId,
  originalLabel,
  initial,
  priceCents,
  priceSnapshot,
  availableCreditCents,
}: {
  reservationId: string;
  originalLabel: string;
  initial: CalendarView;
  priceCents: number;
  priceSnapshot: ReservationPriceSnapshot | null;
  availableCreditCents: number;
}) {
  const copy = usePublicNotices().reschedule;
  const { view, loading, refresh } = useCalendarAvailability(initial);
  const {
    monthKey,
    selectedDateKey,
    todayKey,
    minDateKey,
    maxDateKey,
    days,
    selectedSlots,
    source,
  } = view;
  const gridRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedStartISO, setSelectedStartISO] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [useCredits, setUseCredits] = useState(availableCreditCents > 0);
  const operationRef = useRef<string | null>(null);
  const targetPrice = (price: number) =>
    priceSnapshot ? changedReservationPrice(price, priceSnapshot) : priceCents;
  const grid = monthGrid(monthKey);
  const byDate = new Map(days.map((day) => [day.dateKey, day]));
  const selectedDay = selectedDateKey ? byDate.get(selectedDateKey) : undefined;
  const availableSlots =
    selectedDateKey && !loading
      ? selectedSlots.filter((slot) => !slot.booked)
      : [];
  const selectedSlot = availableSlots.find(
    (slot) => slot.startISO === selectedStartISO,
  );
  const newPrice = selectedSlot
    ? targetPrice(selectedSlot.priceCents)
    : priceCents;
  const difference = newPrice - priceCents;
  const usedCredits = creditTender(
    Math.max(0, difference),
    availableCreditCents,
    useCredits,
  );
  const cashDue = Math.max(0, difference) - usedCredits;
  // Paging back stops at the first bookable month; the ones before it hold no
  // day this reservation could move to.
  const minMonth = minDateKey.slice(0, 7);
  const maxMonth = maxDateKey.slice(0, 7);
  const basePath = `/account/rezervace/${reservationId}/zmenit`;

  useEffect(() => {
    if (interrupted) return;
    setSelectedStartISO(null);
    setServerError(null);
  }, [selectedDateKey, interrupted]);

  const buildHref = (next: { month?: string; date?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.month) params.set("month", next.month);
    if (next.date === null) params.delete("date");
    else if (next.date) params.set("date", next.date);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  useEffect(() => {
    if (!window.location.search) {
      const params = new URLSearchParams({ month: initial.monthKey });
      if (initial.selectedDateKey) params.set("date", initial.selectedDateKey);
      window.history.replaceState(null, "", `${basePath}?${params}`);
    }
  }, [basePath, initial.monthKey, initial.selectedDateKey]);
  const navigate = (month: string, date: string | null) => {
    if (isSubmitting || interrupted) return;
    window.history.pushState(null, "", buildHref({ month, date }));
    setSelectedStartISO(null);
    setServerError(null);
    void refresh(month, date);
  };
  const follow = (
    event: React.MouseEvent<HTMLAnchorElement>,
    month: string,
    date: string | null,
  ) => {
    if (
      event.button ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(month, date);
  };
  const keyDown = (
    event: React.KeyboardEvent<HTMLAnchorElement>,
    date: string,
  ) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      navigate(date.slice(0, 7), date);
      return;
    }
    const deltas: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (!(event.key in deltas)) return;
    event.preventDefault();
    const next = addDaysToDateKey(date, deltas[event.key]!);
    if (next < minDateKey || next > maxDateKey) return;
    if (next.slice(0, 7) !== monthKey) navigate(next.slice(0, 7), next);
    requestAnimationFrame(() =>
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-date="${next}"]`)
        ?.focus(),
    );
  };

  const moveMonth = (delta: number) => {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(Date.UTC(year!, month! - 1 + delta, 1))
      .toISOString()
      .slice(0, 7);
  };

  const previousMonth = moveMonth(-1);
  const nextMonth = moveMonth(1);

  const confirmChange = async () => {
    if (!selectedSlot || isSubmitting || interrupted || loading) return;
    setIsSubmitting(true);
    setServerError(null);
    const response = await receiveAction(() =>
      rescheduleReservationAction({
        reservationId,
        operationId:
          operationRef.current ?? (operationRef.current = crypto.randomUUID()),
        quotedCents: newPrice,
        useCredits,
        startsAt: selectedSlot.startISO,
      }),
    );
    if (!response.received) {
      setIsSubmitting(false);
      setInterrupted(true);
      reportTransportError(response.error, "booking.reschedule.transport");
      setServerError(
        "Nepodařilo se načíst výsledek změny. Rezervace již mohla být přesunuta. Než změnu zopakujete, zkontrolujte aktuální termín v účtu.",
      );
      return;
    }
    const result = response.result;
    if (!result.ok) {
      setServerError(result.error);
      setIsSubmitting(false);
      window.dispatchEvent(new Event(CALENDAR_CHANGE_EVENT));
      return;
    }
    // The action already revalidated /account, and a dynamic page is fetched
    // afresh on navigation. A refresh() fired right behind the push() started
    // a second, competing request for the same route, which the browser saw
    // end as "Connection closed" when one of them was abandoned.
    window.dispatchEvent(new Event(CALENDAR_CHANGE_EVENT));
    if (result.data.kind === "checkout") {
      window.location.assign(result.data.url);
      return;
    }
    if (result.data.kind === "processing") {
      router.push(`${basePath}?change_id=${result.data.changeId}`);
      router.refresh();
      return;
    }
    router.push("/account?zmena=uspesna");
  };

  if (source === "unavailable") {
    return (
      <Notice tone="error" title="Kalendář se nepodařilo načíst" role="alert">
        {interrupted ? serverError : "Původní rezervace zůstává platná."}
        {interrupted ? (
          <a href="/account" className="mt-4 block font-bold underline">
            Zkontrolovat rezervaci v účtu
          </a>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => void refresh(monthKey, selectedDateKey)}
        >
          Zkusit znovu
        </Button>
      </Notice>
    );
  }

  if (source === "preview") {
    return (
      <Notice tone="warning" title="Změna je dočasně nedostupná" role="alert">
        Kalendář není připojený k databázi. Původní rezervace zůstává beze
        změny.
      </Notice>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
      <section aria-labelledby="change-date-heading">
        <div className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
          1. Nové datum
        </div>
        <div className="mt-1 flex items-center justify-between gap-4">
          <h2 id="change-date-heading" className="text-2xl font-extrabold">
            {displayDate(`${monthKey}-01`, {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="flex gap-2">
            {previousMonth >= minMonth ? (
              <Button
                href={buildHref({ month: previousMonth, date: null })}
                prefetch={false}
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) =>
                  follow(e, previousMonth, null)
                }
                variant="outline"
                size="icon"
                aria-label="Předchozí měsíc"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled
                aria-label="Předchozí měsíc"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
            )}
            {nextMonth <= maxMonth ? (
              <Button
                href={buildHref({ month: nextMonth, date: null })}
                prefetch={false}
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) =>
                  follow(e, nextMonth, null)
                }
                variant="outline"
                size="icon"
                aria-label="Následující měsíc"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled
                aria-label="Následující měsíc"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-card p-3 sm:p-5">
          <div className="grid grid-cols-7 text-center text-[11px] font-extrabold uppercase tracking-[.08em] text-muted-foreground">
            {weekdays.map((weekday) => (
              <div key={weekday} className="py-2">
                {weekday}
              </div>
            ))}
          </div>
          <div ref={gridRef} className="grid grid-cols-7 gap-1">
            {grid.map((cell) => {
              const day = byDate.get(cell.dateKey);
              const selectable =
                cell.inMonth &&
                cell.dateKey >= minDateKey &&
                cell.dateKey <= maxDateKey;
              const hasAvailable = day?.hasAvailability;
              const selected = cell.dateKey === selectedDateKey;
              const dayNumber = Number(cell.dateKey.slice(-2));
              if (!selectable) {
                /*
                 * A day of this month that cannot be chosen says why; a day of
                 * the neighbouring month is filler and stays out of the
                 * accessibility tree entirely.
                 */
                const reason = !cell.inMonth
                  ? null
                  : cell.dateKey < todayKey
                    ? "minulý termín"
                    : cell.dateKey < minDateKey
                      ? "před otevřením"
                      : "mimo rezervační období";
                return (
                  <span
                    key={cell.dateKey}
                    aria-hidden={reason ? undefined : true}
                    aria-disabled={reason ? true : undefined}
                    aria-label={
                      reason
                        ? `${displayDate(cell.dateKey, {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}, ${reason}`
                        : undefined
                    }
                    className="grid min-h-12 place-items-center rounded-sm text-sm text-muted-foreground sm:min-h-14"
                  >
                    {cell.inMonth ? dayNumber : null}
                  </span>
                );
              }
              return (
                <a
                  key={cell.dateKey}
                  href={buildHref({ month: monthKey, date: cell.dateKey })}
                  onClick={(e) => follow(e, monthKey, cell.dateKey)}
                  onKeyDown={(e) => keyDown(e, cell.dateKey)}
                  data-date={cell.dateKey}
                  // The dot and the fill are visual only; the name says both.
                  aria-label={`${displayDate(cell.dateKey, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}${hasAvailable ? ", volné termíny" : ", bez volných termínů"}${selected ? ", vybráno" : ""}`}
                  aria-current={
                    selected
                      ? "true"
                      : cell.dateKey === todayKey
                        ? "date"
                        : undefined
                  }
                  className={cn(
                    "relative grid min-h-12 place-items-center rounded-sm border text-sm font-bold transition-colors sm:min-h-14",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-transparent hover:border-primary hover:bg-primary/10",
                  )}
                >
                  {dayNumber}
                  {hasAvailable ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute bottom-1.5 size-1.5 rounded-full",
                        selected ? "bg-primary-foreground" : "bg-primary",
                      )}
                    />
                  ) : null}
                </a>
              );
            })}
          </div>
          <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
            Tečka označuje den s alespoň jedním volným termínem.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="change-time-heading"
        className="lg:pt-[4.75rem]"
      >
        <div className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
          2. Nový čas
        </div>
        <h2 id="change-time-heading" className="mt-1 text-2xl font-extrabold">
          {selectedDateKey
            ? displayDate(selectedDateKey, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : "Vyberte datum"}
        </h2>

        {serverError ? (
          <p role="alert" className="mt-4 text-sm font-bold text-destructive">
            {serverError}
          </p>
        ) : null}
        {interrupted ? (
          <a href="/account" className="mt-4 block font-bold underline">
            Zkontrolovat rezervaci v účtu
          </a>
        ) : null}
        {loading ? (
          <p role="status" className="mt-6 text-sm text-muted-foreground">
            Načítám dostupné časy…
          </p>
        ) : null}
        {!selectedDateKey ? (
          <Notice className="mt-6" title="Nejprve zvolte den">
            Potom se zobrazí dostupné časy.
          </Notice>
        ) : null}
        {selectedDateKey && selectedDay?.isClosed ? (
          <Notice className="mt-6" tone="warning" title="Tento den je zavřeno">
            Vyberte jiné datum v kalendáři.
          </Notice>
        ) : null}
        {selectedDateKey &&
        selectedDay &&
        !loading &&
        !selectedDay.isClosed &&
        availableSlots.length === 0 ? (
          <Notice className="mt-6" tone="warning" title="Žádný volný termín">
            {copy.empty}
          </Notice>
        ) : null}

        {availableSlots.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {availableSlots.map((slot) => {
              const selected = slot.startISO === selectedStartISO;
              return (
                <Button
                  key={slot.startISO}
                  type="button"
                  variant="outline"
                  aria-pressed={selected}
                  onClick={() => {
                    operationRef.current = null;
                    setSelectedStartISO(slot.startISO);
                    setServerError(null);
                  }}
                  className={cn(
                    "h-auto min-h-16 justify-between border-primary px-4 py-3",
                    selected
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      : "bg-primary/10 hover:bg-primary/20",
                  )}
                >
                  <span className="text-left">
                    <span className="block font-extrabold">{slot.label}</span>
                    <span
                      className={cn(
                        "mt-0.5 block text-xs font-medium",
                        selected
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground",
                      )}
                    >
                      {slot.durationMinutes} min ·{" "}
                      {targetPrice(slot.priceCents) === priceCents
                        ? "bez doplatku"
                        : targetPrice(slot.priceCents) > priceCents
                          ? `doplatek ${formatMoney(targetPrice(slot.priceCents) - priceCents)}`
                          : `+${formatMoney(priceCents - targetPrice(slot.priceCents))} kreditů`}
                    </span>
                  </span>
                  <span className="text-xs font-extrabold">
                    {selected ? "Vybráno" : "Vybrat"}
                  </span>
                </Button>
              );
            })}
          </div>
        ) : null}

        {selectedSlot ? (
          <div className="mt-6 rounded-lg border border-primary bg-primary/10 p-5">
            <div className="flex gap-3">
              <CalendarCheck2
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-accent-foreground"
              />
              <div className="text-sm">
                <div className="font-extrabold">{copy.confirmation}</div>
                <dl className="mt-3 grid gap-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {copy.oldLabel}
                    </dt>
                    <dd className="font-bold">{originalLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {copy.newLabel}
                    </dt>
                    <dd className="font-bold">
                      {displayDate(selectedDateKey!, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      · {selectedSlot.label}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Původní cena</dt>
                <dd>{formatMoney(priceCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Nová cena</dt>
                <dd>{formatMoney(newPrice)}</dd>
              </div>
              {usedCredits > 0 ? (
                <div className="flex justify-between">
                  <dt>Úhrada kreditem</dt>
                  <dd>−{formatMoney(usedCredits)}</dd>
                </div>
              ) : null}
            </dl>
            {difference > 0 && availableCreditCents > 0 ? (
              <label className="mt-4 flex items-center gap-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={useCredits}
                  onChange={(e) => {
                    setUseCredits(e.target.checked);
                    operationRef.current = null;
                  }}
                />
                Použít dostupné kredity ({formatMoney(availableCreditCents)})
              </label>
            ) : null}
            {difference < 0 ? (
              <p className="mt-4 text-sm font-bold">
                {(
                  copy.creditRefund ||
                  "Rozdíl {amount} připíšeme do tvých kreditů pro další platbu. Na platební kartu se nevrací."
                ).replace("{amount}", formatMoney(-difference))}
              </p>
            ) : null}
            <Button
              type="button"
              size="lg"
              className="mt-5 w-full"
              disabled={isSubmitting || interrupted || loading}
              onClick={confirmChange}
            >
              {isSubmitting
                ? "Zpracovávám…"
                : cashDue > 0
                  ? `Zaplatit ${formatMoney(cashDue)} a změnit termín`
                  : difference < 0
                    ? `Změnit termín a získat ${formatMoney(-difference)} kreditů`
                    : copy.confirm}
            </Button>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {copy.note}
            </p>
          </div>
        ) : null}

        <Button href="/account" variant="ghost" className="mt-5">
          {interrupted ? "Zkontrolovat rezervaci" : "Zpět bez změny"}
        </Button>
      </section>
    </div>
  );
}
