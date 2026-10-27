"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog } from "./dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/helpers/format";
import { adjustCreditAction } from "@/app/admin/credits/actions";
export function CreditEditor({
  userId,
  email,
  name,
  balance = 0,
  reserved = 0,
  label = "Spravovat kredity",
}: {
  userId?: string;
  email?: string;
  name?: string;
  balance?: number;
  reserved?: number;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState<"add" | "remove" | "set">("add"),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState("");
  const cents = Math.round(Number(amount) * 100);
  const next =
    mode === "set" ? cents : balance + (mode === "remove" ? -cents : cents);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setKey(crypto.randomUUID());
          setError(null);
          setOpen(true);
        }}
      >
        {label}
      </Button>
      {open ? (
        <AdminDialog
          busy={busy}
          title={`Kredity · ${name || email || "zákazník"}`}
          description="Opravy se zapisují do historie. Utracený kredit ani kredit držený v rozpracované platbě nelze odebrat."
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="mt-5 grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              try {
                const result = await adjustCreditAction({
                  userId,
                  email,
                  name,
                  mode,
                  amountCents: cents,
                  expectedBalance: balance,
                  reason,
                  key,
                });
                if (!result.ok) setError(result.error);
                else {
                  setOpen(false);
                  setAmount("");
                  setReason("");
                  router.refresh();
                }
              } catch {
                setError(
                  "Výsledek se nepodařilo načíst. Zkontrolujte historii před novou úpravou.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="grid gap-2 text-sm font-bold">
              Úprava
              <Select
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
                disabled={busy}
              >
                <option value="add">Přidat kredit</option>
                <option value="remove">Odebrat kredit</option>
                <option value="set">Nastavit celkový zůstatek</option>
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Částka v Kč
              <Input
                data-initial-focus
                required
                type="number"
                min={mode === "set" ? 0 : 0.01}
                step="0.01"
                max="1000000"
                value={amount}
                disabled={busy}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Důvod změny
              <Textarea
                required
                minLength={3}
                maxLength={500}
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <p className="text-sm">
              Nový zůstatek:{" "}
              <strong>{Number.isFinite(next) ? formatMoney(next) : "—"}</strong>
              {reserved > 0
                ? ` · z toho v rozpracované platbě ${formatMoney(reserved)}`
                : ""}
            </p>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Zpět
              </Button>
              <Button
                type="submit"
                disabled={busy || !amount || next < reserved}
              >
                {busy ? "Ukládám…" : "Uložit změnu"}
              </Button>
            </div>
          </form>
        </AdminDialog>
      ) : null}
    </>
  );
}
