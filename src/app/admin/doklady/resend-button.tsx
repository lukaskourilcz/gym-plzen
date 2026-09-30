"use client";

import { useRef, useState, useTransition } from "react";
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
  const requestId = useRef<string | null>(null);
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
            try {
              requestId.current ??= crypto.randomUUID();
              const result = await resendDocumentAction({
                id,
                requestId: requestId.current,
              });
              if (result.ok) requestId.current = null;
              setMessage({
                text: result.ok ? `Doklad ${number} odeslán.` : result.error,
                isError: !result.ok,
              });
            } catch {
              setMessage({
                text: "Došlo k neočekávané chybě. Zkuste to prosím znovu.",
                isError: true,
              });
            }
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
