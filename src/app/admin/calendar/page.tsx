import type { EventInput } from "@fullcalendar/core";
import { requireAdmin } from "@/lib/auth/guards";
import { availability, schedule } from "@/lib/services";
import { addMinutes } from "@/lib/helpers/datetime";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BookingCalendar } from "@/components/admin/booking-calendar";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
} from "@/lib/config/schedule";
import { minutesToHHmm } from "@/lib/helpers/format";

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
  const [{ reservations, blocks }, openingHours] = await Promise.all([
    availability
      .listCalendarEntries(rangeStart, rangeEnd)
      .catch(() => ({ reservations: [], blocks: [] })),
    schedule.listOpeningHours().catch(() => []),
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

  const events: EventInput[] = [
    ...reservations
      .filter((r) => r.status !== "cancelled")
      .map((r) => ({
        id: r.id,
        title: r.contactName ?? r.contactEmail ?? "Rezervace",
        start: r.startsAt.toISOString(),
        end: r.endsAt.toISOString(),
        backgroundColor: r.status === "confirmed" ? "#16a34a" : "#f59e0b",
        borderColor: "transparent",
      })),
    ...blocks.map((b) => ({
      id: b.id,
      title: b.note ?? "Blok",
      start: b.startsAt.toISOString(),
      end: b.endsAt.toISOString(),
      display: "background" as const,
      backgroundColor: "#94a3b8",
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
          />
        </CardContent>
      </Card>
    </div>
  );
}
