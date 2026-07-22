import { alerts } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Upozornění" };
export const dynamic = "force-dynamic";

/** Operational alerts history : failures pushed to the WhatsApp group. */
export default async function AlertsPage() {
  const rows = await alerts.listRecentAlerts(100).catch(() => []);

  return (
    <div>
      <PageHeader title="Upozornění" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Čas</TableHead>
            <TableHead>Závažnost</TableHead>
            <TableHead>Titulek</TableHead>
            <TableHead>Odesláno na WhatsApp</TableHead>
            <TableHead>Vyřešeno</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow
              key={a.id}
              className={a.resolvedAt ? undefined : "bg-destructive/5"}
            >
              <TableCell>{formatDateTime(a.createdAt)}</TableCell>
              <TableCell>{a.severity}</TableCell>
              <TableCell>
                {a.title}
                {a.body && (
                  <div className="text-xs text-muted-foreground">{a.body}</div>
                )}
              </TableCell>
              <TableCell>
                {a.notifiedAt ? formatDateTime(a.notifiedAt) : "Neodesláno"}
              </TableCell>
              <TableCell>
                {a.resolvedAt ? formatDateTime(a.resolvedAt) : "otevřené"}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Žádná upozornění.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
