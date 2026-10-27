"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getRescheduleEligibility,
  rescheduleReasonMessage,
} from "@/lib/config/rescheduling";
import type { CancellationPrice } from "@/lib/config/customer-cancellation";
import { formatDateTime } from "@/lib/helpers/format";
import { CancelReservationButton } from "./cancel-reservation-button";

export function ReservationActions({
  id,
  startsAt,
  status,
  changed,
  nowISO,
  label,
  price,
}: {
  id: string;
  startsAt: string;
  status: string;
  changed: boolean;
  nowISO: string;
  label: string;
  price: CancellationPrice;
}) {
  const [now, setNow] = useState(() => new Date(nowISO));
  const start = new Date(startsAt);
  useEffect(() => {
    const update = () => setNow(new Date());
    const deadline = new Date(startsAt).getTime() - 24 * 3_600_000;
    const next = [deadline + 1, new Date(startsAt).getTime()].find(
      (time) => time > now.getTime(),
    );
    const timer = next
      ? setTimeout(
          update,
          Math.min(Math.max(1, next - Date.now()), 2_147_483_647),
        )
      : undefined;
    window.addEventListener("focus", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
    };
  }, [startsAt, now]);
  const eligibility = getRescheduleEligibility(
    { status, startsAt: start },
    changed,
    now,
  );
  const canCancel = status === "confirmed" && start > now;
  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-sm leading-6 text-muted-foreground">
        {eligibility.eligible
          ? `Změna termínu do ${formatDateTime(eligibility.deadline)}. Termín můžete změnit jednou; případný rozdíl ceny uvidíte před potvrzením.`
          : rescheduleReasonMessage(eligibility.reason)}
      </p>
      {canCancel ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {eligibility.eligible ? (
            <Button
              href={`/account/rezervace/${id}/zmenit`}
              variant="outline"
              size="sm"
            >
              Změnit termín
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled>
              Změna termínu není dostupná
            </Button>
          )}
          <CancelReservationButton
            reservationId={id}
            startsAtLabel={label}
            price={price}
            canReschedule={eligibility.eligible}
            insideCutoff={start.getTime() - now.getTime() < 24 * 3_600_000}
          />
        </div>
      ) : null}
    </div>
  );
}
