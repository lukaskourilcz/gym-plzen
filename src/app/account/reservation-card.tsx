import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarActions } from "@/components/site/calendar-actions";
import { participantLabel } from "@/lib/config/participants";
import {
  cancellationPrice,
  type CancellationPrice,
} from "@/lib/config/customer-cancellation";
import {
  formatDate,
  formatStatus,
  formatTimeRange,
} from "@/lib/helpers/format";
import { CUSTOMER_CANCEL_REASON } from "@/lib/services/reservations";
import { ReservationActions } from "./reservation-actions";

type CardReservation = CancellationPrice & {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  cancelReason: string | null;
  extraPeople: number;
};
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
  const price = cancellationPrice(r);
  const customerCancelled =
    r.status === "cancelled" && r.cancelReason === CUSTOMER_CANCEL_REASON;
  const upcoming = r.status === "confirmed" && r.endsAt > now;
  return (
    <article
      aria-label={`Rezervace ${label}`}
      className="rounded-lg border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-sm bg-accent text-accent-foreground">
          <CalendarDays aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold">{formatDate(r.startsAt)}</h3>
          <p className="mt-1 text-lg font-bold">
            {formatTimeRange(r.startsAt, r.endsAt)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Trénink · celý gym
            {participantsEnabled ? ` · ${participantLabel(r.extraPeople)}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-extrabold">{price.price}</p>
          <p className="mt-2 text-xs font-bold text-accent-foreground">
            {customerCancelled
              ? "Zrušeno zákazníkem"
              : r.status === "confirmed" && r.endsAt <= now
                ? "Proběhlá rezervace"
                : formatStatus(r.status)}
          </p>
        </div>
      </div>
      {price.bonus ? (
        <p className="mt-3 text-sm font-bold text-success">
          Bonusový 10. vstup zdarma
          {price.amount && price.amount > 0 ? " · cena zahrnuje doprovod" : ""}
        </p>
      ) : null}
      {customerCancelled ? (
        <p className="mt-4 border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
          {price.note}
        </p>
      ) : null}
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
    </article>
  );
}
