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
  const wallet = await getCreditWallet(userId);
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
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Datum</th>
                <th>Důvod</th>
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
    </section>
  );
}
