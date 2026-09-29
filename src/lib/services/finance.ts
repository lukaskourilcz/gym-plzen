import { and, eq, gte, inArray, isNotNull, like, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  payment,
  reservation,
  systemAlert,
  voucherRedemption,
} from "@/lib/db/schema";
import {
  financePeriodStart,
  type FinancePeriod,
} from "@/lib/helpers/finance-period";

/** Money is counted once per captured payment, never once per booked slot. */
export async function getFinanceOverview(
  period: FinancePeriod,
  now = new Date(),
) {
  const start = financePeriodStart(period, now);
  const [receipts, vouchers, cancellations, refundAlerts] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        grossCents:
          sql<number>`coalesce(sum(${payment.amountCents}), 0)`.mapWith(Number),
        refundedCount:
          sql<number>`count(*) filter (where ${payment.status} = 'refunded')`.mapWith(
            Number,
          ),
        refundedCents:
          sql<number>`coalesce(sum(${payment.amountCents}) filter (where ${payment.status} = 'refunded'), 0)`.mapWith(
            Number,
          ),
      })
      .from(payment)
      .where(
        and(
          eq(payment.type, "one_off"),
          inArray(payment.status, ["succeeded", "refunded"]),
          isNotNull(payment.paidAt),
          start ? gte(payment.paidAt, start) : undefined,
        ),
      ),
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        discountCents:
          sql<number>`coalesce(sum(${voucherRedemption.discountCents}), 0)`.mapWith(
            Number,
          ),
      })
      .from(voucherRedemption)
      .where(
        and(
          eq(voucherRedemption.status, "redeemed"),
          start ? gte(voucherRedemption.redeemedAt, start) : undefined,
        ),
      ),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(reservation)
      .where(
        and(
          eq(reservation.status, "cancelled"),
          start ? gte(reservation.cancelledAt, start) : undefined,
        ),
      ),
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        amountCents:
          sql<number>`coalesce(sum(case when jsonb_typeof(${systemAlert.context}->'amountCents') = 'number' then (${systemAlert.context}->>'amountCents')::numeric else 0 end), 0)`.mapWith(
            Number,
          ),
        openCount:
          sql<number>`count(*) filter (where ${systemAlert.resolvedAt} is null)`.mapWith(
            Number,
          ),
        openAmountCents:
          sql<number>`coalesce(sum(case when ${systemAlert.resolvedAt} is null and jsonb_typeof(${systemAlert.context}->'amountCents') = 'number' then (${systemAlert.context}->>'amountCents')::numeric else 0 end), 0)`.mapWith(
            Number,
          ),
      })
      .from(systemAlert)
      .where(
        and(
          like(systemAlert.dedupeKey, "refund-needed:%"),
          start ? gte(systemAlert.createdAt, start) : undefined,
        ),
      ),
  ]);

  const paid = receipts[0]!;
  return {
    period,
    since: start,
    receipts: paid,
    vouchers: vouchers[0]!,
    cancellations: cancellations[0]!,
    refundAlerts: refundAlerts[0]!,
  };
}
