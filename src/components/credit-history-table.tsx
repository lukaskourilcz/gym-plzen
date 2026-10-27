import Link from "next/link";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";

export interface CreditHistoryEntry {
  id: string;
  createdAt: Date;
  reason: string;
  amountCents: number;
  reservationId?: string | null;
  actorName?: string;
  operationKey?: string;
}

export function CreditHistoryTable({
  entries,
  admin = false,
}: {
  entries: readonly CreditHistoryEntry[];
  admin?: boolean;
}) {
  return (
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
          {entries.map((entry) => (
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
                  {entry.operationKey?.startsWith("claim-in:") ? (
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
      {!entries.length ? (
        <p className="py-3 text-muted-foreground">
          Zatím žádné kreditní pohyby.
        </p>
      ) : null}
    </div>
  );
}
