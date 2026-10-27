import { Button } from "@/components/ui/button";
import { CalendarActions } from "@/components/site/calendar-actions";
import {
  ReservationCardView,
  type CardReservation,
} from "@/components/site/reservation-card-view";
import { formatDate, formatTimeRange } from "@/lib/helpers/format";
import { CUSTOMER_CANCEL_REASON } from "@/lib/services/reservations";
import { ReservationActions } from "./reservation-actions";

export function ReservationCard({
  reservation: r,
  changed,
  now,
  address,
  participantsEnabled,
  demo = false,
}: {
  reservation: CardReservation;
  changed: boolean;
  now: Date;
  address: string;
  participantsEnabled: boolean;
  demo?: boolean;
}) {
  const label = `${formatDate(r.startsAt)} ${formatTimeRange(r.startsAt, r.endsAt)}`;
  const upcoming = r.status === "confirmed" && r.endsAt > now;
  return (
    <ReservationCardView
      reservation={r}
      now={now}
      participantsEnabled={participantsEnabled}
      customerCancelled={
        r.status === "cancelled" && r.cancelReason === CUSTOMER_CANCEL_REASON
      }
    >
      {!demo && upcoming ? (
        <>
          <ReservationActions
            id={r.id}
            startsAt={r.startsAt.toISOString()}
            status={r.status}
            changed={changed}
            nowISO={now.toISOString()}
            label={label}
            price={{
              priceCents: r.priceCents,
              creditPaidCents: r.creditPaidCents,
              currency: r.currency,
              loyaltyReward: r.loyaltyReward,
              additionalPeoplePaidCents: r.additionalPeoplePaidCents,
            }}
          />
          {participantsEnabled && r.startsAt > now && r.extraPeople < 2 ? (
            <Button
              href={`/account/rezervace/${r.id}/osoby`}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              Přidat osobu
            </Button>
          ) : null}
          <details className="mt-3 text-sm">
            <summary className="inline-flex min-h-11 cursor-pointer items-center font-bold text-accent-foreground">
              Přidat do kalendáře
            </summary>
            <CalendarActions
              className="mt-2"
              reservationId={r.id}
              startsAt={r.startsAt}
              endsAt={r.endsAt}
              address={address}
            />
          </details>
        </>
      ) : null}
    </ReservationCardView>
  );
}
