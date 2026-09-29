"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { adminUnsubscribeAction } from "./actions";

/** Withdraws one subscriber's consent; same pattern as the voucher toggle. */
export function UnsubscribeButton({ email }: { email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label={`Odhlásit ${email} z novinek`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await adminUnsubscribeAction({ email });
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Ukládám…" : "Odhlásit"}
      </Button>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
