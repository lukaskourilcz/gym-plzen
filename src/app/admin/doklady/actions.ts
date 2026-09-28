"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guards";
import { ActionError, defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { idSchema } from "@/lib/validations/common";
import { invoices, reservations } from "@/lib/services";

const documentIdSchema = z.object({ id: idSchema });
type DocumentIdValues = z.infer<typeof documentIdSchema>;

/** Send an already-issued document again, e.g. after a bounced address. */
const resendImpl = defineAction({
  schema: documentIdSchema,
  authorize: assertAdmin,
  handler: async ({ id }) => {
    const row = await invoices.getInvoice(id);
    if (!row) throw new ActionError("Doklad nebyl nalezen.");
    if (!row.customerEmail) {
      throw new ActionError("U dokladu není e-mailová adresa.");
    }
    const sent = await invoices.sendInvoiceEmail(row);
    if (!sent) {
      throw new ActionError(
        "Odeslání se nezdařilo. Zkontrolujte nastavení Resendu.",
      );
    }
    revalidatePath("/admin/doklady");
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
    if (reservation.status !== "confirmed") {
      throw new ActionError("Doklad lze vystavit jen k potvrzené rezervaci.");
    }

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
  },
});

export async function issueDocumentAction(
  input: ReservationIdValues,
): Promise<Result<unknown>> {
  return issueImpl(input);
}
