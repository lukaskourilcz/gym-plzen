"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setVoucherActiveAction } from "./actions";

export function VoucherStatusButton({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setVoucherActiveAction({ id, isActive: !isActive });
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
        onClick={toggle}
      >
        {pending ? "Ukládám…" : isActive ? "Deaktivovat" : "Aktivovat"}
      </Button>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
