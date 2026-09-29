import { requireAdmin } from "@/lib/auth/guards";
import type { EventInput } from "@fullcalendar/core";
import { availability, schedule } from "@/lib/services";
import { addMinutes } from "@/lib/helpers/datetime";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BookingCalendar } from "@/components/admin/booking-calendar";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
} from "@/lib/config/schedule";
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
  const activeDays = openingHours.filter((day) => day.isClosed !== 1);
  const openMinute =
    activeDays.length > 0
      ? Math.min(...activeDays.map((day) => day.openMinute))
      : DEFAULT_OPEN_MINUTE;
  const closeMinute =
    activeDays.length > 0
      ? Math.max(...activeDays.map((day) => day.closeMinute))
      : DEFAULT_CLOSE_MINUTE;

  const slotMinutes = calendarRowMinutes(activeDays, openMinute);

  const events: EventInput[] = [
    ...reservations
      .filter((r) => r.status !== "cancelled")
      .map((r) => ({
        id: r.id,
        title: r.contactName?.trim() || "Zákazník bez jména",
        start: r.startsAt.toISOString(),
        end: r.endsAt.toISOString(),
        backgroundColor:
          r.status === "confirmed" ? "var(--success)" : "var(--warning)",
        borderColor: "transparent",
      })),
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
        description={`Přehled rezervací a bloků. Tažením přes prázdný čas přidáte blok. Zobrazený rozsah vychází z nastavení: ${minutesToHHmm(openMinute)} až ${minutesToHHmm(closeMinute)}.`}
      />
      <Card>
        <CardContent className="p-3">
          <BookingCalendar
            events={events}
            openMinute={openMinute}
            closeMinute={closeMinute}
            slotMinutes={slotMinutes}
          />
        </CardContent>
      </Card>
    </div>
  );
}
