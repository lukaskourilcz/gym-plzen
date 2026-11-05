import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditEntry, reservationChange } from "@/lib/db/schema";
import { CREDIT_HISTORY_PAGE_SIZE } from "@/lib/config/credits";
import { getCreditWallet } from "./credits";

/** Admin action authorizes before this bounded, read-only history lookup. */
export async function adminCreditHistory(userId: string, page: number) {
  const wallet = await getCreditWallet(userId, page);
  const [totals, changes] = await Promise.all([
    wallet.accountId
      ? db
          .select({ total: count() })
          .from(creditEntry)
          .where(eq(creditEntry.accountId, wallet.accountId))
      : Promise.resolve([{ total: 0 }]),
    db
      .select({
        id: reservationChange.id,
        updatedAt: reservationChange.updatedAt,
      })
      .from(reservationChange)
      .where(
        and(
          eq(reservationChange.userId, userId),
          eq(reservationChange.status, "completed"),
        ),
      )
      .orderBy(desc(reservationChange.createdAt))
      .limit(20),
  ]);
  return {
    entries: wallet.entries,
    totalPages: Math.max(
      1,
      Math.ceil((totals[0]?.total ?? 0) / CREDIT_HISTORY_PAGE_SIZE),
    ),
    changes,
  };
}
