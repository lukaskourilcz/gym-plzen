"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3 } from "lucide-react";
import { startCheckoutAction } from "./actions";

/**
 * A bookable slot for a signed-in member. Clicking starts checkout: for a paid
 * entry it redirects to Stripe; for a free loyalty entry it goes straight to the
 * confirmation page.
 */
export function SlotButton({
  startsAtISO,
  dateKey,
  label,
  durationMinutes,
  price,
}: {
  startsAtISO: string;
  dateKey: string;
  label: string;
  durationMinutes: number;
  price: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await startCheckoutAction({ startsAt: startsAtISO });
      if (!result.ok) {
        setError(result.error);
        router.refresh();
        return;
      }
      if (result.data.kind === "checkout") {
        window.location.href = result.data.url;
      } else {
        router.push(
          `/rezervace/hotovo?reservation_id=${result.data.reservationId}`,
        );
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-describedby={error ? `slot-error-${startsAtISO}` : undefined}
        className="flex min-h-16 w-full items-center justify-between rounded-md border border-primary/35 bg-primary/10 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-primary/20 disabled:cursor-wait disabled:opacity-60"
      >
        <span>
          <span className="block text-sm font-extrabold">
            {pending ? "Připravuji platbu…" : label}
          </span>
          <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
            {durationMinutes} min · {price}
          </span>
        </span>
        <Clock3 aria-hidden="true" className="size-4 text-accent-foreground" />
      </button>
      {error ? (
        <p
          id={`slot-error-${startsAtISO}`}
          role="alert"
          className="mt-2 text-sm font-semibold text-destructive"
        >
          {error} Vybraný den {dateKey} zůstává otevřený.
        </p>
      ) : null}
    </div>
  );
}
