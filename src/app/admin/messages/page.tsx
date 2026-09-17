import { messages } from "@/lib/services";
import {
  formatChannel,
  formatDateTime,
  formatMessageKind,
  formatStatus,
} from "@/lib/helpers/format";
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

export const metadata = { title: "Odeslané zprávy" };
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
        title="Odeslané zprávy"
        description="Každý e-mail, WhatsApp nebo SMS, které systém zákazníkům poslal, a zda dorazily. Stav doručení hlásí poskytovatelé zpráv."
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
              <TableCell>{formatChannel(m.channel)}</TableCell>
              <TableCell>{formatMessageKind(m.kind)}</TableCell>
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
