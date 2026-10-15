import { getParticipantsEnabled } from "@/lib/services/block-pricing";
import { requireAdmin } from "@/lib/auth/guards";
import { getMemberNotes } from "@/lib/services/admin-member-notes";
import type { EventInput } from "@fullcalendar/core";
import { availability, schedule } from "@/lib/services";
import { addMinutes } from "@/lib/helpers/datetime";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BookingCalendar } from "@/components/admin/booking-calendar";
import {
  calendarTimeBounds,
  isOutsideOpeningHours,
} from "@/lib/helpers/calendar-schedule";
import { calendarRowMinutes } from "@/lib/helpers/calendar-grid";
import { minutesToHHmm } from "@/lib/helpers/format";
import { hasDemoAdminSession } from "@/lib/auth/demo";

export const metadata = { title: "Kalendář" };
export const dynamic = "force-dynamic";

/**
 * Admin calendar : the operational week view (FullCalendar). Reservations show
 * as solid events, blocks as background events. Drag-select an empty range to
 * add a block (e.g. the daily cleaning window).
 */
export default async function CalendarPage() {
  await requireAdmin();
  const now = new Date();
  const rangeStart = addMinutes(now, -14 * 24 * 60);
  const rangeEnd = addMinutes(now, 60 * 24 * 60);
  const demo = await hasDemoAdminSession();
  const [{ reservations, blocks }, openingHours] = demo
    ? [{ reservations: [], blocks: [] }, []]
    : await Promise.all([
        availability.listCalendarEntries(rangeStart, rangeEnd),
        schedule.listOpeningHours(),
      ]);
  const participantsEnabled = !demo && (await getParticipantsEnabled());
  const activeDays = openingHours.filter((day) => day.isClosed !== 1);
  const visibleReservations = reservations.filter(
    (r) => r.status !== "cancelled" || r.accessRevocationPending,
  );
  const windows = visibleReservations.flatMap((r) => [
    { startsAt: r.startsAt, endsAt: r.endsAt },
    ...(r.rescheduleStartsAt && r.rescheduleEndsAt
      ? [{ startsAt: r.rescheduleStartsAt, endsAt: r.rescheduleEndsAt }]
      : []),
  ]);
  const { openMinute, closeMinute } = calendarTimeBounds(openingHours, windows);

  const slotMinutes = calendarRowMinutes(activeDays, openMinute);
  const memberNotes = demo
    ? new Map<string, string>()
    : await getMemberNotes(reservations.map((r) => r.userId));

  const events: EventInput[] = [
    ...visibleReservations.flatMap((r) => [
      {
        id: r.id,
        title: `${r.contactName?.trim() || "Zákazník bez jména"}${participantsEnabled && r.extraPeople > 0 ? ` +${r.extraPeople}` : ""}`,
        start: r.startsAt.toISOString(),
        end: r.endsAt.toISOString(),
        backgroundColor: isOutsideOpeningHours(r, openingHours)
          ? "var(--muted-foreground)"
          : r.status === "confirmed"
            ? "var(--success)"
            : "var(--warning)",
        textColor: isOutsideOpeningHours(r, openingHours)
          ? "var(--card)"
          : r.status === "confirmed"
            ? "var(--success-foreground)"
            : "var(--warning-foreground)",
        borderColor: "transparent",
        extendedProps: {
          memberNote: memberNotes.get(r.userId ?? ""),
          outsideOpeningHours: isOutsideOpeningHours(r, openingHours),
        },
      },
      ...(r.rescheduleStartsAt && r.rescheduleEndsAt
        ? [
            {
              id: `${r.id}/reschedule`,
              title: `${r.contactName?.trim() || "Zákazník bez jména"}${participantsEnabled && r.extraPeople > 0 ? ` +${r.extraPeople}` : ""}`,
              start: r.rescheduleStartsAt.toISOString(),
              end: r.rescheduleEndsAt.toISOString(),
              backgroundColor: isOutsideOpeningHours(
                { startsAt: r.rescheduleStartsAt, endsAt: r.rescheduleEndsAt },
                openingHours,
              )
                ? "var(--muted-foreground)"
                : "var(--warning)",
              textColor: isOutsideOpeningHours(
                { startsAt: r.rescheduleStartsAt, endsAt: r.rescheduleEndsAt },
                openingHours,
              )
                ? "var(--card)"
                : "var(--warning-foreground)",
              borderColor: "transparent",
              extendedProps: {
                memberNote: memberNotes.get(r.userId ?? ""),
                outsideOpeningHours: isOutsideOpeningHours(
                  {
                    startsAt: r.rescheduleStartsAt,
                    endsAt: r.rescheduleEndsAt,
                  },
                  openingHours,
                ),
              },
            },
          ]
        : []),
    ]),
    ...blocks.map((b) => ({
      id: b.id,
      title: b.note ?? "Blok",
      start: b.startsAt.toISOString(),
      end: b.endsAt.toISOString(),
      display: "background" as const,
      backgroundColor: "var(--muted-foreground)",
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Kalendář"
        description="Rezervace a blokované termíny na jednom místě."
      />
      <Card>
        <CardContent className="p-3 sm:p-5">
          <BookingCalendar
            events={events}
            openMinute={openMinute}
            closeMinute={closeMinute}
            slotMinutes={slotMinutes}
            businessHours={activeDays.map((day) => ({
              daysOfWeek: [day.dayOfWeek],
              startTime: minutesToHHmm(day.openMinute),
              endTime: minutesToHHmm(day.closeMinute),
            }))}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            Časová osa {minutesToHHmm(openMinute)}–{minutesToHHmm(closeMinute)}{" "}
            · Tažením přes volný čas přidáte blok pro úklid.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
