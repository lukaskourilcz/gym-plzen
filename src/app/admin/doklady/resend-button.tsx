"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resendDocumentAction } from "./actions";

/**
 * Sends an already-issued document again. The number never changes : this is a
 * redelivery, not a reissue, so an accountant never sees two numbers for one
 * payment.
 */
export function ResendDocumentButton({
  id,
  number,
}: {
  id: string;
  number: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await resendDocumentAction({ id });
            setMessage({
              text: result.ok ? `Doklad ${number} odeslán.` : result.error,
              isError: !result.ok,
            });
          })
        }
      >
        {pending ? "Odesílám…" : "Poslat znovu"}
      </Button>
      {message && (
        <span
          role={message.isError ? "alert" : "status"}
          className={
            message.isError
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {message.text}
        </span>
      )}
    </span>
  );
}
