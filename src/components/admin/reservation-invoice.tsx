"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createAndSendInvoiceAction } from "@/app/admin/doklady/actions";
import {
  INVOICE_OPERATOR_EMAIL,
  type InvoiceDestination,
  type ReservationInvoiceState,
} from "@/lib/config/invoice-delivery";

export function ReservationInvoice({
  reservationId,
  state,
}: {
  reservationId: string;
  state: ReservationInvoiceState;
}) {
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [destination, setDestination] =
    useState<InvoiceDestination>("operator");
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [issuedId, setIssuedId] = useState<string | null>(null);
  const documentId = issuedId ?? state.invoiceId;
  return (
    <div className="flex min-w-60 max-w-xs flex-col gap-2">
      {documentId && (
        <a
          href={`/admin/doklady/${documentId}/pdf`}
          className="inline-flex min-h-11 items-center text-sm font-bold underline"
        >
          Stáhnout PDF{state.invoiceNumber ? ` · ${state.invoiceNumber}` : ""}
        </a>
      )}
      <label htmlFor={id} className="text-sm font-semibold">
        Příjemce faktury
      </label>
      <select
        id={id}
        value={destination}
        disabled={pending || !state.eligible}
        onChange={(event) =>
          setDestination(event.target.value as InvoiceDestination)
        }
        className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <option value="operator">{INVOICE_OPERATOR_EMAIL}</option>
        <option value="customer" disabled={!state.customerEmail}>
          Zákazník
          {state.customerEmail ? ` · ${state.customerEmail}` : " · bez e-mailu"}
        </option>
        <option value="both" disabled={!state.customerEmail}>
          Zákazník a {INVOICE_OPERATOR_EMAIL}
        </option>
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || !state.eligible}
        onClick={() =>
          start(async () => {
            try {
              const result = await createAndSendInvoiceAction({
                reservationId,
                destination,
              });
              if (!result.ok) {
                setMessage({ text: result.error, error: true });
                return;
              }
              setIssuedId(result.data.invoiceId);
              const sent = result.data.sent.length
                ? `Faktura ${result.data.number} odeslána na ${result.data.sent.join(", ")}.`
                : `Faktura ${result.data.number} vytvořena.`;
              const failures = result.data.failed
                .map((failure) =>
                  failure.reason === "retry_window_expired"
                    ? `${failure.recipient}: před dalším odesláním ověřte stav v Resendu; bezpečná lhůta pro opakování vypršela.`
                    : `${failure.recipient}: odeslání nebylo potvrzeno, zkuste znovu.`,
                )
                .join(" ");
              setMessage({
                text: `${sent}${failures ? ` ${failures}` : ""}`,
                error: !!failures,
              });
              router.refresh();
            } catch {
              setMessage({
                text: "Výsledek odeslání se nepodařilo ověřit. Zkuste stejnou volbu znovu.",
                error: true,
              });
            }
          })
        }
      >
        {pending ? "Odesílám…" : "Vytvořit a poslat fakturu"}
      </Button>
      {!state.eligible && (
        <span className="text-xs text-muted-foreground">
          Není doložena odpovídající platba. Ke vstupu zdarma se doklad o
          zaplacení nevystavuje.
        </span>
      )}
      {message && (
        <span
          role={message.error ? "alert" : "status"}
          className={
            message.error
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
