import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { splitPage } from "@/lib/helpers/pagination";
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
/** A past confirmed slot reads as done rather than as still "potvrzená". */
function slotStatus(slot: { status: string; endsAt: Date }): string {
  return slot.status === "confirmed" && slot.endsAt < new Date()
    ? "Proběhlá rezervace"
    : formatStatus(slot.status);
}

export async function Orders({
  userId,
  page,
  isDemo,
}: {
  userId: string;
  page: number;
  isDemo: boolean;
}) {
  const { rows, hasNext } = splitPage(
    isDemo ? [] : await listCustomerOrders(userId, page),
    ORDER_PAGE_SIZE,
  );
  return (
    <section aria-labelledby="orders-heading">
      <h2 id="orders-heading" className="text-2xl font-extrabold">
        Historie objednávek
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Všechny objednávky vytvořené pod vaším účtem, od nejnovější. Termíny
        zaplacené najednou jsou v jedné objednávce s jedním dokladem, který
        stáhnete po jeho vystavení.
      </p>
      <div className="mt-6 grid gap-3">
        {rows.map((row) => {
          const many = row.slots.length > 1;
          const first = row.slots[0];
          return (
            <article
              key={row.id}
              className="rounded-lg border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-extrabold">
                    {many
                      ? `Objednávka ${row.slots.length} termínů`
                      : first
                        ? `${formatDate(first.startsAt)} · ${formatTimeRange(first.startsAt, first.endsAt)}`
                        : "Objednávka"}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Objednáno {formatDate(row.createdAt)}
                  </p>
                </div>
                <p className="font-bold">
                  {row.totalCents === null
                    ? "V ceně členství"
                    : formatMoney(row.totalCents, row.currency)}
                </p>
              </div>
              {many ? (
                <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
                  {row.slots.map((slot) => (
                    <li
                      key={slot.id}
                      className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2"
                    >
                      <span className="font-bold">
                        {formatDate(slot.startsAt)} ·{" "}
                        {formatTimeRange(slot.startsAt, slot.endsAt)}
                      </span>
                      <span className="text-muted-foreground">
                        {slotStatus(slot)} ·{" "}
                        {slot.priceCents === 0
                          ? slot.loyaltyReward
                            ? "zdarma, věrnost"
                            : "zdarma"
                          : slot.priceCents === null
                            ? "v ceně členství"
                            : formatMoney(slot.priceCents, row.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                {!many && first ? <span>{slotStatus(first)}</span> : null}
                <span className="font-bold">
                  {row.paymentStatus
                    ? (paymentLabels[row.paymentStatus] ??
                      "Stav platby se ověřuje")
                    : row.totalCents === 0
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
          );
        })}
        {!rows.length ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground">
            {page === 1
              ? "Zatím nemáte žádné objednávky."
              : "Na této stránce nejsou další objednávky."}
          </p>
        ) : null}
      </div>
      <Pagination
        page={page}
        hasNext={hasNext}
        hrefForPage={(next) => `/account?tab=orders&page=${next}`}
        label="Stránkování objednávek"
      />
    </section>
  );
}
