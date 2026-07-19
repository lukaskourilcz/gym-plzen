import type { EventInput } from "@fullcalendar/core";
import { availability } from "@/lib/services";
import { addMinutes } from "@/lib/helpers/datetime";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BookingCalendar } from "@/components/admin/booking-calendar";

export const metadata = { title: "Kalendář" };
export const dynamic = "force-dynamic";

/**
 * Admin calendar — the operational week view (FullCalendar). Reservations show
 * as solid events, blocks as background events. Drag-select an empty range to
 * add a block (e.g. the daily cleaning window).
 */
export default async function CalendarPage() {
  const now = new Date();
  const rangeStart = addMinutes(now, -14 * 24 * 60);
  const rangeEnd = addMinutes(now, 60 * 24 * 60);
  const { reservations, blocks } = await availability
    .listCalendarEntries(rangeStart, rangeEnd)
    .catch(() => ({ reservations: [], blocks: [] }));

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
        description="Přehled rezervací a bloků. Tažením přes prázdný čas přidáte blok (např. úklid). Sloty jsou hodinové, provoz 06:00–22:00."
      />
      <Card>
        <CardContent className="p-3">
          <BookingCalendar events={events} />
        </CardContent>
      </Card>
    </div>
  );
}
