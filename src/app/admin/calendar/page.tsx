import { schedule } from "@/lib/services";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BookingCalendar } from "@/components/admin/booking-calendar";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
} from "@/lib/config/schedule";
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
  const demo = await hasDemoAdminSession();
  const openingHours = demo ? [] : await schedule.listOpeningHours();
  const activeDays = openingHours.filter((day) => day.isClosed !== 1);
  const openMinute =
    activeDays.length > 0
      ? Math.min(...activeDays.map((day) => day.openMinute))
      : DEFAULT_OPEN_MINUTE;
  const closeMinute =
    activeDays.length > 0
      ? Math.max(...activeDays.map((day) => day.closeMinute))
      : DEFAULT_CLOSE_MINUTE;

  return (
    <div>
      <PageHeader
        title="Kalendář"
        description={`Přehled rezervací a bloků. Tažením přes prázdný čas přidáte blok. Zobrazený rozsah vychází z nastavení: ${minutesToHHmm(openMinute)} až ${minutesToHHmm(closeMinute)}.`}
      />
      <Card>
        <CardContent className="p-3">
          <BookingCalendar
            refreshedAt={Date.now()}
            openingHours={openingHours}
            openMinute={openMinute}
            closeMinute={closeMinute}
          />
        </CardContent>
      </Card>
    </div>
  );
}
