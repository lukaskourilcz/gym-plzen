"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
import { CreditHistoryTable } from "@/components/credit-history-table";
import { readCreditHistoryAction } from "@/app/admin/credits/actions";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import { AdminDialog } from "./dialog";
import { CreditEditor } from "./credit-editor";
import { IconButton } from "./ui/icon-button";
import { Button } from "./ui/button";
import { DialogPagination } from "./ui/pagination";

export function AdminCreditWallet({
  userId,
  balance,
  reserved,
}: {
  userId: string;
  balance: number;
  reserved: number;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <section
      aria-label="Kreditní peněženka"
      className="mb-4 rounded-lg border border-border bg-card px-5 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2">
          <h2 className="!text-sm !font-normal text-muted-foreground">
            Kredity zákazníka:
          </h2>
          <span className="font-medium tabular-nums">
            {formatMoney(balance - reserved)}
          </span>
          <IconButton
            icon={History}
            aria-label="Historie kreditů"
            aria-haspopup="dialog"
            onClick={() => setHistoryOpen(true)}
          />
          {reserved > 0 && (
            <span className="text-xs text-muted-foreground">
              V rozpracovaných platbách: {formatMoney(reserved)}
            </span>
          )}
        </div>
        <CreditEditor userId={userId} balance={balance} reserved={reserved} />
      </div>
      {historyOpen && (
        <CreditHistoryDialog
          userId={userId}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </section>
  );
}

type HistoryResult = Extract<
  Awaited<ReturnType<typeof readCreditHistoryAction>>,
  { ok: true }
>["data"];
function CreditHistoryDialog({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    readCreditHistoryAction({ userId, page })
      .then((result) => {
        if (!current) return;
        if (result.ok) {
          setHistory(result.data);
          setError(null);
        } else setError(result.error);
        setLoading(false);
      })
      .catch(() => {
        if (current) {
          setError("Historii se nepodařilo načíst.");
          setLoading(false);
        }
      });
    return () => {
      current = false;
    };
  }, [userId, page, retry]);
  return (
    <AdminDialog title="Historie kreditů" onClose={onClose}>
      <div aria-busy={loading} className="mt-3 [&_td:last-child]:font-medium">
        {loading ? (
          <p role="status" className="py-4 text-sm text-muted-foreground">
            Načítám historii…
          </p>
        ) : error ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLoading(true);
                setRetry((n) => n + 1);
              }}
            >
              Zkusit znovu
            </Button>
          </div>
        ) : history ? (
          <CreditHistoryTable entries={history.entries} admin />
        ) : null}
        {history && history.totalPages > 1 && (
          <fieldset disabled={loading} className="min-w-0 border-0 p-0">
            <DialogPagination
              aria-label="Stránkování historie kreditů"
              page={page}
              totalPages={history.totalPages}
              onChange={(next) => {
                setLoading(true);
                setPage(next);
              }}
            />
          </fieldset>
        )}
        {history?.changes.length ? (
          <details className="mt-5 border-t border-border pt-4">
            <summary className="cursor-pointer text-sm font-medium">
              Vyúčtování změn termínů
            </summary>
            <ul className="mt-3 space-y-2 text-sm">
              {history.changes.map((change) => (
                <li key={change.id}>
                  <Link
                    target="_blank"
                    className="underline"
                    href={`/account/kredity/zmeny/${change.id}`}
                  >
                    {formatDateTime(change.updatedAt)} · stáhnout vyúčtování
                    (PDF)
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </AdminDialog>
  );
}
