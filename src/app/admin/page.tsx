import Link from "next/link";
import { reservations, alerts, messages } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";
import { loadDemoData } from "@/lib/demo/dummy";
import { DemoBanner } from "@/components/admin/demo-banner";

export const metadata = { title: "Přehled" };
export const dynamic = "force-dynamic";

/**
 * Admin dashboard — a quick operational snapshot: upcoming reservations,
 * unresolved alerts, and recent message deliveries. Deep views live in their
 * own sections.
 */
export default async function AdminDashboard() {
  const [liveReservations, recentAlerts, liveMessages] = await Promise.all([
    reservations.listRecent(8),
    alerts.listRecentAlerts(8),
    messages.listRecent(8),
  ]);

  const demo = liveReservations.length === 0;
  const d = demo ? await loadDemoData() : null;
  const recentReservations = d ? d.reservations.slice(0, 8) : liveReservations;
  const recentMessages = d ? d.messages.slice(0, 8) : liveMessages;

  const upcoming = recentReservations.filter((r) => r.startsAt > new Date());

  return (
    <div>
      <h1>Přehled</h1>
      {demo && <DemoBanner />}

      <section style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Stat label="Nadcházející rezervace" value={upcoming.length} />
        <Stat
          label="Neuzavřená upozornění"
          value={recentAlerts.filter((a) => !a.resolvedAt).length}
        />
        <Stat
          label="Nedoručené zprávy (posl. 8)"
          value={recentMessages.filter((m) => m.status === "failed").length}
        />
      </section>

      <h2 style={{ marginTop: "2rem" }}>Poslední rezervace</h2>
      <table>
        <thead>
          <tr>
            <th>Začátek</th>
            <th>Kontakt</th>
            <th>Stav</th>
          </tr>
        </thead>
        <tbody>
          {recentReservations.map((r) => (
            <tr key={r.id}>
              <td>{formatDateTime(r.startsAt)}</td>
              <td>{r.contactName ?? r.contactEmail ?? "—"}</td>
              <td>{r.status}</td>
            </tr>
          ))}
          {recentReservations.length === 0 && (
            <tr>
              <td colSpan={3}>Zatím žádné rezervace.</td>
            </tr>
          )}
        </tbody>
      </table>
      <p style={{ marginTop: "0.5rem" }}>
        <Link href="/admin/reservations">Všechny rezervace →</Link>
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "1rem",
        minWidth: 180,
      }}
    >
      <div style={{ fontSize: "1.8rem", fontWeight: 700 }}>{value}</div>
      <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{label}</div>
    </div>
  );
}
