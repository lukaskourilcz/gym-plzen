import { messages } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";
import { loadDemoData } from "@/lib/demo/dummy";
import { DemoBanner } from "@/components/admin/demo-banner";

export const metadata = { title: "Doručené zprávy" };
export const dynamic = "force-dynamic";

/**
 * "Přehled doručených zpráv" — per-channel delivery status for every outbound
 * message (access codes, confirmations). Status is updated by provider webhooks.
 */
export default async function MessagesPage() {
  let rows = await messages.listRecent(200);
  const demo = rows.length === 0;
  if (demo) rows = (await loadDemoData()).messages;

  return (
    <div>
      <h1>Doručené zprávy</h1>
      {demo && <DemoBanner />}
      <table>
        <thead>
          <tr>
            <th>Vytvořeno</th>
            <th>Kanál</th>
            <th>Typ</th>
            <th>Příjemce</th>
            <th>Stav</th>
            <th>Doručeno</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td>{formatDateTime(m.createdAt)}</td>
              <td>{m.channel}</td>
              <td>{m.kind}</td>
              <td>{m.recipient}</td>
              <td style={{ color: m.status === "failed" ? "var(--danger)" : undefined }}>
                {m.status}
                {m.failureReason ? ` (${m.failureReason})` : ""}
              </td>
              <td>{m.deliveredAt ? formatDateTime(m.deliveredAt) : "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6}>Zatím žádné zprávy.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
