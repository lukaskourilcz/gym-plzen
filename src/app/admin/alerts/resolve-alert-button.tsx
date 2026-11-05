"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog } from "@/components/admin/dialog";
import { Button } from "@/components/admin/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resolveAlertAction } from "./actions";

export function ResolveAlertButton({
  id,
  title,
  refund,
}: {
  id: string;
  /** Names the alert, so every row's control reads differently. */
  title: string;
  refund: boolean;
}) {
  const router = useRouter();
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = String(new FormData(event.currentTarget).get("note") ?? "");
    setError(null);
    startTransition(async () => {
      const result = await resolveAlertAction({ id, note });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-haspopup="dialog"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-label={`Označit jako vyřešené: ${title}`}
      >
        Vyřešeno
      </Button>
      {open ? (
        <AdminDialog
          title="Uzavřít incident"
          description={
            refund
              ? "Před uzavřením ověřte stav vrácení platby v Comgate."
              : title
          }
          onClose={() => setOpen(false)}
          busy={pending}
        >
          <form onSubmit={resolve} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor={noteId} className="text-sm font-medium">
                Jak byl incident vyřešen? (nepovinné)
              </label>
              <Textarea
                id={noteId}
                name="note"
                maxLength={500}
                data-initial-focus
                disabled={pending}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Ukládám…" : "Uložit a uzavřít"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Zpět
              </Button>
            </div>
          </form>
        </AdminDialog>
      ) : null}
    </>
  );
}
