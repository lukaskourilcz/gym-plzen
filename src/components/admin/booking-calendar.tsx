"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import luxonPlugin from "@fullcalendar/luxon3";
import { loadCalendarAction } from "@/app/admin/calendar/actions";
import type { OpeningHours } from "@/lib/db/types";
import { PRAGUE_TIME_ZONE } from "@/lib/helpers/datetime";
import { formatDateTime, formatTime } from "@/lib/helpers/format";
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
 * labelled events. Drag-select an empty range to create a block (used for the
 * cleaning window ~13:00). Correctness (overlap) is enforced server-side; this
 * is the visual operations view.
 */
export function BookingCalendar({
  refreshedAt,
  openingHours,
  openMinute = DEFAULT_OPEN_MINUTE,
  closeMinute = DEFAULT_CLOSE_MINUTE,
}: {
  refreshedAt: number;
  openingHours: OpeningHours[];
  openMinute?: number;
  closeMinute?: number;
}) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
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

  const loadEvents = useCallback(
    (
      range: { start: Date; end: Date },
      success: (events: EventInput[]) => void,
      failure: (error: Error) => void,
    ) => {
      setLoaded(false);
      void loadCalendarAction({
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      })
        .then((result) => {
          if (!result.ok) {
            failure(new Error("Calendar unavailable"));
            setActionError("Kalendář se nepodařilo načíst. Obnovte stránku.");
            return;
          }
          setActionError(null);
          setLoaded(true);
          success(result.data ?? []);
        })
        .catch(() => {
          setActionError("Kalendář se nepodařilo načíst. Obnovte stránku.");
          failure(new Error("Calendar unavailable"));
        });
    },
    [],
  );

  useEffect(() => {
    calendarRef.current?.getApi().refetchEvents();
  }, [refreshedAt]);

  async function onSelect(sel: DateSelectArg) {
    if (busy || loading || !loaded) return;
    setActionError(null);
    const label = `${formatDateTime(sel.start)} – ${formatTime(sel.end)}`;
    if (!window.confirm(`Blokovat tento čas pro úklid?\n${label}`)) {
      sel.view.calendar.unselect();
      return;
    }
    setBusy(true);
    try {
      const result = await createBlockedSlotAction({
        startsAt: sel.start.toISOString(),
        endsAt: sel.end.toISOString(),
        reason: "maintenance",
        note: "Úklid",
      });
      if (result.ok) {
        sel.view.calendar.refetchEvents();
        router.refresh();
      } else setActionError(result.error ?? "Blok se nepodařilo vytvořit.");
    } catch {
      setActionError("Blok se nepodařilo vytvořit. Zkuste to znovu.");
    } finally {
      setBusy(false);
      sel.view.calendar.unselect();
    }
  }

  return (
    <div className="admin-booking-calendar" aria-busy={loading || busy}>
      {loading ? <p role="status" className="mb-3 text-sm text-muted-foreground">Načítám rezervace…</p> : null}
      <FullCalendar
        ref={calendarRef}
        plugins={[
          timeGridPlugin,
          dayGridPlugin,
          interactionPlugin,
          luxonPlugin,
        ]}
        timeZone={PRAGUE_TIME_ZONE}
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
        snapDuration="00:15:00"
        allDaySlot={false}
        nowIndicator
        loading={setLoading}
        selectable={!busy && !loading && loaded}
        selectMirror
        select={onSelect}
        height="auto"
        expandRows
        businessHours={openingHours
          .filter((day) => !day.isClosed)
          .map((day) => ({
            daysOfWeek: [day.dayOfWeek],
            startTime: minutesToHHmm(day.openMinute),
            endTime: minutesToHHmm(day.closeMinute),
          }))}
        events={loadEvents}
      />
      {actionError ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
