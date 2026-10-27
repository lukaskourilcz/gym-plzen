import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservationChange } from "@/lib/db/schema";
import Link from "next/link";
import { getCreditWallet } from "@/lib/services/credits";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import { CreditEditor } from "@/components/admin/credit-editor";
export async function CreditWalletPanel({
  userId,
  admin = false,
}: {
  userId: string;
  admin?: boolean;
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
  return (
    <section
      aria-label="Kreditní peněženka"
      className="my-6 rounded-lg border border-border bg-card p-5 sm:p-6"
    >
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
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-bold">
          Historie kreditů
        </summary>
        <div
          role="region"
          tabIndex={0}
          aria-label="Historie kreditních pohybů"
          className="mt-3 overflow-x-auto focus-visible:outline-2 focus-visible:outline-primary"
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Datum</th>
                <th>Důvod</th>
                {admin ? <th>Provedl</th> : null}
                <th className="text-right">Částka</th>
              </tr>
            </thead>
            <tbody>
              {wallet.entries.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="whitespace-nowrap py-3 pr-4">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="pr-4">
                    {entry.reason}
                    {entry.reservationId ? (
                      <Link
                        href={
                          admin
                            ? `/admin/reservations?query=${entry.reservationId}`
                            : "/account"
                        }
                        className="ml-2 underline"
                      >
                        Rezervace
                      </Link>
                    ) : null}
                  </td>
                  {admin ? (
                    <td className="pr-4">
                      {entry.actorName}
                      {entry.operationKey.startsWith("claim-in:") ? (
                        <Link
                          className="ml-2 underline"
                          href={`/admin/credits/${entry.operationKey.split(":")[1]}`}
                        >
                          Historie před registrací
                        </Link>
                      ) : null}
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap text-right font-bold">
                    {entry.amountCents > 0 ? "+" : ""}
                    {formatMoney(entry.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!wallet.entries.length ? (
            <p className="py-3 text-muted-foreground">
              Zatím žádné kreditní pohyby.
            </p>
          ) : null}
        </div>
      </details>
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
