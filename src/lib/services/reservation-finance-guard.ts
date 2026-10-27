import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { participantAddition, reservationChange } from "@/lib/db/schema";
import { ActionError } from "@/lib/helpers/action";
export async function assertNoOpenChange(reservationId: string) {
  const [change] = await db
    .select({ id: reservationChange.id })
    .from(reservationChange)
    .where(
      and(
        eq(reservationChange.reservationId, reservationId),
        inArray(reservationChange.status, [
          "awaiting_payment",
          "applying",
          "review_needed",
          "refund_pending",
        ]),
      ),
    );
  if (change)
    throw new ActionError(
      "Nejdříve dokončete probíhající změnu termínu nebo vyřešte její doplatek s obsluhou. Původní rezervace zůstává platná.",
    );
}
export async function assertNoPendingCompanions(reservationId: string) {
  const [addition] = await db
    .select({ id: participantAddition.id })
    .from(participantAddition)
    .where(
      and(
        eq(participantAddition.reservationId, reservationId),
        eq(participantAddition.status, "pending"),
      ),
    );
  if (addition)
    throw new ActionError(
      "Nejdříve dokončete rozpracovanou platbu za doprovod.",
    );
}
