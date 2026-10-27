import { ownReservationChange } from "@/lib/services/priced-rescheduling";
import { getCreditWallet } from "@/lib/services/credits";
import { db } from "@/lib/db";
import { payment } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { synchronizeComgatePayment } from "@/lib/services/payments";
import { redirect } from "next/navigation";
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

  let pending = user.isDemo ? null : await ownReservationChange(user.id, id);
  let pendingPayment = pending
    ? (
        await db
          .select()
          .from(payment)
          .where(eq(payment.reservationChangeId, pending.id))
      )[0]
    : null;
  let paymentUnavailable = false;
  if (pendingPayment?.providerPaymentId) {
    try {
      await synchronizeComgatePayment(pendingPayment.providerPaymentId);
    } catch {
      paymentUnavailable = true;
    }
    pending = await ownReservationChange(user.id, id);
    if (!pending) redirect("/account");
    pendingPayment = (
      await db
        .select()
        .from(payment)
        .where(eq(payment.reservationChangeId, pending.id))
    )[0];
  }
  const wallet = user.isDemo
    ? { availableCents: 0 }
    : await getCreditWallet(user.id);
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
                změnit jednou, nejpozději 24 hodin před začátkem.{" "}
                {current.pricingVersion < 2
                  ? "U této dříve zakoupené rezervace se cena nemění."
                  : "U dražšího termínu doplatíš rozdíl, u levnějšího získáš rozdíl do kreditů."}
              </p>
            </div>

            {pending ? (
              <div className="mt-8 max-w-2xl">
                <Notice
                  title={
                    pending.status === "awaiting_payment"
                      ? "Čeká se na doplatek"
                      : "Změna se ověřuje"
                  }
                >
                  Původní rezervace zůstává platná. Nový termín je dočasně
                  držený.{" "}
                  {paymentUnavailable
                    ? "Stav platby se nyní nepodařilo ověřit."
                    : pending.status === "review_needed" ||
                        pending.status === "refund_pending"
                      ? "Dokončení nebo vrácení doplatku řeší obsluha; další platbu nezakládejte."
                      : "Po úhradě ověříme a dokončíme změnu."}
                </Notice>
                <div className="mt-4 flex flex-wrap gap-3">
                  {pending.status === "awaiting_payment" &&
                  pendingPayment?.gatewayUrl ? (
                    <Button href={pendingPayment.gatewayUrl}>
                      Pokračovat k doplatku
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    href={`/account/rezervace/${id}/zmenit?change_id=${pending.id}`}
                  >
                    Obnovit stav
                  </Button>
                  <Button variant="ghost" href="/account">
                    Zpět do profilu
                  </Button>
                </div>
              </div>
            ) : !eligibility.eligible ? (
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
                  priceCents={current.priceCents ?? 0}
                  priceSnapshot={
                    current.pricingVersion >= 2 ? current.priceSnapshot : null
                  }
                  availableCreditCents={wallet.availableCents}
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
