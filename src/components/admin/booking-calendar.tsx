"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import csLocale from "@fullcalendar/core/locales/cs";
import type { DateSelectArg, EventInput } from "@fullcalendar/core";
import { createBlockedSlotAction } from "@/app/admin/schedule/actions";

/**
 * Admin operational calendar (FullCalendar, MIT). Week view with 1-hour slots
 * from 06:00–22:00 : reservations as solid events, blocks (e.g. cleaning) as
 * background events. Drag-select an empty range to create a block (used for the
 * cleaning window ~13:00). Correctness (overlap) is enforced server-side; this
 * is the visual operations view.
 */
export function BookingCalendar({
  events,
  openHour = 5,
  closeHour = 21,
}: {
  events: EventInput[];
  openHour?: number;
  closeHour?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSelect(sel: DateSelectArg) {
    if (busy) return;
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
    else window.alert(result.error ?? "Blok se nepodařilo vytvořit.");
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <FullCalendar
      plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      locale={csLocale}
      firstDay={1}
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "timeGridWeek,timeGridDay,dayGridMonth",
      }}
      slotMinTime={`${pad(openHour)}:00:00`}
      slotMaxTime={`${pad(closeHour)}:00:00`}
      slotDuration="01:00:00"
      snapDuration="01:00:00"
      allDaySlot={false}
      nowIndicator
      selectable
      selectMirror
      select={onSelect}
      height="auto"
      expandRows
      businessHours={{
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startTime: `${pad(openHour)}:00`,
        endTime: `${pad(closeHour)}:00`,
      }}
      events={events}
    />
  );
}
