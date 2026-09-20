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
  const { rows, hasNext, nukiUnavailable } = admin.isDemo
    ? { rows: [], hasNext: false, nukiUnavailable: false }
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
      <Table>
        <TableHeader><TableRow>
          <TableHead>Kód</TableHead><TableHead>Zákazník</TableHead><TableHead>Platí od</TableHead>
          <TableHead>Platí do</TableHead><TableHead>Stav kódu</TableHead><TableHead>Rezervace</TableHead>
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
            <TableCell>
              <Link className="font-semibold text-accent-foreground hover:underline" href={`/admin/reservations?id=${row.reservationId}`}>
                {formatDateTime(row.reservationStart)}
              </Link>
              <span className="block text-xs text-muted-foreground">{formatStatus(row.reservationStatus)}</span>
            </TableCell>
          </TableRow>)}
          {!rows.length && <TableRow><TableCell colSpan={6} className="text-muted-foreground">Na této stránce nejsou žádné kódy. Kódy pro budoucí rezervace se vytvářejí nejdříve hodinu před začátkem.</TableCell></TableRow>}
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
