import type { Metadata } from "next";
import { loadSiteContent } from "@/lib/content/site";
import { getSession } from "@/lib/auth/guards";
import { formatMoney, formatTimeRange } from "@/lib/helpers/format";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  isDateKey,
  minutesBetween,
  monthGrid,
} from "@/lib/helpers/datetime";
import {
  BOOKING_HORIZON_DAYS,
  getSlotsForRange,
  isWithinBookingHorizon,
} from "@/lib/services/slots";
import { Container, Section } from "@/components/ui/container";
import { Notice } from "@/components/ui/notice";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { BookingCalendar } from "./booking-calendar";

export const metadata: Metadata = {
  title: "Rezervace soukromého gymu",
  description:
    "Vyberte datum a přesný čas rezervace NAMASTÉ Private Gym v Plzni.",
  alternates: { canonical: "/rezervace" },
};
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
  const maxDateKey = addDaysToDateKey(todayKey, BOOKING_HORIZON_DAYS);
  const requestedDate =
    typeof params.date === "string" && isDateKey(params.date)
      ? params.date
      : null;
  const requestedMonth =
    typeof params.month === "string" ? params.month : undefined;
  const monthKey =
    requestedDate && isWithinBookingHorizon(requestedDate, now)
      ? requestedDate.slice(0, 7)
      : validMonth(requestedMonth) &&
          requestedMonth >= todayKey.slice(0, 7) &&
          requestedMonth <= maxDateKey.slice(0, 7)
        ? requestedMonth
        : todayKey.slice(0, 7);
  const selectedDateKey =
    requestedDate &&
    requestedDate.startsWith(monthKey) &&
    isWithinBookingHorizon(requestedDate, now)
      ? requestedDate
      : null;
  const grid = monthGrid(monthKey);
  const rangeStart = grid[0]!.dateKey;
  const rangeEnd = addDaysToDateKey(grid.at(-1)!.dateKey, 1);

  const [availability, content, session] = await Promise.all([
    getSlotsForRange(rangeStart, rangeEnd, now),
    loadSiteContent(),
    getSession(),
  ]);
  const price = formatMoney(content.entryPriceCents);
  const days = availability.days.map((day) => ({
    dateKey: day.dateKey,
    isClosed: day.isClosed,
    slots: day.slots.map((slot) => ({
      startISO: slot.start.toISOString(),
      endISO: slot.end.toISOString(),
      label: formatTimeRange(slot.start, slot.end),
      durationMinutes: minutesBetween(slot.start, slot.end),
      available: slot.available,
    })),
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
      <main>
        <Section className="pb-28 pt-12 sm:pt-16">
          <Container>
            <div className="max-w-2xl">
              <div className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
                Rezervace
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-[-.04em] sm:text-5xl">
                Vyberte datum a čas
              </h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
                Nejdřív zvolte den v kalendáři. Potom uvidíte volné termíny
                včetně přesného času konce, délky a ceny.
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

            <div className="mt-10">
              <BookingCalendar
                monthKey={monthKey}
                selectedDateKey={selectedDateKey}
                todayKey={todayKey}
                maxDateKey={maxDateKey}
                days={days}
                source={availability.source}
                price={price}
                isAuthenticated={Boolean(session)}
              />
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter
        brand={content.get("brand.name")}
        termsUrl={content.termsUrl}
      />
    </>
  );
}
