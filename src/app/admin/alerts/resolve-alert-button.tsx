"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { resolveAlertAction } from "./actions";

/** Marks one open alert as dealt with; same pattern as the voucher toggle. */
export function ResolveAlertButton({
  id,
  title,
}: {
  id: string;
  /** Names the alert, so every row's control reads differently. */
  title: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resolve() {
    setError(null);
    startTransition(async () => {
      const result = await resolveAlertAction({ id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={resolve}
        aria-label={`Označit jako vyřešené: ${title}`}
      >
        {pending ? "Ukládám…" : "Vyřešeno"}
      </Button>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
