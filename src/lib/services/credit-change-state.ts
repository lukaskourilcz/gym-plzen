import { and, eq } from "drizzle-orm";
import type { DatabaseExecutor } from "@/lib/db";
import { creditAccount, blockedSlot, reservationChange } from "@/lib/db/schema";
import type { Reservation } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";
import {
  assertCreditFundingIn,
  creditAccountForUser,
  finishCreditIn,
  postCreditIn,
} from "./credits";

/** Financial settlement belongs to the same transaction as the actual move. */
export async function settleReservationChangeIn(
  tx: DatabaseExecutor,
  id: string,
  current: Reservation,
) {
  const [change] = await tx
    .select()
    .from(reservationChange)
    .where(
      and(
        eq(reservationChange.id, id),
        eq(reservationChange.status, "applying"),
      ),
    )
    .for("update");
  if (
    !change ||
    change.reservationId !== current.id ||
    change.previousPriceCents !== current.priceCents ||
    change.previousStartsAt.getTime() !== current.startsAt.getTime()
  )
    throw new ActionError("Podklady změny rezervace už nejsou aktuální.");
  const delta = change.newPriceCents - change.previousPriceCents;
  await assertCreditFundingIn(
    tx,
    `change:${id}`,
    change.creditCents,
    change.userId,
  );
  await finishCreditIn(tx, `change:${id}`, true, current.id);
  if (delta < 0) {
    const account = await creditAccountForUser(change.userId, tx);
    await postCreditIn(tx, {
      accountId: account.id,
      amountCents: -delta,
      reason: "Rozdíl ceny při změně na levnější termín",
      key: `change-refund:${id}`,
      reservationId: current.id,
    });
  }
  const account = await creditAccountForUser(change.userId, tx);
  const [balance] = await tx
    .select()
    .from(creditAccount)
    .where(eq(creditAccount.id, account.id));
  await tx
    .update(reservationChange)
    .set({
      status: "completed",
      blockId: null,
      quote: {
        ...change.quote,
        creditBalanceCents: balance!.balanceCents,
        customerName: current.contactName ?? "",
        customerEmail: current.contactEmail ?? "",
        additionalPeoplePaidCents: current.additionalPeoplePaidCents,
      },
      updatedAt: new Date(),
    })
    .where(eq(reservationChange.id, id));
  if (change.blockId)
    await tx.delete(blockedSlot).where(eq(blockedSlot.id, change.blockId));
  return {
    priceCents: change.newPriceCents,
    // Only the successfully confirmed move stores reconstructed purchase
    // evidence, needed for later refunds. Original accepted terms stay intact.
    priceSnapshot: current.priceSnapshot ?? change.quote.priceSnapshot ?? null,
    creditPaidCents: Math.min(
      change.newPriceCents,
      current.creditPaidCents + change.creditCents,
    ),
  };
}
