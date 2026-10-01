import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { emailArchive, invoice, messageDelivery } from "@/lib/db/schema";
import type { Invoice } from "@/lib/db/types";
import { brandedSender } from "@/lib/config/email-templates";
import {
  INVOICE_OPERATOR_EMAIL,
  type InvoiceDestination,
  type ReservationInvoiceState,
} from "@/lib/config/invoice-delivery";
import { hasEnv, requireEnv } from "@/lib/env";
import { formatMoney } from "@/lib/helpers/format";
import { ActionError } from "@/lib/helpers/action";
import { logger } from "@/lib/helpers/logger";
import type { SendEmailParams } from "@/lib/integrations/resend";
import { createResendSender } from "@/lib/integrations/resend-transport";
import { prepareTransactionalEmail } from "./email-templates";
import { getReservation } from "./reservations";
import { issueDocumentFor, pdfFilename, renderPdf } from "./invoices";
import { withOperationLock } from "./operation-lock";

// Resend retains its key for 24h. Never retry an uncertain acceptance after it
// expires: an operator must inspect the provider before an explicit redelivery.
const RETRY_WINDOW_MS = 23 * 60 * 60_000;
type PreparedInvoice = { sender: string; email: SendEmailParams };
export interface InvoiceSendOutcome {
  invoiceId: string;
  number: string;
  sent: string[];
  failed: { recipient: string; reason: string }[];
}

/** One bounded, read-only query for the visible reservation page/profile. */
export async function reservationInvoiceStates(ids: string[]) {
  if (!ids.length) return new Map<string, ReservationInvoiceState>();
  const rows = await db.execute<
    ReservationInvoiceState & { id: string } & Record<string, unknown>
  >(sql`
    select r.id, i.id as "invoiceId", i.number as "invoiceNumber",
      case when i.id is not null then i.customer_email
        else coalesce(o.contact_email,r.contact_email,p.email) end as "customerEmail",
      (i.id is not null or (
        r.status in ('confirmed','completed','cancelled','no_show')
        and lower(coalesce(o.currency,r.currency))='czk'
        and coalesce(o.total_cents,r.price_cents)>0
        and exists (select 1 from public.payment pay
          where (case when r.order_id is not null then pay.order_id=r.order_id
            else pay.reservation_id=r.id end)
          and pay.status='succeeded' and pay.paid_at is not null
          and pay.amount_cents=coalesce(o.total_cents,r.price_cents)
          and lower(pay.currency)=lower(coalesce(o.currency,r.currency)))
      )) as eligible
    from public.reservation r
    left join public.booking_order o on o.id=r.order_id
    left join public.profiles p on p.id=r.user_id
    left join public.invoice i on (case when r.order_id is not null
      then i.order_id=r.order_id else i.reservation_id=r.id end)
    where r.id in (${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`,`,
    )})`);
  return new Map(rows.map((row) => [row.id, row]));
}

/** Caller is the admin-only server action. Destinations are server controlled. */
export async function createAndSendInvoice(
  reservationId: string,
  destination: InvoiceDestination,
): Promise<InvoiceSendOutcome> {
  const reservation = await getReservation(reservationId);
  if (!reservation) throw new ActionError("Rezervace nebyla nalezena.");
  const outcome = await issueDocumentFor(reservation, { force: true });
  if (!outcome.issued && outcome.reason !== "already_issued") {
    throw new ActionError(
      outcome.reason === "profile_incomplete"
        ? "Nejdřív doplňte fakturační údaje v Nastavení."
        : "Fakturu lze vytvořit pouze ke skutečně zaplacené rezervaci s doloženou částkou a datem platby.",
    );
  }
  return sendInvoiceDocument(outcome.invoice, destination);
}

/**
 * Initial send is once per invoice/address, including across reloads and slots
 * of one order. An explicit redelivery has its own stable UI request UUID.
 * Each address receives a separate email and a separate archive/delivery row.
 */
export async function sendInvoiceDocument(
  row: Invoice,
  destination: InvoiceDestination,
  redeliveryId?: string,
): Promise<InvoiceSendOutcome> {
  if (!["operator", "customer", "both"].includes(destination))
    throw new ActionError("Vyberte příjemce faktury.");
  if (redeliveryId && !z.string().uuid().safeParse(redeliveryId).success)
    throw new ActionError("Neplatný požadavek na opětovné odeslání.");
  const customer = row.customerEmail?.trim().toLowerCase();
  if (
    destination !== "operator" &&
    !z.string().email().safeParse(customer).success
  )
    throw new ActionError("U dokladu není platná e-mailová adresa zákazníka.");
  const recipients = [
    ...new Set([
      ...(destination !== "operator" ? [customer!] : []),
      ...(destination !== "customer" ? [INVOICE_OPERATOR_EMAIL] : []),
    ]),
  ];
  const outcome: InvoiceSendOutcome = {
    invoiceId: row.id,
    number: row.number,
    sent: [],
    failed: [],
  };
  // Serialize both destinations as well as redeliveries for consistent sentTo.
  return withOperationLock(`invoice-delivery:${row.id}`, async () => {
    for (const recipient of recipients) {
      const suffix = createHash("sha256").update(recipient).digest("hex");
      const key = `invoice/${row.id}/${suffix}${redeliveryId ? `/${redeliveryId}` : ""}`;
      let reason: string | null;
      try {
        reason = await sendOne(row, recipient, key);
      } catch {
        // A Drizzle error may embed the complete PDF/email bind parameters.
        // Keep it out of logs and return an uncertain outcome, retaining the
        // durable provider key for the next operator-initiated retry.
        logger.error(new Error("Invoice delivery could not be recorded"), {
          where: "invoice-delivery",
          invoiceId: row.id,
        });
        reason = "invoice_delivery_unconfirmed";
      }
      if (reason) outcome.failed.push({ recipient, reason });
      else outcome.sent.push(recipient);
    }
    return outcome;
  });
}

async function sendOne(row: Invoice, recipient: string, key: string) {
  let [delivery] = await db
    .select()
    .from(messageDelivery)
    .where(eq(messageDelivery.dedupeKey, key))
    .limit(1);
  if (delivery && ["sent", "delivered", "read"].includes(delivery.status))
    return null;
  if (!hasEnv("RESEND_API_KEY", "RESEND_FROM_EMAIL"))
    return "resend_not_configured";
  if (!delivery) {
    const pdf = await renderPdf(row);
    const prepared: PreparedInvoice = {
      sender: brandedSender(requireEnv("RESEND_FROM_EMAIL").RESEND_FROM_EMAIL),
      email: await prepareTransactionalEmail({
        id: "payment_document",
        to: recipient,
        attachments: [
          { filename: pdfFilename(row), content: pdf.toString("base64") },
        ],
        variables: {
          name: row.customerName || "zákazníku",
          number: row.number,
          amount: formatMoney(row.totalCents, row.currency),
          date: new Intl.DateTimeFormat("cs-CZ", {
            day: "numeric",
            month: "numeric",
            year: "numeric",
            timeZone: "Europe/Prague",
          }).format(row.issuedAt),
        },
      }),
    };
    [delivery] = await db
      .insert(messageDelivery)
      .values({
        userId: row.userId,
        reservationId: row.reservationId,
        channel: "email",
        kind: "payment_document",
        recipient,
        status: "queued",
        dedupeKey: key,
        providerResponse: prepared,
      })
      .returning();
  }
  if (!delivery) throw new Error("invoice outbox insert failed");
  if (Date.now() - delivery.createdAt.getTime() >= RETRY_WINDOW_MS)
    return "retry_window_expired";
  const prepared = delivery.providerResponse as PreparedInvoice | null;
  if (
    !prepared?.sender ||
    prepared.email?.to !== recipient ||
    typeof prepared.email.html !== "string" ||
    !prepared.email.attachments?.length
  )
    return "invalid_invoice_outbox";
  const result = await createResendSender({
    apiKey: requireEnv("RESEND_API_KEY").RESEND_API_KEY,
    from: prepared.sender,
    baseUrl: process.env.RESEND_BASE_URL,
  })({ ...prepared.email, idempotencyKey: key });
  if (!result.sent || !result.providerMessageId) {
    await db
      .update(messageDelivery)
      .set({
        status: "failed",
        failureReason: result.error ?? "resend_unconfirmed",
        updatedAt: new Date(),
      })
      .where(eq(messageDelivery.id, delivery.id));
    return result.error ?? "resend_unconfirmed";
  }
  // Archive and confirmed ledger state commit together. A failed DB write
  // keeps the exact queued request for a safe provider-key retry.
  const sentAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(emailArchive)
      .values({
        providerMessageId: result.providerMessageId!,
        sender: prepared.sender,
        recipient,
        subject: prepared.email.subject,
        html: prepared.email.html,
        bodyText: prepared.email.text,
        sentAt,
        attachmentNames: prepared.email.attachments!.map((a) => a.filename),
      })
      .onConflictDoNothing({ target: emailArchive.providerMessageId });
    await tx
      .update(messageDelivery)
      .set({
        status: "sent",
        providerMessageId: result.providerMessageId,
        failureReason: null,
        providerResponse: null,
        sentAt,
        updatedAt: sentAt,
      })
      .where(eq(messageDelivery.id, delivery.id));
    await tx
      .update(invoice)
      .set({ sentAt, sentTo: recipient })
      .where(eq(invoice.id, row.id));
  });
  return null;
}
