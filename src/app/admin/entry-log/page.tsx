import { entryLog } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";
import { withDemoFallback } from "@/lib/demo/dummy";
import { DemoBanner } from "@/components/admin/demo-banner";
import { PageHeader } from "@/components/admin/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Kniha vstupů" };
export const dynamic = "force-dynamic";

/** Actual unlocks read from the Nuki lock (synced by webhook + cron). */
export default async function EntryLogPage() {
  const { rows, demo } = await withDemoFallback(
    entryLog.listRecentEntries(200),
    (d) => d.entries,
  );

  return (
    <div>
      <PageHeader
        title="Kniha vstupů"
        description="Přehled skutečných odemčení načtený ze zámku Nuki."
      />
      {demo && <DemoBanner />}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Čas</TableHead>
            <TableHead>Jméno / autorizace</TableHead>
            <TableHead>Akce</TableHead>
            <TableHead>Spouštěč</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{formatDateTime(e.occurredAt)}</TableCell>
              <TableCell>{e.nukiName ?? "Neuvedeno"}</TableCell>
              <TableCell>{e.action ?? "Neuvedeno"}</TableCell>
              <TableCell>{e.trigger ?? "Neuvedeno"}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                Zatím žádné záznamy.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
