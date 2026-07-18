import { getStats, type Bucket } from "@/lib/services/stats";
import { loadDemoData } from "@/lib/demo/dummy";
import { DemoBanner } from "@/components/admin/demo-banner";

export const metadata = { title: "Statistiky" };
export const dynamic = "force-dynamic";

/**
 * Statistics admin — actionable insights from reservations: volume, busiest
 * weekdays and hours, and the monthly trend. Charts are lightweight inline bars
 * (swap for Tremor components later if richer charts are wanted).
 */
export default async function StatisticsPage() {
  let stats = await getStats();
  const demo = stats.total === 0;
  if (demo) stats = (await loadDemoData()).stats;

  return (
    <div>
      <h1>Statistiky</h1>
      {demo && <DemoBanner />}

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", margin: "1rem 0 2rem" }}>
        <Kpi label="Rezervací celkem" value={stats.total} />
        <Kpi label="Za posledních 30 dní" value={stats.last30} />
        <Kpi label="Potvrzené" value={stats.confirmed} />
        <Kpi label="Zrušené" value={stats.cancelled} />
        <Kpi label="Nedostavení" value={stats.noShow} />
      </div>

      {stats.total === 0 && (
        <p style={{ color: "var(--muted)" }}>
          Zatím nejsou žádná data. Grafy se naplní, jakmile přibudou rezervace.
        </p>
      )}

      <div style={{ display: "grid", gap: "2rem", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <ChartCard
          title="Rezervace podle dne v týdnu"
          subtitle={stats.busiestWeekday ? `Nejvytíženější: ${stats.busiestWeekday}` : undefined}
          data={stats.byWeekday}
        />
        <ChartCard
          title="Nejčastější časy"
          subtitle={stats.busiestHour ? `Nejvytíženější: ${stats.busiestHour}` : undefined}
          data={stats.byHour}
        />
        <ChartCard title="Vývoj po měsících" data={stats.byMonth} />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1rem", minWidth: 150 }}>
      <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{value}</div>
      <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{label}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, data }: { title: string; subtitle?: string; data: Bucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "1rem" }}>
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{title}</h2>
      {subtitle && <div style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{subtitle}</div>}
      <div style={{ display: "grid", gap: "0.35rem", marginTop: "0.75rem" }}>
        {data.length === 0 && <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Žádná data.</div>}
        {data.map((d) => (
          <div key={d.label} style={{ display: "grid", gridTemplateColumns: "48px 1fr 32px", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{d.label}</span>
            <span style={{ background: "var(--color-muted)", borderRadius: 999, overflow: "hidden", height: 14 }}>
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${(d.count / max) * 100}%`,
                  background: "var(--color-primary)",
                }}
              />
            </span>
            <span style={{ fontSize: "0.8rem", textAlign: "right" }}>{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
