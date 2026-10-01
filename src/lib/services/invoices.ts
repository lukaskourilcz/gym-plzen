import { and, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { documentCounter, invoice, payment, profiles } from "@/lib/db/schema";
import type { InvoiceItem } from "@/lib/db/schema";
import type { Invoice, Reservation } from "@/lib/db/types";
import {
  BILLING_ENABLED_SETTING_KEY,
  BILLING_PROFILE_SETTING_KEY,
  breakDownAmount,
  documentCounterKey,
  DEFAULT_BILLING_PROFILE,
  formatDocumentNumber,
  isBillingProfileComplete,
  missingBillingFields,
  parseBillingProfile,
  type BillingProfile,
} from "@/lib/config/billing";
import { formatDateTime } from "@/lib/helpers/format";
import { logger } from "@/lib/helpers/logger";
import { renderInvoicePdf, type InvoiceDocument } from "@/lib/pdf/invoice-pdf";
import { getSetting, setSetting } from "./cms";
import { getOrder, listOrderReservations } from "./order-state";

/**
 * Payment documents: issuing, rendering and e-mailing them.
 *
 * The guiding rule is that a document must never state something the operator
 * has not told us. If the billing profile is incomplete, nothing is issued and
 * the reason is reported : an invoice carrying an invented IČO would be worse
 * than no invoice at all.
 */

// ── Billing profile ─────────────────────────────────────────────────────────

export async function getBillingProfile(): Promise<BillingProfile> {
  try {
    return parseBillingProfile(
      await getSetting<unknown>(BILLING_PROFILE_SETTING_KEY),
    );
  } catch (e) {
    logger.warn("getBillingProfile: default (DB unavailable)", {
      error: String(e),
    });
    return DEFAULT_BILLING_PROFILE;
  }
}

export async function saveBillingProfile(
  profile: BillingProfile,
  updatedByAdminId?: string | null,
): Promise<void> {
  await setSetting(BILLING_PROFILE_SETTING_KEY, profile, updatedByAdminId);
}

/** Whether the operator has switched automatic sending on. Off by default. */
export async function isSendingEnabled(): Promise<boolean> {
  try {
    return (await getSetting<boolean>(BILLING_ENABLED_SETTING_KEY)) === true;
  } catch {
    return false;
  }
}

export async function setSendingEnabled(
  enabled: boolean,
  updatedByAdminId?: string | null,
): Promise<void> {
  await setSetting(BILLING_ENABLED_SETTING_KEY, enabled, updatedByAdminId);
}

/** What the administration needs to show: is this ready, and if not, why not. */
export async function getBillingReadiness(): Promise<{
  profile: BillingProfile;
  missing: string[];
  ready: boolean;
  sendingEnabled: boolean;
}> {
  const profile = await getBillingProfile();
  const missing = missingBillingFields(profile);
  return {
    profile,
    missing,
    ready: missing.length === 0,
    sendingEnabled: await isSendingEnabled(),
  };
}

// ── Numbering ───────────────────────────────────────────────────────────────

/**
 * Next number in the year's sequence. The increment and the read are a single
 * atomic statement, so two payments landing at the same moment cannot be
 * handed the same number.
 */
async function nextSequence(
  year: number,
  executor: DatabaseExecutor = db,
): Promise<number> {
  const key = documentCounterKey(year);
  const [row] = await executor
    .insert(documentCounter)
    .values({ key, value: 1 })
    .onConflictDoUpdate({
      target: documentCounter.key,
      set: {
        value: sql`${documentCounter.value} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ value: documentCounter.value });
  // The upsert always writes exactly one row, so this is a type narrowing
  // rather than a real branch.
  if (!row) throw new Error("document counter did not return a value");
  return row.value;
}

// ── Issuing ─────────────────────────────────────────────────────────────────

export type IssueOutcome =
  | { issued: true; invoice: Invoice }
  | { issued: false; reason: "already_issued"; invoice: Invoice }
  | {
      issued: false;
      reason: "not_billable" | "not_paid" | "profile_incomplete" | "disabled";
    };

export interface IssueParams {
  reservationId: string;
  userId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  /** What the customer actually paid, in cents. */
  totalCents: number | null;
  /** The slot the payment was for, used in the item description. */
  startsAt: Date;
  paidAt?: Date;
  /** Bypass the operator's on/off switch (an admin issuing by hand). */
  force?: boolean;
  /** Set for a multi-slot order: one document for all of its slots. */
  orderId?: string;
  /** The order's lines; the description then names the order as a whole. */
  items?: InvoiceItem[];
  description?: string;
}

export async function getInvoiceForOrder(
  orderId: string,
): Promise<Invoice | null> {
  const [row] = await db
    .select()
    .from(invoice)
    .where(eq(invoice.orderId, orderId))
    .limit(1);
  return row ?? null;
}

export async function getInvoiceForReservation(
  reservationId: string,
): Promise<Invoice | null> {
  const [row] = await db
    .select()
    .from(invoice)
    .where(eq(invoice.reservationId, reservationId))
    .limit(1);
  return row ?? null;
}

/**
 * Issue the document for one paid reservation, once.
 *
 * A free loyalty entry and a membership-covered slot have nothing to invoice,
 * so they are skipped rather than issued at zero: a 0 Kč document is not a
 * payment record, and handing one to a customer only confuses them.
 */
export async function issueForReservation(
  params: IssueParams,
): Promise<IssueOutcome> {
  const existing =
    (params.orderId ? await getInvoiceForOrder(params.orderId) : null) ??
    (await getInvoiceForReservation(params.reservationId));
  if (existing) {
    return { issued: false, reason: "already_issued", invoice: existing };
  }

  if (!params.totalCents || params.totalCents <= 0) {
    return { issued: false, reason: "not_billable" };
  }

  if (!params.force && !(await isSendingEnabled())) {
    return { issued: false, reason: "disabled" };
  }

  const supplier = await getBillingProfile();
  if (!isBillingProfileComplete(supplier)) {
    return { issued: false, reason: "profile_incomplete" };
  }

  const paidAt = params.paidAt ?? new Date();
  const year = Number(
    new Intl.DateTimeFormat("cs-CZ", {
      year: "numeric",
      timeZone: "Europe/Prague",
    }).format(paidAt),
  );
  const amounts = breakDownAmount(params.totalCents, supplier.vatRatePercent);

  /*
   * The number is taken and the document written in one transaction, so a
   * failed insert (another process issued this purchase's document a moment
   * earlier) gives the number back instead of leaving a gap in the series.
   */
  let row: Invoice | undefined;
  try {
    row = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(invoice)
        .values({
          number: formatDocumentNumber(year, await nextSequence(year, tx)),
          year,
          reservationId: params.reservationId,
          orderId: params.orderId ?? null,
          userId: params.userId,
          suppliedAt: paidAt,
          totalCents: amounts.totalCents,
          baseCents: amounts.baseCents,
          vatCents: amounts.vatCents,
          vatRatePercent: amounts.vatRatePercent,
          description:
            params.description ??
            `Jednorázový vstup do NAVI Private Gym, ${formatDateTime(
              params.startsAt,
            )}`,
          items: params.items ?? null,
          customerName: params.customerName,
          customerEmail: params.customerEmail,
          supplier,
        })
        .returning();
      return inserted;
    });
  } catch (error) {
    const raced =
      (params.orderId && (await getInvoiceForOrder(params.orderId))) ||
      (await getInvoiceForReservation(params.reservationId));
    if (raced)
      return { issued: false, reason: "already_issued", invoice: raced };
    throw error;
  }
  if (!row) throw new Error("invoice insert did not return a row");

  return { issued: true, invoice: row };
}

/**
 * The document for a confirmed reservation: its own, or, for a slot of a
 * multi-slot order, the one document of the whole order with a line per
 * slot. The order's document is filed under its first slot, so the older
 * one-document-per-reservation rule still holds.
 */
export async function issueDocumentFor(
  reservation: Reservation,
  options: { force?: boolean } = {},
): Promise<IssueOutcome> {
  const existing =
    (reservation.orderId
      ? await getInvoiceForOrder(reservation.orderId)
      : null) ?? (await getInvoiceForReservation(reservation.id));
  if (existing)
    return { issued: false, reason: "already_issued", invoice: existing };
  const issue = issueForReservation;
  const order = reservation.orderId
    ? await getOrder(reservation.orderId)
    : null;
  if ((order?.currency ?? reservation.currency).toLowerCase() !== "czk")
    return { issued: false, reason: "not_billable" };
  // The date of taxable supply is when the customer paid, not when the
  // document happens to be issued (a later manual issue, a New Year retry).
  const paidAt = await paidAtFor(
    order ? { orderId: order.id } : { reservationId: reservation.id },
    order?.totalCents ?? reservation.priceCents,
    order?.currency ?? reservation.currency,
  );
  if (!(order?.totalCents ?? reservation.priceCents))
    return { issued: false, reason: "not_billable" };
  if (
    !paidAt ||
    !["confirmed", "completed", "cancelled", "no_show"].includes(
      reservation.status,
    )
  )
    return { issued: false, reason: "not_paid" };
  const [profile] = reservation.userId
    ? await db
        .select({ email: profiles.email, name: profiles.fullName })
        .from(profiles)
        .where(eq(profiles.id, reservation.userId))
        .limit(1)
    : [];
  if (!order) {
    return issue({
      paidAt,
      reservationId: reservation.id,
      userId: reservation.userId ?? null,
      customerName: reservation.contactName ?? profile?.name ?? null,
      customerEmail: reservation.contactEmail ?? profile?.email ?? null,
      totalCents: reservation.priceCents,
      startsAt: reservation.startsAt,
      force: options.force,
    });
  }
  const slots = await listOrderReservations(order.id);
  const first = slots[0] ?? reservation;
  return issue({
    paidAt,
    reservationId: first.id,
    orderId: order.id,
    userId: order.userId ?? null,
    customerName: order.contactName ?? profile?.name ?? null,
    customerEmail: order.contactEmail ?? profile?.email ?? null,
    totalCents: order.totalCents,
    startsAt: first.startsAt,
    force: options.force,
    description:
      slots.length === 1
        ? undefined
        : `Vstupy do NAVI Private Gym (${slots.length}×)`,
    items:
      slots.length === 1
        ? undefined
        : slots.map((slot) => ({
            description: `Vstup ${formatDateTime(slot.startsAt)}${slot.loyaltyReward ? " (věrnostní vstup zdarma)" : ""}`,
            totalCents: slot.priceCents ?? 0,
          })),
  });
}

/** When the purchase's successful payment arrived, if it did. */
async function paidAtFor(
  target: { orderId: string } | { reservationId: string },
  amountCents: number | null,
  currency: string,
): Promise<Date | undefined> {
  if (!amountCents || amountCents <= 0) return undefined;
  const [row] = await db
    .select({ paidAt: payment.paidAt })
    .from(payment)
    .where(
      and(
        "orderId" in target
          ? eq(payment.orderId, target.orderId)
          : eq(payment.reservationId, target.reservationId),
        eq(payment.status, "succeeded"),
        isNotNull(payment.paidAt),
        gt(payment.amountCents, 0),
        eq(payment.amountCents, amountCents),
        sql`lower(${payment.currency}) = lower(${currency})`,
      ),
    )
    .orderBy(desc(payment.paidAt))
    .limit(1);
  return row?.paidAt ?? undefined;
}

// ── Rendering ───────────────────────────────────────────────────────────────

function toDocument(row: Invoice): InvoiceDocument {
  return {
    number: row.number,
    issuedAt: row.issuedAt,
    suppliedAt: row.suppliedAt,
    description: row.description,
    items: row.items ?? [],
    totalCents: row.totalCents,
    baseCents: row.baseCents,
    vatCents: row.vatCents,
    vatRatePercent: row.vatRatePercent,
    hasVat: row.vatRatePercent > 0,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    supplier: parseBillingProfile(row.supplier),
  };
}

export async function renderPdf(row: Invoice): Promise<Buffer> {
  return renderInvoicePdf(toDocument(row));
}

/** File name the customer sees on the attachment and on download. */
export function pdfFilename(row: Pick<Invoice, "number">): string {
  return `doklad-${row.number}.pdf`;
}

// ── Sending ─────────────────────────────────────────────────────────────────

export async function sendInvoiceEmail(
  row: Invoice,
  requestId: string,
): Promise<boolean> {
  const { sendInvoiceDocument } = await import("./invoice-delivery");
  const result = await sendInvoiceDocument(row, "customer", requestId);
  return result.failed.length === 0;
}

// ── Administration ──────────────────────────────────────────────────────────

export async function listInvoices(limit = 100): Promise<Invoice[]> {
  return db.select().from(invoice).orderBy(desc(invoice.issuedAt)).limit(limit);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const [row] = await db
    .select()
    .from(invoice)
    .where(eq(invoice.id, id))
    .limit(1);
  return row ?? null;
}

export async function listInvoicesForUser(userId: string): Promise<Invoice[]> {
  return db
    .select()
    .from(invoice)
    .where(eq(invoice.userId, userId))
    .orderBy(desc(invoice.issuedAt));
}
