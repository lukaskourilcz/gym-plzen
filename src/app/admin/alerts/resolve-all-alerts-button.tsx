"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog } from "@/components/admin/dialog";
import { Button } from "@/components/admin/ui/button";
import { resolveAllAlertsAction } from "./actions";

export function ResolveAllAlertsButton({
  count,
  before,
}: {
  count: number;
  before: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={!count || pending}
        aria-haspopup="dialog"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Vyřešit všechny incidenty
      </Button>
      {open && (
        <AdminDialog
          title="Vyřešit všechny incidenty"
          description={`Uzavřít všechny otevřené incidenty z tohoto přehledu (${count})? Tímto se nevrací platby ani neposílají zprávy.`}
          onClose={() => setOpen(false)}
          busy={pending}
        >
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const note = String(
                new FormData(event.currentTarget).get("note") ?? "",
              );
              setError(null);
              start(async () => {
                const result = await resolveAllAlertsAction({ before, note });
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <label className="grid gap-2 text-sm">
              Poznámka k vyřešení (nepovinné)
              <textarea
                name="note"
                maxLength={500}
                rows={2}
                data-ui="textarea"
                className="rounded-md border border-input px-3 py-2"
                disabled={pending}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                data-initial-focus
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Ponechat otevřené
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Uzavírám…" : "Potvrdit vyřešení všech"}
              </Button>
            </div>
          </form>
        </AdminDialog>
      )}
    </>
  );
}
