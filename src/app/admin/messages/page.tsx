import { requireAdmin } from "@/lib/auth/guards";
import { importRecentEmails } from "./actions";
import { Button } from "@/components/ui/button";
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
export const maxDuration = 60;

/** Sending status for every outbound message. */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    import?: string;
    imported?: string;
    unavailable?: string;
  }>;
}) {
  await requireAdmin();
  const result = await searchParams;
  const demoEnabled = await hasDemoAdminSession();
  const [{ rows }, emails] = await Promise.all([
    withDemoFallback(
      demoEnabled ? Promise.resolve([]) : messages.listUnarchivedRecent(200),
      (d) => d.messages,
      demoEnabled,
    ),
    demoEnabled ? Promise.resolve([]) : messages.listAdminEmails(),
  ]);

  return (
    <div>
      <PageHeader
        title="Odeslané zprávy"
        description="Přehled e-mailů, WhatsApp zpráv a SMS, které systém zákazníkům odesílá, včetně stavu odeslání."
      />
      <p className="mb-6 text-sm text-muted-foreground">
        E-maily se zobrazují 30 dnů od odeslání. Poté se jejich uložený obsah
        automaticky smaže. Náhled obsahuje skutečně odeslanou zprávu, nikoli
        aktuální podobu šablony.
      </p>
      {result.import === "permissions" && (
        <p role="status" className="mb-4 text-sm">
          Resend nepovolil načtení starších zpráv. Nové e-maily se budou ukládat
          automaticky.
        </p>
      )}
      {result.imported !== undefined && (
        <p role="status" className="mb-4 text-sm">
          Doplněno e-mailů: {Number(result.imported) || 0}. Nedostupných zpráv:{" "}
          {Number(result.unavailable) || 0}.
        </p>
      )}
      {!demoEnabled &&
        rows.some((r) => r.channel === "email" && r.providerMessageId) && (
          <form action={importRecentEmails} className="mb-6">
            <Button type="submit" variant="outline">
              Doplnit starší e-maily z posledních 30 dnů
            </Button>
          </form>
        )}
      <h2 className="mb-3 text-xl font-bold">Odeslané e-maily</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Odesláno</TableHead>
            <TableHead>Příjemce</TableHead>
            <TableHead>Předmět</TableHead>
            <TableHead>Obsah</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {emails.map((email) => (
            <TableRow key={email.id}>
              <TableCell>{formatDateTime(email.sentAt)}</TableCell>
              <TableCell>{email.recipient}</TableCell>
              <TableCell>{email.subject}</TableCell>
              <TableCell>
                <Button
                  href={`/admin/messages/${email.id}`}
                  variant="outline"
                  size="sm"
                >
                  Zobrazit e-mail
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {emails.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>
                Zatím žádné uložené e-maily. Náhledy se ukládají při odeslání z
                webu.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {emails.length === 200 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Zobrazeno posledních 200 e-mailů.
        </p>
      )}
      <h2 className="mb-3 mt-8 text-xl font-bold">
        Ostatní zprávy a záznamy bez náhledu
      </h2>
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
