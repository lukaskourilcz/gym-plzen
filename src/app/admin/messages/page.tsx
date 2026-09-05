import { messages } from "@/lib/services";
import { formatDateTime, formatStatus } from "@/lib/helpers/format";
import { withDemoFallback } from "@/lib/demo/dummy";
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

export const metadata = { title: "Doručené zprávy" };
export const dynamic = "force-dynamic";

/** Per-channel delivery status for every outbound message. */
export default async function MessagesPage() {
  const demoEnabled = await hasDemoAdminSession();
  const { rows } = await withDemoFallback(
    messages.listRecent(200),
    (d) => d.messages,
    demoEnabled,
  );

  return (
    <div>
      <PageHeader
        title="Doručené zprávy"
        description="U každé rezervace vidíte, zda kód dorazil (e-mail / WhatsApp / SMS). Stav aktualizují webhooky providerů."
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vytvořeno</TableHead>
            <TableHead>Kanál</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Příjemce</TableHead>
            <TableHead>Stav</TableHead>
            <TableHead>Doručeno</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{formatDateTime(m.createdAt)}</TableCell>
              <TableCell>{m.channel}</TableCell>
              <TableCell>{m.kind}</TableCell>
              <TableCell>{m.recipient}</TableCell>
              <TableCell
                className={
                  m.status === "failed" ? "text-destructive" : undefined
                }
              >
                {formatStatus(m.status)}
                {m.failureReason ? ` (${m.failureReason})` : ""}
              </TableCell>
              <TableCell>
                {m.deliveredAt ? formatDateTime(m.deliveredAt) : "Nedoručeno"}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Zatím žádné zprávy.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
