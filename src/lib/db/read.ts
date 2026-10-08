import { sql } from "drizzle-orm";
import { db, type Transaction } from "@/lib/db";
import { retryRead } from "@/lib/helpers/read-retry";

/**
 * Short, read-only transactions for public-page data and delivery checks.
 * SET LOCAL works with the transaction pooler and cannot leak to another
 * request. PostgreSQL enforces read-only so a retry cannot repeat a write.
 * Do not call providers or perform other side effects inside the callback.
 */
export function readDatabase<T>(
  read: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return retryRead(() =>
    db.transaction(
      async (tx) => {
        await tx.execute(sql`set local statement_timeout = '5s'`);
        await tx.execute(sql`set local lock_timeout = '2s'`);
        return read(tx);
      },
      { accessMode: "read only" },
    ),
  );
}
