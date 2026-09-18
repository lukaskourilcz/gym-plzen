import type { Metadata } from "next";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { getSession } from "@/lib/auth/guards";
import { formatMoney, formatTimeRange } from "@/lib/helpers/format";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  isDateKey,
  minutesBetween,
  monthGrid,
  localDateTimeToDate,
} from "@/lib/helpers/datetime";
import {
  getBookingHorizonDays,
  getSlotsForRange,
  isWithinBookingHorizon,
} from "@/lib/services/slots";
import { Container, Section } from "@/components/ui/container";
import { Notice } from "@/components/ui/notice";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { BookingCalendar } from "./booking-calendar";
import { firstBookableDateKey } from "@/lib/config/booking-start";

export const metadata: Metadata = {
  title: "Rezervace soukromého gymu",
  description: "Vyberte datum a přesný čas rezervace NAVI Private Gym v Plzni.",
  alternates: { canonical: "/rezervace" },
};
/*
 * Deliberately no `loading.tsx` next to this page. The calendar navigates to
 * itself with different search params, and under a segment loading boundary
 * the React build bundled with Next 15.5 can lose the wake-up of a Flight row
 * that arrives while it unwinds, which parked the first date selection until
 * the visitor clicked again. Without the boundary the suspension is handled
 * at the root, where that wake-up is recorded; the transition simply holds
 * the current view until the new day's data is in.
 */
export const dynamic = "force-dynamic";

function validMonth(value: string | undefined): value is string {
  return Boolean(
    value && /^\d{4}-\d{2}$/.test(value) && isDateKey(`${value}-01`),
  );
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const now = new Date();
  const todayKey = dateKeyInTimeZone(now);
  /*
   * Before launch the earliest bookable day is opening day, afterwards it is
   * today. Nothing earlier is offered, so it is also the floor of month
   * navigation: the months before opening hold no bookable day at all.
   */
  const minDateKey = firstBookableDateKey(now);
  const minMonth = minDateKey.slice(0, 7);
  // Resolved once per request: the operator can change the horizon.
  const horizonDays = await getBookingHorizonDays();
  const maxDateKey = addDaysToDateKey(todayKey, horizonDays);
  const isBookable = (dateKey: string) =>
    dateKey >= minDateKey && isWithinBookingHorizon(dateKey, now, horizonDays);
  const requestedDate =
    typeof params.date === "string" && isDateKey(params.date)
      ? params.date
      : null;
  const requestedMonth =
    typeof params.month === "string" ? params.month : undefined;
  const monthKey =
    requestedDate && isBookable(requestedDate)
      ? requestedDate.slice(0, 7)
      : validMonth(requestedMonth) &&
          requestedMonth >= minMonth &&
          requestedMonth <= maxDateKey.slice(0, 7)
        ? requestedMonth
        : minMonth;
  /*
   * The opening month opens on the first bookable day; a month the visitor
   * navigated to opens with no day selected. Explicit day navigation wins.
   */
  const selectedDateKey =
    requestedDate &&
    requestedDate.startsWith(monthKey) &&
    isBookable(requestedDate)
      ? requestedDate
      : monthKey === minMonth && isBookable(minDateKey)
        ? minDateKey
        : null;
  const grid = monthGrid(monthKey);
  const rangeStart = grid[0]!.dateKey;
  const rangeEnd = addDaysToDateKey(grid.at(-1)!.dateKey, 1);

  const [availability, content, session] = await Promise.all([
    getSlotsForRange(rangeStart, rangeEnd, now),
    loadSiteContent("cs", {
      at: localDateTimeToDate(selectedDateKey ?? minDateKey, 12 * 60),
    }),
    getSession(),
  ]);
  const price = formatMoney(content.entryPriceCents);
  // The client needs one flag per day and the slots of the selected day only;
  // shipping all 630 slots of the grid made the document ten times larger.
  const days = availability.days.map((day) => ({
    dateKey: day.dateKey,
    isClosed: day.isClosed,
    hasAvailability: day.slots.some((slot) => slot.available),
  }));
  const selectedSlots = (
    availability.days.find((day) => day.dateKey === selectedDateKey)?.slots ??
    []
  )
    .filter((slot) => slot.available)
    .map((slot) => ({
      startISO: slot.start.toISOString(),
      label: formatTimeRange(slot.start, slot.end),
      durationMinutes: minutesBetween(slot.start, slot.end),
    }));

  return (
    <>
      <SiteHeader
        brand={content.get("brand.name")}
        logoUrl={content.logoUrl}
        accountHref={session ? "/account" : "/login"}
        accountLabel={session ? "Můj účet" : "Přihlásit se"}
      />
      <RealtimeRefresher />
      <main id="main-content" tabIndex={-1}>
        <Section className="pb-28 pt-12 sm:pt-16">
          <Container>
            <div className="max-w-2xl">
              <div className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
                Rezervace
              </div>
              <h1 className="mt-3 text-4xl font-extrabold tracking-[-.01em] sm:text-5xl">
                Vyberte datum a čas
              </h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
                U vybraného dne uvidíte volné termíny včetně přesného času
                konce, délky a ceny. Rezervovat můžete i bez registrace.
              </p>
            </div>

            {params.stav === "zruseno" ? (
              <Notice
                tone="warning"
                title="Platba nebyla dokončena"
                className="mt-7 max-w-2xl"
                role="status"
              >
                Termín se znovu uvolní po vypršení platební relace. Můžete
                zvolit jiný čas.
              </Notice>
            ) : null}
            {params.stav === "obsazeno" ? (
              <Notice
                tone="warning"
                title="Termín už není volný"
                className="mt-7 max-w-2xl"
                role="status"
              >
                Než jste rezervaci dokončili, obsadil ho někdo jiný. Vyberte
                prosím jiný čas.
              </Notice>
            ) : null}

            <div className="mt-10">
              <BookingCalendar
                monthKey={monthKey}
                selectedDateKey={selectedDateKey}
                todayKey={todayKey}
                minDateKey={minDateKey}
                maxDateKey={maxDateKey}
                horizonDays={horizonDays}
                days={days}
                selectedSlots={selectedSlots}
                source={availability.source}
                price={price}
              />
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
