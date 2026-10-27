import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservationChange } from "@/lib/db/schema";
import Link from "next/link";
import { getCreditWallet } from "@/lib/services/credits";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import { CreditHistoryTable } from "./credit-history-table";
import { CreditEditor } from "@/components/admin/credit-editor";
export async function CreditWalletPanel({
  userId,
  admin = false,
  historyOnly = false,
}: {
  userId: string;
  admin?: boolean;
  historyOnly?: boolean;
}) {
  const [wallet, changes] = await Promise.all([
    getCreditWallet(userId),
    db
      .select()
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
  const history = <CreditHistoryTable entries={wallet.entries} admin={admin} />;
  return (
    <section
      aria-label={historyOnly ? "Historie kreditů" : "Kreditní peněženka"}
      className="my-6 rounded-lg border border-border bg-card p-5 sm:p-6"
    >
      {historyOnly ? (
        <h2 className="text-xl font-bold">Historie kreditů</h2>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                {admin ? "Kredity zákazníka" : "Tvoje kredity"}
              </h2>
              <p className="mt-2 text-3xl font-bold tabular-nums">
                {formatMoney(wallet.availableCents)}
              </p>
            </div>
            {admin ? (
              <CreditEditor
                userId={userId}
                balance={wallet.balanceCents}
                reserved={wallet.reservedCents}
              />
            ) : null}
          </div>
          {wallet.reservedCents > 0 ? (
            <p className="mt-2 text-sm">
              V rozpracovaných platbách: {formatMoney(wallet.reservedCents)}.
            </p>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">
            Kredity můžeš použít při další rezervaci nebo doplatku. Nemají
            nastavenou expiraci.
          </p>
        </>
      )}
      {historyOnly ? (
        history
      ) : (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-bold">
            Historie kreditů
          </summary>
          {history}
        </details>
      )}
      {changes.length ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-bold">
            Vyúčtování změn termínů
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {changes.map((change) => (
              <li key={change.id}>
                <Link
                  target="_blank"
                  className="underline"
                  href={`/account/kredity/zmeny/${change.id}`}
                >
                  {formatDateTime(change.updatedAt)} · stáhnout vyúčtování (PDF)
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
