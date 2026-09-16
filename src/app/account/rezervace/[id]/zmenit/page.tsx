import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  isDateKey,
  minutesBetween,
  monthGrid,
} from "@/lib/helpers/datetime";
import { formatDate, formatTimeRange } from "@/lib/helpers/format";
import { reservations, rescheduling } from "@/lib/services";
import {
  getBookingHorizonDays,
  getSlotsForRange,
  isWithinBookingHorizon,
} from "@/lib/services/slots";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { RescheduleCalendar } from "./reschedule-calendar";

export const metadata: Metadata = { title: "Změna termínu" };
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

export default async function ReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/account/rezervace/${id}/zmenit`);
  const [current, content] = await Promise.all([
    reservations.getReservation(id),
    loadSiteContent(),
  ]);
  if (!current || current.userId !== user.id) notFound();

  const now = new Date();
  const alreadyRescheduled = await rescheduling.hasReservationBeenRescheduled(
    current.id,
    user.id,
  );
  const eligibility = rescheduling.getRescheduleEligibility(
    current,
    alreadyRescheduled,
    now,
  );
  const todayKey = dateKeyInTimeZone(now);
  // Resolved once per request: the operator can change the horizon.
  const horizonDays = await getBookingHorizonDays();
  const maxDateKey = addDaysToDateKey(todayKey, horizonDays);
  const requestedDate =
    typeof query.date === "string" && isDateKey(query.date) ? query.date : null;
  const requestedMonth =
    typeof query.month === "string" ? query.month : undefined;
  const monthKey =
    requestedDate && isWithinBookingHorizon(requestedDate, now, horizonDays)
      ? requestedDate.slice(0, 7)
      : validMonth(requestedMonth) &&
          requestedMonth >= todayKey.slice(0, 7) &&
          requestedMonth <= maxDateKey.slice(0, 7)
        ? requestedMonth
        : todayKey.slice(0, 7);
  const selectedDateKey =
    requestedDate &&
    requestedDate.startsWith(monthKey) &&
    isWithinBookingHorizon(requestedDate, now, horizonDays)
      ? requestedDate
      : monthKey === todayKey.slice(0, 7)
        ? todayKey
        : null;

  const grid = monthGrid(monthKey);
  const rangeStart = grid[0]!.dateKey;
  const rangeEnd = addDaysToDateKey(grid.at(-1)!.dateKey, 1);
  const availability = eligibility.eligible
    ? await getSlotsForRange(rangeStart, rangeEnd, now)
    : { days: [], source: "live" as const };
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
        accountHref="/account"
        accountLabel="Můj účet"
      />
      <RealtimeRefresher />
      <main id="main-content" tabIndex={-1}>
        <Section className="pb-28 pt-12 sm:pt-16">
          <Container>
            <div className="max-w-2xl">
              <div className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
                Můj účet · změna rezervace
              </div>
              <h1 className="mt-3 text-4xl font-extrabold tracking-[-.01em] sm:text-5xl">
                Změnit termín
              </h1>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
                Současný termín: <strong>{formatDate(current.startsAt)}</strong>
                {" · "}
                <strong>
                  {formatTimeRange(current.startsAt, current.endsAt)}
                </strong>
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Podle obchodních podmínek můžete rezervaci bezplatně změnit
                pouze jednou a nejpozději 24 hodin před jejím začátkem.
              </p>
            </div>

            {!eligibility.eligible ? (
              <div className="mt-8 max-w-2xl">
                <Notice tone="warning" title="Termín nelze změnit" role="alert">
                  {rescheduling.rescheduleReasonMessage(eligibility.reason)}
                </Notice>
                <Button href="/account" variant="outline" className="mt-5">
                  Zpět do profilu
                </Button>
              </div>
            ) : (
              <div className="mt-10">
                <RescheduleCalendar
                  reservationId={current.id}
                  monthKey={monthKey}
                  selectedDateKey={selectedDateKey}
                  todayKey={todayKey}
                  maxDateKey={maxDateKey}
                  originalLabel={`${formatDate(current.startsAt)} · ${formatTimeRange(
                    current.startsAt,
                    current.endsAt,
                  )}`}
                  days={days}
                  selectedSlots={selectedSlots}
                  source={availability.source}
                />
              </div>
            )}
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
