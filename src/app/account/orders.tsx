import { Button } from "@/components/ui/button";
import {
  formatDate,
  formatTimeRange,
  formatMoney,
  formatStatus,
} from "@/lib/helpers/format";
import {
  listCustomerOrders,
  ORDER_PAGE_SIZE,
} from "@/lib/services/customer-orders";

const paymentLabels: Record<string, string> = {
  pending: "Čeká na platbu",
  succeeded: "Zaplaceno",
  processing: "Platba se zpracovává",
  failed: "Platba neproběhla",
  refunded: "Vráceno",
  cancelled: "Platba zrušena",
};
export async function Orders({
  userId,
  page,
  isDemo,
}: {
  userId: string;
  page: number;
  isDemo: boolean;
}) {
  const rows = isDemo ? [] : await listCustomerOrders(userId, page);
  const hasNext = rows.length > ORDER_PAGE_SIZE;
  return (
    <section aria-labelledby="orders-heading">
      <h2 id="orders-heading" className="text-2xl font-extrabold">
        Historie objednávek
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Všechny objednávky vytvořené pod vaším účtem, od nejnovější. Doklad
        stáhnete po jeho vystavení.
      </p>
      <div className="mt-6 grid gap-3">
        {rows.slice(0, ORDER_PAGE_SIZE).map((row) => (
          <article
            key={row.id}
            className="rounded-lg border border-border bg-card p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-extrabold">
                  {formatDate(row.startsAt)} ·{" "}
                  {formatTimeRange(row.startsAt, row.endsAt)}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Objednáno {formatDate(row.createdAt)}
                </p>
              </div>
              <p className="font-bold">
                {row.priceCents === null
                  ? "V ceně členství"
                  : formatMoney(row.priceCents, row.currency)}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              <span>
                {row.status === "confirmed" && row.endsAt < new Date()
                  ? "Proběhlá rezervace"
                  : formatStatus(row.status)}
              </span>
              <span className="font-bold">
                {row.paymentStatus
                  ? (paymentLabels[row.paymentStatus] ??
                    "Stav platby se ověřuje")
                  : row.priceCents === 0
                    ? "Bez platby"
                    : "Bez záznamu platby"}
              </span>
              {row.invoiceId ? (
                <Button
                  href={`/api/account/invoices/${row.invoiceId}`}
                  variant="outline"
                  size="sm"
                >
                  Stáhnout doklad {row.invoiceNumber}
                </Button>
              ) : null}
            </div>
          </article>
        ))}
        {!rows.length ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground">
            {page === 1
              ? "Zatím nemáte žádné objednávky."
              : "Na této stránce nejsou další objednávky."}
          </p>
        ) : null}
      </div>
      <nav
        aria-label="Stránkování objednávek"
        className="mt-6 flex flex-wrap items-center gap-4"
      >
        {page > 1 ? (
          <Button
            href={`/account?tab=orders&page=${page - 1}`}
            variant="outline"
          >
            Předchozí
          </Button>
        ) : null}
        <span className="text-sm">Strana {page}</span>
        {hasNext ? (
          <Button
            href={`/account?tab=orders&page=${page + 1}`}
            variant="outline"
          >
            Další
          </Button>
        ) : null}
      </nav>
    </section>
  );
}
