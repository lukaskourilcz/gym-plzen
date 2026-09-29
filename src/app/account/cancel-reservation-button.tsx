"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/admin/form-controls";
import { cancelMyReservationAction } from "./actions";

/**
 * Two-step storno of the customer's own booking (the same inline pattern as
 * the administration's cancel). The first click only opens the confirmation,
 * which says plainly that the price is not refunded; focus moves into it and
 * returns to the trigger when the booking is kept.
 */
export function CancelReservationButton({
  reservationId,
  startsAtLabel,
}: {
  reservationId: string;
  /** "1. 10. 2026 · 10:00 – 11:15", so every row's control reads differently. */
  startsAtLabel: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const trigger = useRef<HTMLDivElement>(null);
  const noteId = useId();

  function keep() {
    setConfirming(false);
    setError(null);
    requestAnimationFrame(() =>
      trigger.current?.querySelector("button")?.focus(),
    );
  }

  function cancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelMyReservationAction({ id: reservationId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/account?storno=hotovo");
      router.refresh();
    });
  }

  if (!confirming)
    return (
      <div ref={trigger}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Zrušit rezervaci ${startsAtLabel}`}
          onClick={() => setConfirming(true)}
        >
          Zrušit rezervaci
        </Button>
      </div>
    );

  return (
    <div
      role="group"
      aria-label={`Zrušení rezervace ${startsAtLabel}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          keep();
        }
      }}
      className="mt-3 w-full rounded-md border border-destructive/40 bg-destructive/5 p-4"
    >
      <p id={noteId} className="text-sm">
        Termín se uvolní pro ostatní a vstupní kód přestane platit.{" "}
        <strong>Zaplacená cena se nevrací.</strong> Pokud chcete jen jiný čas,
        použijte raději změnu termínu.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          // Focus moves into the confirmation the click opened.
          autoFocus
          disabled={pending}
          aria-describedby={noteId}
          onClick={cancel}
        >
          {pending ? "Ruším…" : "Ano, zrušit bez vrácení platby"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={keep}
        >
          Ponechat rezervaci
        </Button>
      </div>
      <FormFeedback error={error} />
    </div>
  );
}
