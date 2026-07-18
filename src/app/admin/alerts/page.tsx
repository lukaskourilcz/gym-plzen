import { alerts } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";

export const metadata = { title: "Upozornění" };

/**
 * Operational alerts history — every failure the watchdog raised and pushed to
 * the WhatsApp group. Unresolved alerts are highlighted.
 */
export default async function AlertsPage() {
  const rows = await alerts.listRecentAlerts(100);

  return (
    <div>
      <h1>Upozornění</h1>
      <table>
        <thead>
          <tr>
            <th>Čas</th>
            <th>Závažnost</th>
            <th>Titulek</th>
            <th>Odesláno na WhatsApp</th>
            <th>Vyřešeno</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} style={{ background: a.resolvedAt ? undefined : "#fef2f2" }}>
              <td>{formatDateTime(a.createdAt)}</td>
              <td>{a.severity}</td>
              <td>
                {a.title}
                {a.body ? <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{a.body}</div> : null}
              </td>
              <td>{a.notifiedAt ? formatDateTime(a.notifiedAt) : "—"}</td>
              <td>{a.resolvedAt ? formatDateTime(a.resolvedAt) : "otevřené"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5}>Žádná upozornění.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
