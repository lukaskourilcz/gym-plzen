"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import csLocale from "@fullcalendar/core/locales/cs";
import type { DateSelectArg, EventInput } from "@fullcalendar/core";
import { createBlockedSlotAction } from "@/app/admin/schedule/actions";
import { minutesToHHmm } from "@/lib/helpers/format";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
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
}: {
  events: EventInput[];
  openMinute?: number;
  closeMinute?: number;
}) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  async function onSelect(sel: DateSelectArg) {
    if (busy) return;
    setActionError(null);
    const label = `${sel.start.toLocaleString("cs-CZ")} – ${sel.end.toLocaleTimeString("cs-CZ")}`;
    if (!window.confirm(`Blokovat tento čas pro úklid?\n${label}`)) {
      sel.view.calendar.unselect();
      return;
    }
    setBusy(true);
    const result = await createBlockedSlotAction({
      startsAt: sel.start.toISOString(),
      endsAt: sel.end.toISOString(),
      reason: "maintenance",
      note: "Úklid",
    });
    setBusy(false);
    sel.view.calendar.unselect();
    if (result.ok) router.refresh();
    else setActionError(result.error ?? "Blok se nepodařilo vytvořit.");
  }

  return (
    <div className="admin-booking-calendar">
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
        slotDuration="01:00:00"
        snapDuration="01:00:00"
        allDaySlot={false}
        nowIndicator
        selectable={!busy}
        selectMirror
        select={onSelect}
        height="auto"
        expandRows
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
        </p>
      ) : null}
    </div>
  );
}
