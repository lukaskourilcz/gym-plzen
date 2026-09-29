"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import csLocale from "@fullcalendar/core/locales/cs";
import type { DateSelectArg, EventInput } from "@fullcalendar/core";
import { createBlockedSlotAction } from "@/app/admin/schedule/actions";
import { minutesToHHmm } from "@/lib/helpers/format";
import { closureFailureMessage } from "@/lib/helpers/closure-copy";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
  DEFAULT_SLOT_MINUTES,
} from "@/lib/config/schedule";

/**
 * Admin operational calendar (FullCalendar, MIT). Week view with reservations
 * as solid events and blocks (e.g. cleaning) as
 * background events. Drag-select an empty range to create a block (used for the
 * cleaning window ~13:00). Correctness (overlap) is enforced server-side; this
 * is the visual operations view.
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
  const [scheduleHint, setScheduleHint] = useState(false);

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
              Math.ceil(name.getBoundingClientRect().height) + 12,
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

  async function onSelect(sel: DateSelectArg) {
    if (busy || readOnly) return;
    setActionError(null);
    setScheduleHint(false);
    const label = `${sel.start.toLocaleString("cs-CZ")} – ${sel.end.toLocaleTimeString("cs-CZ")}`;
    if (!window.confirm(`Blokovat tento čas pro úklid?\n${label}`)) {
      sel.view.calendar.unselect();
      return;
    }
    setBusy(true);
    const values = {
      startsAt: sel.start.toISOString(),
      endsAt: sel.end.toISOString(),
      reason: "maintenance" as const,
      note: "Úklid",
    };
    const result = await createBlockedSlotAction(values);
    setBusy(false);
    sel.view.calendar.unselect();
    if (!result.ok) {
      setActionError(result.error ?? "Blok se nepodařilo vytvořit.");
      return;
    }
    // A drag cannot start over a booking (selectOverlap below), but one made
    // since this page loaded is only known to the server. Nothing was saved;
    // closing time over bookings is the schedule form's deliberate path.
    if (result.data.status === "needs_confirmation") {
      setActionError(
        `V tomto čase mezitím přibyla rezervace (${result.data.affectedCount}). Blok nebyl vytvořen. Pokud chcete čas uzavřít i s jejím zrušením, použijte formulář Blokované termíny.`,
      );
      setScheduleHint(true);
      router.refresh();
      return;
    }
    if (result.data.status === "closed") {
      if (result.data.failed.length > 0)
        setActionError(closureFailureMessage(result.data.failed));
      router.refresh();
    }
  }

  return (
    <div
      ref={containerRef}
      data-calendar-id={calendarId}
      className="admin-booking-calendar"
    >
      <style ref={rowStyleRef} />
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={csLocale}
        firstDay={1}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridWeek,timeGridDay,dayGridMonth",
        }}
        slotMinTime={`${minutesToHHmm(openMinute)}:00`}
        slotMaxTime={`${minutesToHHmm(closeMinute)}:00`}
        slotDuration={{ minutes: slotMinutes }}
        slotLabelInterval={{ minutes: slotMinutes }}
        snapDuration={{ minutes: slotMinutes }}
        slotLabelContent={({ date }) => {
          const start = date.getHours() * 60 + date.getMinutes();
          return `${minutesToHHmm(start)} – ${minutesToHHmm(Math.min(start + slotMinutes, closeMinute))}`;
        }}
        displayEventTime={false}
        eventContent={({ event }) =>
          event.display === "background" ||
          event.display === "inverse-background" ? null : (
            <span
              className="admin-calendar-name"
              title={event.title}
              data-start-minute={
                event.start
                  ? event.start.getHours() * 60 + event.start.getMinutes()
                  : undefined
              }
            >
              {event.title}
            </span>
          )
        }
        allDaySlot={false}
        nowIndicator
        selectable={!busy && !readOnly}
        // A block over a booking cancels it and e-mails the customer, so a
        // drag may cross only other blocks (background events), never a
        // reservation. The form on /admin/schedule is the deliberate path.
        selectOverlap={(event) => event.display === "background"}
        selectMirror
        select={onSelect}
        height="auto"
        expandRows={false}
        businessHours={{
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startTime: minutesToHHmm(openMinute),
          endTime: minutesToHHmm(closeMinute),
        }}
        events={events}
      />
      {actionError ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {actionError}
          {scheduleHint ? (
            <>
              {" "}
              <Link href="/admin/schedule" className="font-bold underline">
                Otevřít otevírací dobu a bloky
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
