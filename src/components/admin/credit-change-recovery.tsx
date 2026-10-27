"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  recoverCreditChangeAction,
  confirmCreditRefundAction,
} from "@/app/admin/credits/actions";
export function CreditChangeRecovery({
  id,
  refundPending,
}: {
  id: string;
  refundPending: boolean;
}) {
  const router = useRouter();
  const [reference, setReference] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function run(confirm: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = confirm
        ? await confirmCreditRefundAction({ id, reference })
        : await recoverCreditChangeAction({ id });
      if (!result.ok) setError(result.error);
      else router.refresh();
    } catch {
      setError("Výsledek se nepodařilo načíst. Ověřte stav před opakováním.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-2">
      {refundPending ? (
        <>
          <label className="grid gap-1 text-xs">
            Reference dokončené refundace v Comgate
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={200}
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || reference.trim().length < 3}
            onClick={() => void run(true)}
          >
            Potvrdit ověřené vrácení
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void run(false)}
        >
          Znovu ověřit a napravit změnu
        </Button>
      )}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
