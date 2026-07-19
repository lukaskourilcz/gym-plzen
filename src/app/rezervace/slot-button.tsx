"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startCheckoutAction } from "./actions";

/**
 * A bookable slot for a signed-in member. Clicking starts checkout: for a paid
 * entry it redirects to Stripe; for a free loyalty entry it goes straight to the
 * confirmation page.
 */
export function SlotButton({ startsAtISO, label }: { startsAtISO: string; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await startCheckoutAction({ startsAt: startsAtISO });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.data.kind === "checkout") {
        window.location.href = result.data.url;
      } else {
        router.push(`/rezervace/hotovo?free=1`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={error ?? undefined}
      className="rounded-lg border-[1.5px] border-primary/40 bg-primary/10 py-2 text-center text-sm font-bold transition-colors hover:bg-primary disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}
