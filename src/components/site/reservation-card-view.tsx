import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";
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

/** Shared presentation only: the preview never imports live reservation actions. */
export type CardReservation = CancellationPrice & {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  cancelReason: string | null;
  extraPeople: number;
};
export function ReservationCardView({
  reservation: r,
  now,
  participantsEnabled,
  customerCancelled = false,
  children,
}: {
  reservation: CardReservation;
  now: Date;
  participantsEnabled: boolean;
  customerCancelled?: boolean;
  children?: ReactNode;
}) {
  const label = `${formatDate(r.startsAt)} ${formatTimeRange(r.startsAt, r.endsAt)}`;
  const price = cancellationPrice(r);
  return (
    <article
      data-reservation-id={r.id}
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
      {children}
    </article>
  );
}
