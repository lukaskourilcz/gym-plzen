"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  cancellationPrice,
  type CancellationPrice,
} from "@/lib/config/customer-cancellation";
import { receiveAction } from "@/lib/helpers/action-response";
import { cancelMyReservationAction } from "./actions";

export function CancelReservationButton({
  reservationId,
  startsAtLabel,
  price,
  canReschedule,
  insideCutoff,
}: {
  reservationId: string;
  startsAtLabel: string;
  price: CancellationPrice;
  canReschedule: boolean;
  insideCutoff: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const amount = cancellationPrice(price);
  async function cancel() {
    if (pending || interrupted) return;
    setPending(true);
    setError(null);
    const response = await receiveAction(() =>
      cancelMyReservationAction({ id: reservationId }),
    );
    if (!response.received) {
      setPending(false);
      setInterrupted(true);
      setError(
        "Výsledek storna se nepodařilo načíst. Rezervace už mohla být zrušena. Zkontrolujte její stav v účtu; storno nyní neopakujte.",
      );
      return;
    }
    if (!response.result.ok) {
      setPending(false);
      setError(response.result.error);
      return;
    }
    router.push("/account?storno=hotovo&view=history");
  }
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Zrušit rezervaci ${startsAtLabel}`}
        onClick={() => {
          setConfirming(true);
          setError(null);
          setInterrupted(false);
        }}
      >
        Zrušit rezervaci
      </Button>
      {confirming ? (
        <Dialog
          title="Zrušit tuto rezervaci?"
          description={startsAtLabel}
          busy={pending}
          onClose={() => setConfirming(false)}
        >
          <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6">
            <p>
              Rezervace přestane platit a termín se po ověřeném odebrání
              vstupního kódu uvolní pro ostatní. Původní kód už nepoužívejte.
            </p>
            <p className="mt-3 font-bold">{amount.note}</p>
            {insideCutoff ? (
              <p className="mt-3">
                Do začátku zbývá méně než 24 hodin. Změna termínu už není možná.
              </p>
            ) : null}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Zrušíte pouze tento termín. Ostatní rezervace z objednávky zůstanou
            platné. Potvrzení storna pošleme e-mailem.
          </p>
          {canReschedule && !interrupted && !pending ? (
            <Button
              href={`/account/rezervace/${reservationId}/zmenit`}
              variant="outline"
              className="mt-4"
            >
              Raději změnit termín
            </Button>
          ) : null}
          {error ? (
            <p role="alert" className="mt-4 text-sm font-bold text-destructive">
              {error}
            </p>
          ) : null}
          {interrupted ? (
            <a
              href="/account?view=history"
              className="mt-4 inline-flex min-h-11 items-center font-bold underline"
            >
              Zkontrolovat rezervaci v účtu
            </a>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              data-initial-focus
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Ponechat rezervaci
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || interrupted}
              onClick={cancel}
            >
              {pending
                ? "Ruším…"
                : amount.amount === 0
                  ? "Ano, zrušit rezervaci"
                  : "Ano, zrušit bez vrácení platby"}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
