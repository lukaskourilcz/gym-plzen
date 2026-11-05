"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { AdminDialog } from "./dialog";
import { IconButton } from "./ui/icon-button";
import { Button } from "@/components/admin/ui/button";
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
  const [open, setOpen] = useState(false);
  const [destination, setDestination] =
    useState<InvoiceDestination>("operator");
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [issued, setIssued] = useState<{ id: string; number: string } | null>(
    null,
  );
  const documentId = issued?.id ?? state.invoiceId;
  const documentNumber = issued?.number ?? state.invoiceNumber;
  return (
    <>
      <div
        className="inline-flex items-center gap-2 whitespace-nowrap"
        data-ui="reservation-invoice"
      >
        <span className={documentId ? undefined : "text-muted-foreground"}>
          {documentNumber ?? (documentId ? "Faktura" : "Bez dokladu")}
        </span>
        <IconButton
          icon={FileText}
          aria-label="Spravovat fakturu"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        />
      </div>
      {open && (
        <AdminDialog
          title="Faktura k rezervaci"
          description="Vyberte příjemce faktury a potvrďte odeslání."
          onClose={() => setOpen(false)}
          busy={pending}
        >
          <div className="mt-4 flex flex-col gap-3">
            {documentId && (
              <a
                href={`/admin/doklady/${documentId}/pdf`}
                className="inline-flex min-h-11 items-center text-sm font-medium underline"
              >
                Stáhnout PDF{documentNumber ? ` · ${documentNumber}` : ""}
              </a>
            )}
            <label htmlFor={id} className="text-sm font-semibold">
              Příjemce faktury
            </label>
            <select
              data-ui="select"
              id={id}
              data-initial-focus
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
                {state.customerEmail
                  ? ` · ${state.customerEmail}`
                  : " · bez e-mailu"}
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
                    setIssued({
                      id: result.data.invoiceId,
                      number: result.data.number,
                    });
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
        </AdminDialog>
      )}
    </>
  );
}
