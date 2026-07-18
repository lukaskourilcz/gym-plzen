"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { startCheckoutAction } from "./actions";

/** Shared look of one slot card (button, link and the disabled "obsazeno"). */
export const slotCardClass =
  "block w-full rounded-xl border py-3 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
      className={cn(
        slotCardClass,
        "border-primary/40 bg-primary/10 hover:bg-primary hover:text-primary-foreground disabled:opacity-60",
        error && "border-destructive/60 bg-destructive/10",
      )}
    >
      {label}
      <span className="block text-[10px] font-normal uppercase tracking-wider opacity-70">
        {pending ? "rezervuji…" : error ? "zkuste jiný čas" : "volno"}
      </span>
    </button>
  );
}
