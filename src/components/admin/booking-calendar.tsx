"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import csLocale from "@fullcalendar/core/locales/cs";
import type { DatesSetArg, EventInput } from "@fullcalendar/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminMemberName } from "@/components/admin/member-name";
import { cn } from "@/lib/utils";
import {
  loadCalendarBlockChoicesAction,
  saveCalendarBlockSelectionAction,
} from "@/app/admin/calendar/actions";
import type {
  CalendarBlockWindow,
  CalendarBlockSelection,
} from "@/lib/config/calendar-blocking";
import { minuteOfDay } from "@/lib/helpers/datetime";
import { minutesToHHmm } from "@/lib/helpers/format";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
  DEFAULT_SLOT_MINUTES,
} from "@/lib/config/schedule";

const CALENDAR_VIEWS = [
  ["timeGridWeek", "Týden"],
  ["timeGridDay", "Den"],
  ["dayGridMonth", "Měsíc"],
] as const;

/**
 * Operational calendar with an explicit, keyboard-accessible block selection
 * mode. Choices are real configured slots read from the server; all writes
 * are revalidated atomically and never invoke reservation cancellation.
 */
export function BookingCalendar({
  events,
  openMinute = DEFAULT_OPEN_MINUTE,
  closeMinute = DEFAULT_CLOSE_MINUTE,
  slotMinutes = DEFAULT_SLOT_MINUTES,
  readOnly = false,
}: {
  events: EventInput[];
  openMinute?: number;
  closeMinute?: number;
  slotMinutes?: number;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowStyleRef = useRef<HTMLStyleElement>(null);
  const calendarId = useId();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<CalendarBlockWindow[]>([]);
  const [choices, setChoices] = useState<{
    windows: CalendarBlockWindow[];
    scheduleFingerprint: string;
  } | null>(null);
  const [loadingChoices, setLoadingChoices] = useState(false);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingRequest = useRef<CalendarBlockSelection | null>(null);
  const saving = useRef(false);
  const fingerprint = useRef<string | null>(null);
  const [reloadChoices, setReloadChoices] = useState(0);
  const [title, setTitle] = useState("");
  const [viewType, setViewType] = useState("timeGridWeek");
  const [todayInRange, setTodayInRange] = useState(true);
  const syncToolbar = useCallback(({ view, startStr, endStr }: DatesSetArg) => {
    setRange((old) =>
      old?.from === startStr.slice(0, 10) && old.to === endStr.slice(0, 10)
        ? old
        : { from: startStr.slice(0, 10), to: endStr.slice(0, 10) },
    );
    setTitle(view.title);
    setViewType(view.type);
    const now = new Date();
    setTodayInRange(now >= view.currentStart && now < view.currentEnd);
  }, []);

  /*
   * A seven-column time grid is useful on tablets and desktops, but each day
   * becomes too narrow to scan or tap on a phone. Start compact screens in a
   * day view and keep the view appropriate when the device rotates. A visitor
   * can still choose another view afterwards; this only reacts to a breakpoint
   * change, not to their explicit calendar choice.
   */
  useEffect(() => {
    const compact = window.matchMedia("(max-width: 639px)");
    const syncView = () => {
      const calendar = calendarRef.current?.getApi();
      if (!calendar) return;
      if (compact.matches && calendar.view.type === "timeGridWeek") {
        calendar.changeView("timeGridDay");
      } else if (!compact.matches && calendar.view.type === "timeGridDay") {
        calendar.changeView("timeGridWeek");
      }
    };

    syncView();
    compact.addEventListener("change", syncView);
    return () => compact.removeEventListener("change", syncView);
  }, []);

  // TimeGrid positions events absolutely, so their text cannot naturally size
  // the table row. Measure only foreground names, then resize that slot alone.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frame = 0;
    let disposed = false;
    const observedNames = new Set<HTMLElement>();
    const resizeRows = () => {
      frame = 0;
      const heights = new Map<number, number>();
      for (const name of observedNames) {
        if (!container.contains(name)) {
          sizeObserver.unobserve(name);
          observedNames.delete(name);
        }
      }
      container
        .querySelectorAll<HTMLElement>(
          ".fc-timegrid-event .admin-calendar-name[data-start-minute]",
        )
        .forEach((name) => {
          if (!observedNames.has(name)) {
            observedNames.add(name);
            sizeObserver.observe(name);
          }
          const minute = Number(name.dataset.startMinute);
          const row = Math.max(
            0,
            Math.floor((minute - openMinute) / slotMinutes),
          );
          heights.set(
            row,
            Math.max(
              heights.get(row) ?? 44,
              Math.ceil(name.getBoundingClientRect().height) + 16,
            ),
          );
        });
      // Keep sizing outside FullCalendar's managed DOM: its redraw can replace
      // table rows, but these scoped rules must survive that redraw.
      const rules = [...heights]
        .map(
          ([row, height]) =>
            `[data-calendar-id="${calendarId}"] .fc-timegrid-slots tr:nth-child(${row + 1}) { --calendar-row-height: ${height}px; }`,
        )
        .join("\n");
      if (rowStyleRef.current && rowStyleRef.current.textContent !== rules) {
        rowStyleRef.current.textContent = rules;
        // updateSize alone keeps TimeGrid's cached slat coordinates when the
        // width is unchanged. A fresh duration object rebuilds those coordinates
        // without changing the time scale, current view, date or keyboard focus.
        calendarRef.current
          ?.getApi()
          .setOption("slotDuration", { minutes: slotMinutes });
      }
    };
    const scheduleResize = () => {
      if (!frame) frame = requestAnimationFrame(resizeRows);
    };
    const sizeObserver = new ResizeObserver(scheduleResize);
    sizeObserver.observe(container);
    const contentObserver = new MutationObserver(scheduleResize);
    contentObserver.observe(container.querySelector(".fc") ?? container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    scheduleResize();
    void document.fonts.ready.then(() => {
      if (!disposed) scheduleResize();
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      contentObserver.disconnect();
    };
  }, [events, openMinute, slotMinutes, calendarId]);

  // Server Actions may return a fresh RSC array with identical events. Reload
  // choices only when their actual contents change, never on object identity.
  const eventRevision = JSON.stringify(events);
  useEffect(() => {
    if (!selecting || !range) return;
    let active = true;
    setLoadingChoices(true);
    setChoices(null);
    setActionError(null);
    void loadCalendarBlockChoicesAction(range)
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setActionError(result.error);
          return;
        }
        if (
          fingerprint.current &&
          fingerprint.current !== result.data.scheduleFingerprint
        ) {
          setSelected([]);
          pendingRequest.current = null;
          setActionError(
            "Rozvrh se změnil. Předchozí výběr byl vymazán; vyberte termíny znovu.",
          );
        }
        fingerprint.current = result.data.scheduleFingerprint;
        setChoices(result.data);
      })
      .catch(() => {
        if (active)
          setActionError(
            "Volné termíny se nepodařilo načíst. Zkuste načtení znovu.",
          );
      })
      .finally(() => {
        if (active) setLoadingChoices(false);
      });
    return () => {
      active = false;
    };
  }, [selecting, range, eventRevision, reloadChoices]);

  function toggleWindow(window: CalendarBlockWindow) {
    if (saving.current || uncertain || loadingChoices) return;
    pendingRequest.current = null;
    setSelected((old) =>
      old.some((w) => w.startISO === window.startISO)
        ? old.filter((w) => w.startISO !== window.startISO)
        : old.length < 200
          ? [...old, window]
          : old,
    );
  }
  async function saveSelection() {
    if (saving.current || !selected.length || !choices) return;
    saving.current = true;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    const request = pendingRequest.current ?? {
      operationId: crypto.randomUUID(),
      windows: selected,
      scheduleFingerprint: choices.scheduleFingerprint,
    };
    pendingRequest.current = request;
    try {
      const result = await saveCalendarBlockSelectionAction(request);
      if (!result.ok) {
        const unknownOutcome =
          result.error === "Došlo k neočekávané chybě. Zkuste to prosím znovu.";
        setUncertain(unknownOutcome);
        if (!unknownOutcome) pendingRequest.current = null;
        setActionError(
          unknownOutcome
            ? "Uložení se nepodařilo potvrdit. Tlačítkem Uložit blokované termíny ověřte stejnou dávku."
            : result.error,
        );
        return;
      }
      setNotice(`Uloženo ${result.data.count} blokovaných termínů.`);
      setSelected([]);
      setSelecting(false);
      setChoices(null);
      fingerprint.current = null;
      pendingRequest.current = null;
      setUncertain(false);
      router.refresh();
    } catch {
      setUncertain(true);
      setActionError(
        "Výsledek uložení se nepodařilo načíst. Tlačítkem Uložit blokované termíny ověřte stejnou dávku; termíny se neuloží dvakrát.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const selectionEvents: EventInput[] =
    selecting && viewType !== "dayGridMonth" && !loadingChoices && choices
      ? choices.windows.map((window) => ({
          id: `select/${window.startISO}`,
          start: window.startISO,
          end: window.endISO,
          title: "Volný termín",
          // Native buttons inside the event own keyboard activation; the
          // FullCalendar anchor must not consume Space/Enter first.
          interactive: false,
          classNames: ["admin-calendar-choice"],
          backgroundColor: "transparent",
          borderColor: "transparent",
          extendedProps: { blockChoice: window },
        }))
      : [];

  return (
    <div
      ref={containerRef}
      data-calendar-id={calendarId}
      className={cn(
        "admin-booking-calendar",
        selecting && "admin-calendar-selecting",
      )}
    >
      <style ref={rowStyleRef} />
      <div className="admin-calendar-toolbar mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          className="w-full text-lg font-semibold sm:w-auto sm:flex-1"
          aria-live="polite"
          aria-atomic="true"
        >
          {title || "Načítám kalendář…"}
        </h2>
        <div
          className="flex items-center gap-2"
          role="group"
          aria-label="Posun kalendáře"
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Předchozí období"
            disabled={busy || uncertain}
            onClick={() => calendarRef.current?.getApi().prev()}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Další období"
            disabled={busy || uncertain}
            onClick={() => calendarRef.current?.getApi().next()}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={todayInRange || busy || uncertain}
            onClick={() => calendarRef.current?.getApi().today()}
          >
            Dnes
          </Button>
        </div>
        <div
          className="flex w-full gap-1 rounded-md border border-border bg-secondary/50 p-1 sm:w-auto"
          role="group"
          aria-label="Zobrazení kalendáře"
        >
          {CALENDAR_VIEWS.map(([view, label]) => (
            <Button
              key={view}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={viewType === view}
              disabled={busy || uncertain}
              className={cn(
                "flex-1 font-medium sm:flex-none",
                viewType === view && "bg-card shadow-sm",
              )}
              onClick={() => calendarRef.current?.getApi().changeView(view)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      {!readOnly ? (
        <div className="mb-4 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={selecting ? "secondary" : "outline"}
              aria-pressed={selecting}
              disabled={busy || uncertain}
              onClick={() => {
                setSelecting(!selecting);
                setSelected([]);
                setChoices(null);
                fingerprint.current = null;
                pendingRequest.current = null;
                setActionError(null);
                setNotice(null);
                if (!selecting && viewType === "dayGridMonth")
                  calendarRef.current?.getApi().changeView("timeGridWeek");
              }}
            >
              {selecting ? "Zrušit výběr" : "Vybrat termíny k zablokování"}
            </Button>
            {selecting ? (
              <Button
                type="button"
                disabled={
                  busy || loadingChoices || !choices || !selected.length
                }
                onClick={() => void saveSelection()}
              >
                {busy ? "Ukládám…" : "Uložit blokované termíny"}
              </Button>
            ) : null}
            {selecting ? (
              <span className="text-sm font-medium" role="status">
                Vybráno: {selected.length} / 200
              </span>
            ) : null}
          </div>
          {selecting ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {loadingChoices
                ? "Načítám volné termíny…"
                : "Kliknutím označte volné termíny. Vybrat je můžete i v několika dnech nebo týdnech. Vytvoří se blokace bez kódů a zpráv."}
            </p>
          ) : null}
          {selecting && !loadingChoices && !choices ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setReloadChoices((value) => value + 1)}
            >
              Zkusit načíst znovu
            </Button>
          ) : null}
          {selecting && viewType === "dayGridMonth" ? (
            <p className="mt-2 text-sm">
              Pro výběr konkrétních časů otevřete den kliknutím na datum nebo
              zvolte Týden.
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="mt-2 text-sm text-success">
              {notice}{" "}
              <Link href="/admin/blocking" className="underline">
                Spravovat blokace
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      <div
        className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
        role="group"
        aria-label="Legenda kalendáře"
      >
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-success" aria-hidden="true" />
          Potvrzeno
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
          Rozpracováno
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="size-2 rounded-full bg-muted-foreground"
            aria-hidden="true"
          />
          Blokováno
        </span>
      </div>
      <FullCalendar
        ref={calendarRef}
        plugins={[
          timeGridPlugin,
          dayGridPlugin,
          interactionPlugin,
          luxonPlugin,
        ]}
        timeZone="Europe/Prague"
        initialView="timeGridWeek"
        locale={csLocale}
        firstDay={1}
        headerToolbar={false}
        datesSet={syncToolbar}
        dayHeaderContent={({ date, view, isToday }) => (
          <span className="inline-flex flex-col items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {date.toLocaleDateString("cs-CZ", {
                timeZone: "Europe/Prague",
                weekday: "short",
              })}
            </span>
            {view.type !== "dayGridMonth" ? (
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {date
                  .toLocaleDateString("cs-CZ", {
                    timeZone: "Europe/Prague",
                    day: "numeric",
                  })
                  .replace(".", "")}
              </span>
            ) : null}
          </span>
        )}
        slotMinTime={`${minutesToHHmm(openMinute)}:00`}
        slotMaxTime={`${minutesToHHmm(closeMinute)}:00`}
        slotDuration={{ minutes: slotMinutes }}
        slotLabelInterval={{ minutes: slotMinutes }}
        snapDuration={{ minutes: slotMinutes }}
        slotLabelContent={({ date }) => {
          const start = minuteOfDay(date);
          return `${minutesToHHmm(start)} – ${minutesToHHmm(Math.min(start + slotMinutes, closeMinute))}`;
        }}
        displayEventTime={false}
        eventContent={({ event }) =>
          event.extendedProps.blockChoice ? (
            <button
              type="button"
              className="admin-calendar-slot-choice"
              aria-pressed={selected.some(
                (w) => w.startISO === event.start?.toISOString(),
              )}
              disabled={
                busy ||
                uncertain ||
                (selected.length >= 200 &&
                  !selected.some(
                    (w) => w.startISO === event.start?.toISOString(),
                  ))
              }
              aria-label={`Blokovat ${event.start?.toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWindow(
                  event.extendedProps.blockChoice as CalendarBlockWindow,
                );
              }}
            >
              <span aria-hidden="true">
                {selected.some((w) => w.startISO === event.start?.toISOString())
                  ? "✓ Vybráno"
                  : "+ Vybrat"}
              </span>
            </button>
          ) : event.display === "background" ||
            event.display === "inverse-background" ? null : (
            <span
              className="admin-calendar-name"
              title={event.title}
              data-start-minute={
                event.start ? minuteOfDay(event.start) : undefined
              }
            >
              <AdminMemberName
                name={event.title}
                note={
                  typeof event.extendedProps.memberNote === "string"
                    ? event.extendedProps.memberNote
                    : null
                }
              />
            </span>
          )
        }
        allDaySlot={false}
        nowIndicator
        selectable={false}
        eventClick={(info) => {
          if (selecting) {
            info.jsEvent.preventDefault();
          }
        }}
        dateClick={(info) => {
          if (selecting && !busy && !uncertain && viewType === "dayGridMonth")
            calendarRef.current?.getApi().changeView("timeGridDay", info.date);
        }}
        navLinks={false}
        height="auto"
        expandRows={false}
        businessHours={{
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startTime: minutesToHHmm(openMinute),
          endTime: minutesToHHmm(closeMinute),
        }}
        events={[...events, ...selectionEvents]}
      />
      {actionError ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
