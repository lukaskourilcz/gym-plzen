import { FailedAttemptsDialog } from "@/components/admin/failed-attempts-dialog";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { listAdminAccessCodes } from "@/lib/services/admin-access-codes";
import { accessCodeStatusLabel } from "@/lib/helpers/access-code-status";
import { formatDateTime, formatStatus } from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Vstupní kódy" };
export const dynamic = "force-dynamic";

export default async function AccessCodesPage({ searchParams }: {
  searchParams: Promise<{ page?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const rawPage = Number(params.page);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1;
  const { rows, unassignedFailures, hasNext, nukiUnavailable, usageUnavailable } = admin.isDemo
    ? { rows: [], unassignedFailures: [], hasNext: false, nukiUnavailable: false, usageUnavailable: false }
    : await listAdminAccessCodes(page);
  const now = new Date();
  return (
    <div>
      <PageHeader title="Vstupní kódy" description="Přehled vytvořených kódů, jejich platnosti a zákazníků. Časy jsou uvedené v českém čase." />
      <p className="mb-4 text-sm text-muted-foreground">
        Kód platí od začátku rezervace do 15 minut po jejím konci. E-mail odchází hodinu před začátkem.
        Plný kód je dostupný, dokud ho Nuki uchovává; u odstraněných kódů vidíte poslední dvě číslice.
      </p>
      {nukiUnavailable && <p role="status" className="mb-4 rounded-md border p-3 text-sm">Nuki se teď nepodařilo načíst. Zobrazujeme uloženou platnost a poslední dvě číslice kódů. Zkuste stránku obnovit.</p>}
      <p className="mb-4 text-sm text-muted-foreground">Použití potvrzuje úspěšné otevření kódem podle dostupné historie Nuki. Nový záznam se objeví po synchronizaci zámku a obnovení stránky.</p>
      {usageUnavailable && <p role="status" className="mb-4 rounded-md border p-3 text-sm">Historii použití se nepodařilo načíst celou. Zobrazujeme potvrzené uložené záznamy; ostatní použití nyní nelze ověřit.</p>}
      <div className="mb-4"><FailedAttemptsDialog attempts={unassignedFailures} unavailable={usageUnavailable} unassigned /></div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Kód</TableHead><TableHead>Zákazník</TableHead><TableHead>Platí od</TableHead>
          <TableHead>Platí do</TableHead><TableHead>Stav kódu</TableHead><TableHead>Použito</TableHead><TableHead>Neúspěšný pokus</TableHead><TableHead>Rezervace</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((row) => <TableRow key={row.id}>
            <TableCell>
              <span className="whitespace-nowrap font-mono text-base font-semibold tracking-widest">{row.pin ?? `••••${row.last2 ?? "••"}`}</span>
              {!row.pin && <span className="block text-xs text-muted-foreground">Plný kód není dostupný</span>}
            </TableCell>
            <TableCell>
              {row.userId ? <Link className="font-semibold text-accent-foreground hover:underline" href={`/admin/members/${row.userId}`}>{row.name ?? row.memberName ?? row.email ?? "Člen"}</Link>
                : <span className="font-semibold">{row.name ?? row.email ?? "Neuvedeno"}</span>}
              <span className="block text-xs text-muted-foreground">{row.email ?? row.memberEmail}</span>
              {!row.userId && <span className="block text-xs text-muted-foreground">Bez účtu</span>}
            </TableCell>
            <TableCell className="whitespace-nowrap">{formatDateTime(row.validFrom)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatDateTime(row.validUntil)}</TableCell>
            <TableCell>{accessCodeStatusLabel(row, now)}</TableCell>
            <TableCell className="min-w-44">
              {row.usedAt.length ? <>
                <span className="font-semibold">Ano ({row.usedAt.length}×)</span>
                <span className="block whitespace-nowrap text-xs">{formatDateTime(row.usedAt[0]!)}</span>
                {row.usedAt.length > 1 && <details className="mt-1 text-xs"><summary className="cursor-pointer">Všechny časy použití</summary>
                  <ul>{row.usedAt.map(at => <li key={at.toISOString()}>{formatDateTime(at)}</li>)}</ul>
                </details>}
              </> : <span className="text-sm text-muted-foreground">{usageUnavailable ? "Nelze ověřit" : "Bez záznamu použití"}</span>}
            </TableCell>
            <TableCell><FailedAttemptsDialog attempts={row.failures} unavailable={usageUnavailable} /></TableCell>
            <TableCell>
              <Link className="font-semibold text-accent-foreground hover:underline" href={`/admin/reservations?id=${row.reservationId}`}>
                {formatDateTime(row.reservationStart)}
              </Link>
              <span className="block text-xs text-muted-foreground">{formatStatus(row.reservationStatus)}</span>
            </TableCell>
          </TableRow>)}
          {!rows.length && <TableRow><TableCell colSpan={8} className="text-muted-foreground">Na této stránce nejsou žádné kódy. Kódy pro budoucí rezervace se vytvářejí nejdříve hodinu před začátkem.</TableCell></TableRow>}
        </TableBody>
      </Table>
      <nav aria-label="Stránkování vstupních kódů" className="mt-4 flex items-center gap-4">
        {page > 1 && <Button variant="outline" href={`/admin/access-codes?page=${page - 1}`}>Předchozí</Button>}
        <span className="text-sm text-muted-foreground">Stránka {page}</span>
        {hasNext && <Button variant="outline" href={`/admin/access-codes?page=${page + 1}`}>Další</Button>}
      </nav>
    </div>
  );
}
