import { requireAdmin } from "@/lib/auth/guards";
import { alerts } from "@/lib/services";
import { formatDateTime, formatSeverity } from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hasDemoAdminSession } from "@/lib/auth/demo";
import { ResolveAlertButton } from "./resolve-alert-button";

export const metadata = { title: "Upozornění" };
export const dynamic = "force-dynamic";

/** Operational alerts history : failures pushed to the WhatsApp group. */
export default async function AlertsPage() {
  await requireAdmin();
  const demo = await hasDemoAdminSession();
  const rows = demo ? [] : await alerts.listRecentAlerts(100);

  return (
    <div>
      <PageHeader title="Upozornění" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Čas</TableHead>
            <TableHead>Závažnost</TableHead>
            <TableHead>Titulek</TableHead>
            <TableHead>Odesláno</TableHead>
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
              <TableCell>{formatSeverity(a.severity)}</TableCell>
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
                {a.resolvedAt ? (
                  formatDateTime(a.resolvedAt)
                ) : (
                  <ResolveAlertButton id={a.id} title={a.title} />
                )}
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
