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

/** Sending status for every outbound message. */
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
        description="Přehled e-mailů, WhatsApp zpráv a SMS, které systém zákazníkům odesílá, včetně stavu odeslání."
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vytvořeno</TableHead>
            <TableHead>Kanál</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Příjemce</TableHead>
            <TableHead>Stav</TableHead>
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
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Zatím žádné zprávy.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
