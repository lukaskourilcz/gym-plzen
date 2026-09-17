"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck2, ChevronLeft, ChevronRight } from "lucide-react";
import { cachedDateTimeFormat, monthGrid } from "@/lib/helpers/datetime";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { rescheduleReservationAction } from "./actions";

interface RescheduleDayView {
  dateKey: string;
  isClosed: boolean;
  hasAvailability: boolean;
}

interface RescheduleSlotView {
  startISO: string;
  label: string;
  durationMinutes: number;
}

const weekdays = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

function displayDate(dateKey: string, options: Intl.DateTimeFormatOptions) {
  return cachedDateTimeFormat("cs-CZ", {
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

export function RescheduleCalendar({
  reservationId,
  monthKey,
  selectedDateKey,
  todayKey,
  maxDateKey,
  originalLabel,
  days,
  selectedSlots,
  source,
}: {
  reservationId: string;
  monthKey: string;
  selectedDateKey: string | null;
  todayKey: string;
  maxDateKey: string;
  originalLabel: string;
  days: RescheduleDayView[];
  /** Available slots of `selectedDateKey`; empty when no day is selected. */
  selectedSlots: RescheduleSlotView[];
  source: "live" | "preview" | "unavailable";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedStartISO, setSelectedStartISO] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const grid = monthGrid(monthKey);
  const byDate = new Map(days.map((day) => [day.dateKey, day]));
  const selectedDay = selectedDateKey ? byDate.get(selectedDateKey) : undefined;
  const availableSlots = selectedDateKey ? selectedSlots : [];
  const selectedSlot = availableSlots.find(
    (slot) => slot.startISO === selectedStartISO,
  );
  const currentMonth = todayKey.slice(0, 7);
  const maxMonth = maxDateKey.slice(0, 7);
  const basePath = `/account/rezervace/${reservationId}/zmenit`;

  useEffect(() => {
    setSelectedStartISO(null);
    setServerError(null);
  }, [selectedDateKey]);

  const buildHref = (next: { month?: string; date?: string | null }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.month) params.set("month", next.month);
    if (next.date === null) params.delete("date");
    else if (next.date) params.set("date", next.date);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
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
    if (!selectedSlot || isSubmitting) return;
    setIsSubmitting(true);
    setServerError(null);
    const result = await rescheduleReservationAction({
      reservationId,
      startsAt: selectedSlot.startISO,
    });
    if (!result.ok) {
      setServerError(result.error);
      setIsSubmitting(false);
      router.refresh();
      return;
    }
    // The action already revalidated /account, and a dynamic page is fetched
    // afresh on navigation. A refresh() fired right behind the push() started
    // a second, competing request for the same route, which the browser saw
    // end as "Connection closed" when one of them was abandoned.
    router.push("/account?zmena=uspesna");
  };

  if (source === "unavailable") {
    return (
      <Notice tone="error" title="Kalendář se nepodařilo načíst" role="alert">
        Zkuste stránku obnovit. Původní rezervace zůstává beze změny.
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
            {previousMonth >= currentMonth ? (
              <Button
                href={buildHref({ month: previousMonth, date: null })}
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
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell) => {
              const day = byDate.get(cell.dateKey);
              const selectable =
                cell.inMonth &&
                cell.dateKey >= todayKey &&
                cell.dateKey <= maxDateKey;
              const hasAvailable = day?.hasAvailability;
              const selected = cell.dateKey === selectedDateKey;
              const dayNumber = Number(cell.dateKey.slice(-2));
              if (!selectable) {
                return (
                  <span
                    key={cell.dateKey}
                    aria-hidden="true"
                    className="grid min-h-12 place-items-center rounded-sm text-sm text-muted-foreground/35 sm:min-h-14"
                  >
                    {dayNumber}
                  </span>
                );
              }
              return (
                <Link
                  key={cell.dateKey}
                  href={buildHref({ month: monthKey, date: cell.dateKey })}
                  aria-label={displayDate(cell.dateKey, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                  aria-current={cell.dateKey === todayKey ? "date" : undefined}
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
                </Link>
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
        !selectedDay.isClosed &&
        availableSlots.length === 0 ? (
          <Notice className="mt-6" tone="warning" title="Žádný volný termín">
            Pro tento den nejsou dostupné žádné časy.
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
                      {slot.durationMinutes} min · bez doplatku
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
                <div className="font-extrabold">Potvrzení změny</div>
                <dl className="mt-3 grid gap-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Původní</dt>
                    <dd className="font-bold">{originalLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Nový</dt>
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
            {serverError ? (
              <p
                role="alert"
                className="mt-4 text-sm font-bold text-destructive"
              >
                {serverError}
              </p>
            ) : null}
            <Button
              type="button"
              size="lg"
              className="mt-5 w-full"
              disabled={isSubmitting}
              onClick={confirmChange}
            >
              {isSubmitting ? "Měním termín…" : "Potvrdit změnu termínu"}
            </Button>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Potvrzením se nový termín obsadí a původní se uvolní. Tuto změnu
              už nebude možné opakovat.
            </p>
          </div>
        ) : null}

        <Button href="/account" variant="ghost" className="mt-5">
          Zpět bez změny
        </Button>
      </section>
    </div>
  );
}
