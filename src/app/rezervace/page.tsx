import type { Metadata } from "next";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { getSession } from "@/lib/auth/guards";
import { formatTimeRange } from "@/lib/helpers/format";
import { localDateTimeToDate } from "@/lib/helpers/datetime";
import { getLoyaltyStatus } from "@/lib/services/loyalty";
import { parseSelectedStarts } from "@/lib/helpers/booking-selection";
import { Container, Section } from "@/components/ui/container";
import { Notice } from "@/components/ui/notice";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { BookingCalendar } from "./booking-calendar";
import { loadCalendarAvailability } from "@/lib/services/calendar-availability";
import {
  calendarLocation,
  type CalendarView,
} from "@/lib/config/booking-calendar";
import { DEFAULT_BOOKING_HORIZON_DAYS } from "@/lib/config/schedule";
import { logger } from "@/lib/helpers/logger";

export const metadata: Metadata = {
  title: "Rezervace soukromého gymu",
  description: "Vyberte datum a přesný čas rezervace NAVI Private Gym v Plzni.",
  alternates: { canonical: "/rezervace" },
};
/* First render is server-side. Day/month navigation uses the public snapshot
 * API; no same-route Flight/loading boundary or authentication round trip. */
export const dynamic = "force-dynamic";

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const now = new Date();
  let snapshot: Awaited<ReturnType<typeof loadCalendarAvailability>> | null =
    null;
  try {
    snapshot = await loadCalendarAvailability(
      {
        date: typeof params.date === "string" ? params.date : null,
        month: typeof params.month === "string" ? params.month : null,
      },
      now,
    );
  } catch (error) {
    logger.warn("Booking calendar unavailable", { error });
  }
  const fallback = calendarLocation(
    {
      date: typeof params.date === "string" ? params.date : null,
      month: typeof params.month === "string" ? params.month : null,
    },
    DEFAULT_BOOKING_HORIZON_DAYS,
    now,
  );
  const view: CalendarView = snapshot?.view ?? {
    ...fallback,
    days: [],
    selectedSlots: [],
    source: "unavailable",
  };
  const [content, session] = await Promise.all([
    loadSiteContent("cs", {
      at: localDateTimeToDate(view.selectedDateKey ?? view.minDateKey, 720),
      bookingSnapshot: snapshot?.pricing,
    }),
    getSession(),
  ]);
  /*
   * The visitor's selection from the URL, priced exactly per slot. A slot
   * that is no longer offered at all (in the past, or the day was closed)
   * drops out here; one that someone else took meanwhile is flagged on the
   * details step, where it can be removed.
   */
  const shortDay = new Intl.DateTimeFormat("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/Prague",
  });
  const starts = parseSelectedStarts(params.start);
  const [resolvedSlots, loyaltyStatus] = await Promise.all([
    snapshot
      ? Promise.resolve(starts.map((start) => snapshot.resolveSelection(start)))
      : Promise.resolve(starts.map(() => null)),
    session ? getLoyaltyStatus(session.user.id) : null,
  ]);
  const selected = starts
    .map((startsAt, index) => {
      const resolved = resolvedSlots[index];
      if (!resolved || startsAt <= now) return null;
      return {
        startISO: startsAt.toISOString(),
        label: `${shortDay.format(startsAt)}, ${formatTimeRange(startsAt, resolved.endsAt)}`,
        priceCents: content.entryPriceForDate(startsAt),
      };
    })
    .filter((slot) => slot !== null);
  // A reward already claimed by a pending checkout moves the next free slot
  // one full cycle on, as the order itself would.
  const loyalty = loyaltyStatus
    ? {
        cadence: loyaltyStatus.cadence,
        entriesUntilFree:
          loyaltyStatus.entriesUntilFree === 1 && !loyaltyStatus.nextEntryIsFree
            ? 1 + loyaltyStatus.cadence
            : loyaltyStatus.entriesUntilFree,
      }
    : null;

  return (
    <>
      <SiteHeader
        brand={content.get("brand.name")}
        logoUrl={content.logoUrl}
        accountHref={session ? "/account" : "/login"}
        accountLabel={session ? "Můj účet" : "Přihlásit se"}
      />
      <RealtimeRefresher eventName="navi:calendar-availability-change" />
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
                konce, délky a ceny. Vybrat můžete i více termínů najednou a
                zaplatit je jednou platbou. Rezervovat můžete i bez registrace.
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
                {...view}
                selected={selected}
                loyalty={loyalty}
                registrationCadence={
                  session ? undefined : content.freeEntryEvery
                }
              />
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
