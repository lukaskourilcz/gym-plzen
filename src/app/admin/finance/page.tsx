import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { hasDemoAdminSession } from "@/lib/auth/demo";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/helpers/format";
import {
  parseFinancePeriod,
  type FinancePeriod,
} from "@/lib/helpers/finance-period";
import { getFinanceOverview } from "@/lib/services/finance";

export const metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

const FILTERS: { period: FinancePeriod; label: string }[] = [
  { period: "7d", label: "Posledních 7 dní" },
  { period: "30d", label: "Posledních 30 dní" },
  { period: "all", label: "Celkem" },
];

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const { period: requested } = await searchParams;
  const period = parseFinancePeriod(requested);
  const demo = await hasDemoAdminSession();
  const overview = demo ? null : await getFinanceOverview(period);

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Přijaté platby, vouchery a storna rezervací"
      />
      <nav aria-label="Období financí" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.period}
            href={`/admin/finance?period=${filter.period}`}
            aria-current={period === filter.period ? "page" : undefined}
            className={`rounded-md border px-4 py-2 text-sm font-semibold ${period === filter.period ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>
      <p className="mb-6 text-sm text-muted-foreground">
        {overview?.since
          ? `Od ${formatDate(overview.since)} včetně, podle data přijetí platby, uplatnění voucheru nebo storna.`
          : "Za celé období evidence."}{" "}
        Částky jsou v Kč. Platba za více termínů se počítá jen jednou.
      </p>
      {demo ? (
        <p className="rounded-lg border border-border p-5 text-sm">
          Ukázkový režim nezobrazuje skutečné finanční údaje.
        </p>
      ) : overview ? (
        <>
          <section aria-labelledby="finance-receipts" className="mb-8">
            <h2 id="finance-receipts" className="mb-3 text-xl font-bold">
              Přijaté platby za rezervace
            </h2>
            <div className="flex flex-wrap gap-4">
              <StatCard
                label="Přijato celkem"
                value={formatMoney(overview.receipts.grossCents)}
              />
              <StatCard
                label="Počet přijatých plateb"
                value={overview.receipts.count}
              />
              <StatCard
                label="Vrátilo se podle stavu platby"
                value={formatMoney(overview.receipts.refundedCents)}
              />
              <StatCard
                label="Zůstává po potvrzených vratkách"
                value={formatMoney(
                  overview.receipts.grossCents -
                    overview.receipts.refundedCents,
                )}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Součet vychází ze skutečně dokončených jednorázových plateb, ne z
              cen v rezervacích. Členství a rezervace zdarma se nezapočítávají.
              Vrácené platby jsou vedené zvlášť (
              {overview.receipts.refundedCount}).
            </p>
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <h2 className="text-xl font-bold">Vouchery</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      Uplatněné vouchery
                    </dt>
                    <dd className="mt-1 text-2xl font-bold">
                      {overview.vouchers.count}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      Úspora zákazníků
                    </dt>
                    <dd className="mt-1 text-2xl font-bold">
                      {formatMoney(overview.vouchers.discountCents)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm text-muted-foreground">
                  Úspora je hodnota slev, ne peníze přijaté posilovnou. Vrácené
                  a zatím pouze rezervované vouchery se nepočítají.
                </p>
                <Link
                  href="/admin/vouchers"
                  className="mt-3 inline-block text-sm text-accent-foreground hover:underline"
                >
                  Správa voucherů →
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <h2 className="text-xl font-bold">Storna a vratky k ověření</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      Zrušené rezervace
                    </dt>
                    <dd className="mt-1 text-2xl font-bold">
                      {overview.cancellations.count}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      Případy k ověření vratky
                    </dt>
                    <dd className="mt-1 text-2xl font-bold">
                      {overview.refundAlerts.count}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      Částka případů
                    </dt>
                    <dd className="mt-1 text-2xl font-bold">
                      {formatMoney(overview.refundAlerts.amountCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      Stále otevřené
                    </dt>
                    <dd className="mt-1 text-2xl font-bold">
                      {overview.refundAlerts.openCount} ·{" "}
                      {formatMoney(overview.refundAlerts.openAmountCents)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm text-muted-foreground">
                  Storno samo peníze nevrací. „Vyřešeno“ u upozornění
                  neprokazuje vrácení peněz v Comgate; tyto částky proto
                  automaticky neodečítáme od příjmů.
                </p>
                <Link
                  href="/admin/alerts"
                  className="mt-3 inline-block text-sm text-accent-foreground hover:underline"
                >
                  Zkontrolovat upozornění →
                </Link>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
