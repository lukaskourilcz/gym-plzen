import { entryLog } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";

export const metadata = { title: "Kniha vstupů" };

/**
 * "Kniha vstupů" — actual unlocks read from the Nuki lock (synced by webhook +
 * cron). Independent of our own code bookkeeping, so it shows what physically
 * happened at the door.
 */
export default async function EntryLogPage() {
  const rows = await entryLog.listRecentEntries(200);

  return (
    <div>
      <h1>Kniha vstupů</h1>
      <p style={{ color: "var(--muted)" }}>
        Načítá se ze zámku Nuki — kdo a kdy skutečně odemkl.
      </p>
      <table>
        <thead>
          <tr>
            <th>Čas</th>
            <th>Jméno / autorizace</th>
            <th>Akce</th>
            <th>Spouštěč</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>{formatDateTime(e.occurredAt)}</td>
              <td>{e.nukiName ?? "—"}</td>
              <td>{e.action ?? "—"}</td>
              <td>{e.trigger ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4}>Zatím žádné záznamy.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
