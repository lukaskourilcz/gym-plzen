import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { voucher, voucherRedemption } from "@/lib/db/schema";
import type { Voucher } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";

const CHECKOUT_HOLD_MS = 35 * 60 * 1000;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export interface VoucherQuote {
  code: string;
  kind: Voucher["kind"];
  value: number;
  originalPriceCents: number;
  discountCents: number;
  finalPriceCents: number;
}

export interface VoucherOverview extends Voucher {
  redeemedCount: number;
  reservedCount: number;
}

export function normalizeVoucherCode(code: string): string {
  return code.trim().replace(/\s+/g, "").toUpperCase();
}

export function generateVoucherCode(): string {
  const bytes = randomBytes(10);
  let value = "NAVI-";
  for (let index = 0; index < 8; index += 1) {
    value += CODE_ALPHABET[bytes[index]! % CODE_ALPHABET.length];
  }
  return value;
}

export function calculateVoucherQuote(
  row: Pick<Voucher, "code" | "kind" | "value">,
  originalPriceCents: number,
): VoucherQuote {
  const requestedDiscount =
    row.kind === "percentage"
      ? Math.round((originalPriceCents * row.value) / 100)
      : row.value;
  const discountCents = Math.min(originalPriceCents, requestedDiscount);
  const finalPriceCents = Math.max(0, originalPriceCents - discountCents);

  return {
    code: row.code,
    kind: row.kind,
    value: row.value,
    originalPriceCents,
    discountCents,
    finalPriceCents,
  };
}

function assertUsable(row: Voucher | undefined, now: Date): Voucher {
  if (
    !row ||
    !row.isActive ||
    (row.validFrom && row.validFrom > now) ||
    (row.validUntil && row.validUntil <= now)
  ) {
    throw new ActionError("Voucher není platný nebo už není aktivní.");
  }
  return row;
}

async function releaseExpiredClaims(now: Date) {
  await db
    .update(voucherRedemption)
    .set({ status: "released", releasedAt: now, updatedAt: now })
    .where(
      and(
        eq(voucherRedemption.status, "reserved"),
        lt(voucherRedemption.reservedUntil, now),
      ),
    );
}

async function activeClaimCount(voucherId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(voucherRedemption)
    .where(
      and(
        eq(voucherRedemption.voucherId, voucherId),
        inArray(voucherRedemption.status, ["reserved", "redeemed"]),
      ),
    );
  return Number(row?.value ?? 0);
}

/** Read-only public quote. The claim is made again atomically during booking. */
export async function quoteVoucher(
  rawCode: string,
  originalPriceCents: number,
): Promise<VoucherQuote> {
  const code = normalizeVoucherCode(rawCode);
  if (!code) throw new ActionError("Zadejte kód voucheru.");
  const now = new Date();
  await releaseExpiredClaims(now);
  const [candidate] = await db
    .select()
    .from(voucher)
    .where(sql`upper(${voucher.code}) = ${code}`)
    .limit(1);
  const usable = assertUsable(candidate, now);
  if (
    usable.maxRedemptions != null &&
    (await activeClaimCount(usable.id)) >= usable.maxRedemptions
  ) {
    throw new ActionError("Limit použití tohoto voucheru byl vyčerpán.");
  }
  return calculateVoucherQuote(usable, originalPriceCents);
}

/**
 * Reserve one use under a row lock so a limited voucher cannot oversell. An
 * order claims once for all of its slots: the price is the order's total and
 * the claim points at the order's first paid reservation.
 */
export async function claimVoucher(params: {
  code: string;
  reservationId: string;
  orderId?: string;
  originalPriceCents: number;
  reservedUntil?: Date;
}): Promise<VoucherQuote & { voucherId: string }> {
  const code = normalizeVoucherCode(params.code);
  return db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .update(voucherRedemption)
      .set({ status: "released", releasedAt: now, updatedAt: now })
      .where(
        and(
          eq(voucherRedemption.status, "reserved"),
          lt(voucherRedemption.reservedUntil, now),
        ),
      );
    const [candidate] = await tx
      .select()
      .from(voucher)
      .where(sql`upper(${voucher.code}) = ${code}`)
      .limit(1)
      .for("update");
    const usable = assertUsable(candidate, now);
    const [claims] = await tx
      .select({ value: count() })
      .from(voucherRedemption)
      .where(
        and(
          eq(voucherRedemption.voucherId, usable.id),
          inArray(voucherRedemption.status, ["reserved", "redeemed"]),
        ),
      );
    if (
      usable.maxRedemptions != null &&
      Number(claims?.value ?? 0) >= usable.maxRedemptions
    ) {
      throw new ActionError("Limit použití tohoto voucheru byl vyčerpán.");
    }

    const quote = calculateVoucherQuote(usable, params.originalPriceCents);
    await tx.insert(voucherRedemption).values({
      voucherId: usable.id,
      reservationId: params.reservationId,
      orderId: params.orderId ?? null,
      originalPriceCents: quote.originalPriceCents,
      discountCents: quote.discountCents,
      finalPriceCents: quote.finalPriceCents,
      reservedUntil:
        params.reservedUntil ?? new Date(now.getTime() + CHECKOUT_HOLD_MS),
    });
    return { ...quote, voucherId: usable.id };
  });
}

export async function redeemForReservation(
  reservationId: string,
  executor: DatabaseExecutor = db,
) {
  const now = new Date();
  await executor
    .update(voucherRedemption)
    .set({ status: "redeemed", redeemedAt: now, updatedAt: now })
    .where(
      and(
        eq(voucherRedemption.reservationId, reservationId),
        eq(voucherRedemption.status, "reserved"),
      ),
    );
}

export async function releaseForReservation(
  reservationId: string,
  executor: DatabaseExecutor = db,
) {
  const now = new Date();
  await executor
    .update(voucherRedemption)
    .set({ status: "released", releasedAt: now, updatedAt: now })
    .where(
      and(
        eq(voucherRedemption.reservationId, reservationId),
        eq(voucherRedemption.status, "reserved"),
      ),
    );
}

/** Consume an order's claim, together with the order's confirmation. */
export async function redeemForOrder(
  orderId: string,
  executor: DatabaseExecutor = db,
) {
  const now = new Date();
  await executor
    .update(voucherRedemption)
    .set({ status: "redeemed", redeemedAt: now, updatedAt: now })
    .where(
      and(
        eq(voucherRedemption.orderId, orderId),
        eq(voucherRedemption.status, "reserved"),
      ),
    );
}

/** Give an unpaid order's claim back to the voucher. */
export async function releaseForOrder(
  orderId: string,
  executor: DatabaseExecutor = db,
) {
  const now = new Date();
  await executor
    .update(voucherRedemption)
    .set({ status: "released", releasedAt: now, updatedAt: now })
    .where(
      and(
        eq(voucherRedemption.orderId, orderId),
        eq(voucherRedemption.status, "reserved"),
      ),
    );
}

export async function hasRedeemedForReservation(
  reservationId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: voucherRedemption.id })
    .from(voucherRedemption)
    .where(
      and(
        eq(voucherRedemption.reservationId, reservationId),
        eq(voucherRedemption.status, "redeemed"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function createVoucher(input: {
  code?: string;
  kind: Voucher["kind"];
  value: number;
  maxRedemptions?: number | null;
  validFrom?: Date | null;
  validUntil?: Date | null;
  createdByAdminId: string;
}): Promise<Voucher> {
  const code = normalizeVoucherCode(input.code || generateVoucherCode());
  try {
    const [created] = await db
      .insert(voucher)
      .values({
        code,
        kind: input.kind,
        value: input.value,
        maxRedemptions: input.maxRedemptions ?? null,
        validFrom: input.validFrom ?? null,
        validUntil: input.validUntil ?? null,
        createdByAdminId: input.createdByAdminId,
      })
      .returning();
    return created!;
  } catch (error) {
    if (String(error).includes("voucher_code_normalized_uidx")) {
      throw new ActionError("Voucher s tímto kódem už existuje.");
    }
    throw error;
  }
}

export async function setVoucherActive(id: string, isActive: boolean) {
  const [updated] = await db
    .update(voucher)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(voucher.id, id))
    .returning();
  if (!updated) throw new ActionError("Voucher nebyl nalezen.");
  return updated;
}

export async function listVouchers(): Promise<VoucherOverview[]> {
  const now = new Date();
  await releaseExpiredClaims(now);
  const rows = await db
    .select({
      voucher,
      redeemedCount: count(
        sql`case when ${voucherRedemption.status} = 'redeemed' then 1 end`,
      ),
      reservedCount: count(
        sql`case when ${voucherRedemption.status} = 'reserved' then 1 end`,
      ),
    })
    .from(voucher)
    .leftJoin(voucherRedemption, eq(voucherRedemption.voucherId, voucher.id))
    .groupBy(voucher.id)
    .orderBy(desc(voucher.createdAt), asc(voucher.code));

  return rows.map((row) => ({
    ...row.voucher,
    redeemedCount: Number(row.redeemedCount),
    reservedCount: Number(row.reservedCount),
  }));
}
