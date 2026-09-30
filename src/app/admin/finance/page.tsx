import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { hasDemoAdminSession } from "@/lib/auth/demo";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/helpers/format";
import {
  parseFinancePeriod,
  parseFinanceView,
  type FinancePeriod,
  type FinanceView,
} from "@/lib/helpers/finance-period";
import { getFinanceOverview } from "@/lib/services/finance";

export const metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

const FILTERS: { period: FinancePeriod; label: string }[] = [
  { period: "7d", label: "Posledních 7 dní" },
  { period: "30d", label: "Posledních 30 dní" },
  { period: "all", label: "Celkem" },
];
const VIEWS: { view: FinanceView; label: string }[] = [
  { view: "cash", label: "Skutečně přijaté platby" },
  { view: "bookings", label: "Hodnota rezervací" },
];

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; view?: string }>;
}) {
  await requireAdmin();
  const { period: requestedPeriod, view: requestedView } = await searchParams;
  const period = parseFinancePeriod(requestedPeriod);
  const view = parseFinanceView(requestedView);
  const demo = await hasDemoAdminSession();
  const overview = demo ? null : await getFinanceOverview(period);

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Skutečné platby, hodnota rezervací a storna"
      />
      <nav aria-label="Pohled financí" className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map((option) => (
          <Link
            key={option.view}
            href={`/admin/finance?period=${period}&view=${option.view}`}
            aria-current={view === option.view ? "page" : undefined}
            className={`rounded-md border px-4 py-2 text-sm font-semibold ${view === option.view ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
          >
            {option.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Období financí" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.period}
            href={`/admin/finance?period=${filter.period}&view=${view}`}
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
        Částky jsou v Kč. Jedna platba za více termínů se počítá jen jednou.
      </p>
      {demo ? (
        <p className="rounded-lg border border-border p-5 text-sm">
          Ukázkový režim nezobrazuje skutečné finanční údaje.
        </p>
      ) : overview ? (
        <>
          <section aria-labelledby="finance-receipts" className="mb-8">
            <h2 id="finance-receipts" className="mb-3 text-xl font-bold">
              {view === "cash"
                ? "Skutečně přijaté peníze"
                : "Hodnota rezervací včetně voucherových slev"}
            </h2>
            <div className="flex flex-wrap gap-4">
              <StatCard
                label={
                  view === "cash"
                    ? "Přijato přes ostrý Comgate"
                    : "Hodnota plateb a voucherových slev"
                }
                value={formatMoney(
                  view === "cash"
                    ? overview.receipts.grossCents
                    : overview.bookingValueCents,
                )}
              />
              {view === "cash" ? (
                <>
                  <StatCard
                    label="Počet přijatých plateb"
                    value={overview.receipts.count}
                  />
                  <StatCard
                    label={`Z toho doplatky po voucheru (${overview.receipts.voucherTopUpCount})`}
                    value={formatMoney(overview.receipts.voucherTopUpCents)}
                  />
                </>
              ) : (
                <>
                  <StatCard
                    label="Z toho skutečně přijaté platby"
                    value={formatMoney(overview.receipts.grossCents)}
                  />
                  <StatCard
                    label="Z toho uplatněné slevy, nikoli příjem"
                    value={formatMoney(overview.vouchers.discountCents)}
                  />
                </>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {view === "cash"
                ? "Počítají se jen platby za rezervace, které ostrý Comgate označil jako úspěšné. Sleva voucheru se nepřičítá; zaplacený doplatek ano. Testovací, neúspěšné a jako vrácené označené platby se nezapočítávají. Pozdější plná vratka může změnit i součet za starší období. Nejde o bankovní výpis. Ruční a částečné vratky nejsou spolehlivě synchronizované — jejich skutečný stav ověřte v Comgate."
                : "Tento pohled sčítá skutečně přijaté platby a hodnotu uplatněných voucherových slev. Druhá část nejsou přijaté peníze. Rezervace zdarma z věrnosti se nepřičítají. Platby se řadí podle dne přijetí a slevy podle dne uplatnění, takže na hranici období mohou spadat do různých filtrů."}
            </p>
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            {view === "bookings" ? (
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
                    Úspora je hodnota slev, ne peníze přijaté posilovnou.
                    Vrácené a zatím pouze rezervované vouchery se nepočítají.
                  </p>
                  <Link
                    href="/admin/vouchers"
                    className="mt-3 inline-block text-sm text-accent-foreground hover:underline"
                  >
                    Správa voucherů →
                  </Link>
                </CardContent>
              </Card>
            ) : null}
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
