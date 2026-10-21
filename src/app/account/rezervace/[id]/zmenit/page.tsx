import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { uuidSchema } from "@/lib/validations/common";
import { requireUser } from "@/lib/auth/guards";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { dateKeyInTimeZone } from "@/lib/helpers/datetime";
import { formatDate, formatTimeRange } from "@/lib/helpers/format";
import { reservations, rescheduling } from "@/lib/services";
import { loadCalendarAvailability } from "@/lib/services/calendar-availability";
import {
  calendarLocation,
  type CalendarView,
} from "@/lib/config/booking-calendar";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { RescheduleCalendar } from "./reschedule-calendar";

export const metadata: Metadata = { title: "Změna termínu" };
// Initial render is authenticated and server-side; date/month navigation uses
// the public availability API without remounting the account or changing data.
export const dynamic = "force-dynamic";

export default async function ReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  // A mistyped link is "not found", never a database error page.
  if (!uuidSchema.safeParse(id).success) notFound();
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
  const input = {
    date:
      typeof query.date === "string"
        ? query.date
        : typeof query.month === "string"
          ? null
          : dateKeyInTimeZone(current.startsAt),
    month: typeof query.month === "string" ? query.month : null,
  };
  let calendar: CalendarView | null = null;
  if (eligibility.eligible) {
    try {
      calendar = (await loadCalendarAvailability(input, now)).view;
    } catch {
      calendar = {
        ...calendarLocation(input, 60, now),
        days: [],
        selectedSlots: [],
        source: "unavailable",
      };
    }
  }

  return (
    <>
      <SiteHeader
        brand={content.get("brand.name")}
        logoUrl={content.logoUrl}
        accountHref="/account"
        accountLabel="Můj účet"
      />
      <RealtimeRefresher eventName="navi:calendar-availability-change" />
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
                Původní rezervace platí až do potvrzení změny. Termín můžete
                bezplatně změnit jednou, nejpozději 24 hodin před začátkem. Cena
                původní rezervace se nemění.
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
                  initial={calendar!}
                  originalLabel={`${formatDate(current.startsAt)} · ${formatTimeRange(
                    current.startsAt,
                    current.endsAt,
                  )}`}
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
