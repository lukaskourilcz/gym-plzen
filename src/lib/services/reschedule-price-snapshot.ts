import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { participantAddition, voucherRedemption } from "@/lib/db/schema";
import type { Reservation } from "@/lib/db/types";
import type { ReservationPriceSnapshot } from "@/lib/config/credits";
import { ActionError } from "@/lib/helpers/action";

/** Read-only reconstruction on an explicit move request, never a backfill.
 * Historical prices must not be guessed from today's mutable settings.
 */
export async function getReschedulePriceSnapshot(
  current: Reservation,
): Promise<ReservationPriceSnapshot> {
  if (current.priceSnapshot) return current.priceSnapshot;
  const unavailable = () =>
    new ActionError(
      "Historickou cenu této rezervace musí před změnou ověřit obsluha. Původní termín a vstupní kód zůstávají platné.",
    );
  if (current.pricingVersion >= 2 || current.priceCents === null)
    throw unavailable();
  const [redemptions, additions] = await Promise.all([
    db
      .select({ id: voucherRedemption.id })
      .from(voucherRedemption)
      .where(
        and(
          eq(voucherRedemption.status, "redeemed"),
          current.orderId
            ? or(
                eq(voucherRedemption.reservationId, current.id),
                eq(voucherRedemption.orderId, current.orderId),
              )
            : eq(voucherRedemption.reservationId, current.id),
        ),
      )
      .limit(1),
    db
      .select({ fromCount: participantAddition.fromCount })
      .from(participantAddition)
      .where(
        and(
          eq(participantAddition.reservationId, current.id),
          eq(participantAddition.status, "confirmed"),
        ),
      ),
  ]);
  const initialPeople = additions.reduce(
    (count, addition) => Math.min(count, addition.fromCount),
    current.extraPeople,
  );
  // Old rows did not snapshot the original voucher terms or companion tariff.
  // Refuse an unverifiable quote rather than silently keeping or guessing it.
  if (
    redemptions.length ||
    initialPeople > 0 ||
    (!current.priceCents && !current.loyaltyReward)
  )
    throw unavailable();
  return {
    baseCents: current.priceCents,
    purchasePriceCents: current.priceCents,
    purchasedStartsAt: current.startsAt.toISOString(),
    purchaseCreditCents: current.creditPaidCents,
    companionCents: 0,
    reward: Boolean(current.loyaltyReward),
    discount: null,
  };
}
