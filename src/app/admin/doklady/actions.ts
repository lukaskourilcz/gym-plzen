"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { ActionError, defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { idSchema } from "@/lib/validations/common";
import { invoices, reservations } from "@/lib/services";
import { INVOICE_DESTINATIONS } from "@/lib/config/invoice-delivery";
import { createAndSendInvoice } from "@/lib/services/invoice-delivery";

const documentIdSchema = z.object({
  id: idSchema,
  requestId: z.string().uuid(),
});
type DocumentIdValues = z.infer<typeof documentIdSchema>;

/** Send an already-issued document again, e.g. after a bounced address. */
const resendImpl = defineAction({
  schema: documentIdSchema,
  authorize: assertAdmin,
  handler: async ({ id, requestId }) => {
    const row = await invoices.getInvoice(id);
    if (!row) throw new ActionError("Doklad nebyl nalezen.");
    if (!row.customerEmail) {
      throw new ActionError("U dokladu není e-mailová adresa.");
    }
    const sent = await invoices.sendInvoiceEmail(row, requestId);
    if (!sent) {
      throw new ActionError(
        "Odeslání se nezdařilo. Zkontrolujte nastavení Resendu.",
      );
    }
    revalidatePath("/admin/doklady");
    revalidatePath("/admin/messages");
  },
});

export async function resendDocumentAction(
  input: DocumentIdValues,
): Promise<Result<unknown>> {
  return resendImpl(input);
}

const reservationIdSchema = z.object({ reservationId: idSchema });
type ReservationIdValues = z.infer<typeof reservationIdSchema>;

/**
 * Issue a document for a paid reservation that never got one : typically a
 * booking taken before the billing profile was filled in. `force` bypasses the
 * automatic-sending switch, because the administrator is asking explicitly.
 */
const issueImpl = defineAction({
  schema: reservationIdSchema,
  authorize: assertAdmin,
  handler: async ({ reservationId }) => {
    const reservation = await reservations.getReservation(reservationId);
    if (!reservation) throw new ActionError("Rezervace nebyla nalezena.");
    // A slot of a multi-slot order gets the order's one document.
    const outcome = await invoices.issueDocumentFor(reservation, {
      force: true,
    });

    if (!outcome.issued) {
      throw new ActionError(
        outcome.reason === "already_issued"
          ? "K této rezervaci už doklad existuje."
          : outcome.reason === "not_billable"
            ? "Rezervace nebyla placená, doklad se nevystavuje."
            : "Nejdřív doplňte fakturační údaje v Nastavení.",
      );
    }
    revalidatePath("/admin/doklady");
    revalidatePath("/admin/reservations");
  },
});

export async function issueDocumentAction(
  input: ReservationIdValues,
): Promise<Result<unknown>> {
  return issueImpl(input);
}

const manualInvoiceSchema = z.object({
  reservationId: idSchema,
  destination: z.enum(INVOICE_DESTINATIONS),
});
const manualInvoiceImpl = defineAction({
  schema: manualInvoiceSchema,
  authorize: assertAdmin,
  handler: async ({ reservationId, destination }) => {
    const result = await createAndSendInvoice(reservationId, destination);
    revalidatePath("/admin/reservations");
    revalidatePath("/admin/doklady");
    revalidatePath("/admin/messages");
    revalidatePath("/admin/members/[id]", "page");
    return result;
  },
});

export async function createAndSendInvoiceAction(
  input: z.infer<typeof manualInvoiceSchema>,
) {
  return manualInvoiceImpl(input);
}
