import {
  AdminListTotal,
  AdminListFilters,
  AdminListPagination,
} from "@/components/admin/list-filters";
import {
  splitAdminPage,
  readAdminFilters,
  demoAdminPage,
  type AdminSearchParams,
} from "@/lib/helpers/admin-list";
import { pageFromParam } from "@/lib/helpers/pagination";
import { messageFilters } from "@/components/admin/list-filter-options";
import { emailPage, messagePage } from "@/lib/services/admin-lists";
import { requireAdmin } from "@/lib/auth/guards";
import { importRecentEmails } from "./actions";
import { Button } from "@/components/ui/button";
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
  searchParams: Promise<AdminSearchParams>;
}) {
  await requireAdmin();
  const result = await searchParams;
  const demoEnabled = await hasDemoAdminSession();
  const filters = readAdminFilters(result);
  const emailNumber = pageFromParam(result.emailPage);
  const messageNumber = pageFromParam(result.messagePage);
  const [{ rows: loaded, demo }, loadedEmails] = await Promise.all([
    withDemoFallback(
      demoEnabled ? Promise.resolve([]) : messagePage(messageNumber, filters),
      (d) => d.messages,
      demoEnabled,
    ),
    demoEnabled ? Promise.resolve([]) : emailPage(emailNumber, filters),
  ]);

  const {
    rows: emails,
    hasNext: moreEmails,
    totalCount: emailTotal,
  } = await splitAdminPage(loadedEmails, emailNumber, filters, () =>
    demoEnabled ? Promise.resolve([]) : emailPage(1, filters),
  );
  const {
    rows,
    hasNext: moreMessages,
    totalCount,
  } = demo
    ? demoAdminPage(loaded, messageNumber, filters, (m) => ({
        text: m.recipient,
        date: m.sentAt ?? m.createdAt,
        channel: m.channel,
        status: m.status,
        kind: m.kind,
      }))
    : await splitAdminPage(loaded, messageNumber, filters, () =>
        messagePage(1, filters),
      );

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
      <AdminListFilters
        path="/admin/messages"
        filters={filters}
        selects={messageFilters}
        placeholder="Jméno, e-mail nebo předmět"
        dateLabel="Odesláno"
      />
      <h2 className="mb-3 text-xl font-bold">Odeslané e-maily</h2>
      <AdminListTotal total={emailTotal} />
      <Table label="Odeslané e-maily">
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
              <TableCell>
                {email.recipient}
                {email.customerName ? (
                  <span className="block text-xs text-muted-foreground">
                    {email.customerName}
                  </span>
                ) : null}
              </TableCell>
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
      <AdminListPagination
        path="/admin/messages"
        params={result}
        page={emailNumber}
        hasNext={moreEmails}
        pageKey="emailPage"
        label="Stránkování e-mailů"
      />
      <h2 className="mb-3 mt-8 text-xl font-bold">
        Ostatní zprávy a záznamy bez náhledu
      </h2>
      <AdminListTotal total={totalCount} />
      <Table label="Další zprávy">
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
              <TableCell>
                {m.recipient}
                {"customerName" in m && typeof m.customerName === "string" ? (
                  <span className="block text-xs text-muted-foreground">
                    {m.customerName}
                  </span>
                ) : null}
              </TableCell>
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
      <AdminListPagination
        path="/admin/messages"
        params={result}
        page={messageNumber}
        hasNext={moreMessages}
        pageKey="messagePage"
        label="Stránkování ostatních zpráv"
      />
    </div>
  );
}
