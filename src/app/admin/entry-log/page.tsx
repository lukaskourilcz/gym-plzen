import { entryLog } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";
import { loadDemoData } from "@/lib/demo/dummy";
import { DemoBanner } from "@/components/admin/demo-banner";

export const metadata = { title: "Kniha vstupů" };
export const dynamic = "force-dynamic";

/**
 * "Kniha vstupů" — actual unlocks read from the Nuki lock (synced by webhook +
 * cron). Independent of our own code bookkeeping, so it shows what physically
 * happened at the door.
 */
export default async function EntryLogPage() {
  let rows = await entryLog.listRecentEntries(200);
  const demo = rows.length === 0;
  if (demo) rows = (await loadDemoData()).entries;

  return (
    <div>
      <h1>Kniha vstupů</h1>
      <p style={{ color: "var(--muted)" }}>
        Načítá se ze zámku Nuki — kdo a kdy skutečně odemkl.
      </p>
      {demo && <DemoBanner />}
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
