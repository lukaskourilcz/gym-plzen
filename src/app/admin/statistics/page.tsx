import { requireAdmin } from "@/lib/auth/guards";
import { getStats, type Bucket } from "@/lib/services/stats";
import { loadDemoData } from "@/lib/demo/dummy";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { hasDemoAdminSession } from "@/lib/auth/demo";

export const metadata = { title: "Statistiky" };
export const dynamic = "force-dynamic";

/**
 * Statistics admin : actionable insights from reservations: volume, busiest
 * weekdays and hours, and the monthly trend. Lightweight inline bar charts.
 */
export default async function StatisticsPage() {
  await requireAdmin();
  const demo = await hasDemoAdminSession();
  const stats = demo ? (await loadDemoData()).stats : await getStats();

  return (
    <div>
      <PageHeader title="Statistiky" />
      <div className="mb-8 flex flex-wrap gap-4">
        <StatCard label="Rezervací celkem" value={stats.total} />
        <StatCard label="Za posledních 30 dní" value={stats.last30} />
        <StatCard label="Potvrzené" value={stats.confirmed} />
        <StatCard label="Zrušené" value={stats.cancelled} />
        <StatCard label="Nedostavení" value={stats.noShow} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <ChartCard
          title="Rezervace podle dne v týdnu"
          subtitle={
            stats.busiestWeekday
              ? `Nejvytíženější: ${stats.busiestWeekday}`
              : undefined
          }
          data={stats.byWeekday}
        />
        <ChartCard
          title="Nejčastější časy"
          subtitle={
            stats.busiestHour
              ? `Nejvytíženější: ${stats.busiestHour}`
              : undefined
          }
          data={stats.byHour}
        />
        <ChartCard title="Vývoj po měsících" data={stats.byMonth} />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: Bucket[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && (
          <p className="mb-2 text-xs text-muted-foreground">{subtitle}</p>
        )}
        <div className="mt-3 grid gap-1.5">
          {data.length === 0 && (
            <p className="text-sm text-muted-foreground">Žádná data.</p>
          )}
          {data.map((d) => (
            <div
              key={d.label}
              className="grid grid-cols-[3rem_1fr_2rem] items-center gap-2"
            >
              <span className="text-xs text-muted-foreground">{d.label}</span>
              <span className="h-3.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(d.count / max) * 100}%` }}
                />
              </span>
              <span className="text-right text-xs">{d.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
