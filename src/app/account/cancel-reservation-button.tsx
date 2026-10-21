"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogActions,
  DIALOG_BUTTON_CLASS,
} from "@/components/ui/dialog";
import {
  cancellationPrice,
  type CancellationPrice,
} from "@/lib/config/customer-cancellation";
import { receiveAction } from "@/lib/helpers/action-response";
import { cancelMyReservationAction } from "./actions";

import { usePublicNotices } from "@/components/site/public-notices-provider";
import { CancellationNotice } from "@/components/site/cancellation-notice";
import { renderNotice } from "@/lib/config/public-notices";

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
  const copy = usePublicNotices().cancellation;
  const variables = {
    time: startsAtLabel,
    price: amount.price,
    refund_note: amount.note,
  };
  const text = (key: string) => renderNotice(copy[key] ?? "", variables);
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
          title={text("title")}
          className="max-w-3xl"
          description={startsAtLabel}
          busy={pending}
          onClose={() => setConfirming(false)}
        >
          <CancellationNotice
            copy={copy}
            variables={variables}
            insideCutoff={insideCutoff}
          />
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
          <DialogActions
            columns={canReschedule && !interrupted && !pending ? 3 : 2}
          >
            {canReschedule && !interrupted && !pending ? (
              <Button
                href={`/account/rezervace/${reservationId}/zmenit`}
                variant="outline"
                className={DIALOG_BUTTON_CLASS}
              >
                {text("alternative")}
              </Button>
            ) : null}
            <Button
              data-initial-focus
              className={DIALOG_BUTTON_CLASS}
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              {text("keep")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className={DIALOG_BUTTON_CLASS}
              disabled={pending || interrupted}
              onClick={cancel}
            >
              {pending
                ? "Ruším…"
                : amount.amount === 0
                  ? text("confirmFree")
                  : text("confirmPaid")}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </>
  );
}
