import { GuestCreditForm } from "./guest-credit-form";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { creditCustomers } from "@/lib/services/credit-admin";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import { CreditEditor } from "@/components/admin/credit-editor";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
export const dynamic = "force-dynamic";
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const admin = await requireAdmin();
  const query = await searchParams;
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(query.page || "1", 10) || 1),
  );
  const filters = {
    q: (query.q || "").slice(0, 120),
    balance: query.balance || "all",
    registration: query.registration || "all",
    sort: query.sort || "balance",
    page,
  };
  const rows = admin.isDemo ? [] : await creditCustomers(filters);
  return (
    <>
      <PageHeader
        title="Kredity"
        description="Zůstatky zákazníků a dohledatelná historie každé změny."
      />
      <form className="mb-5 flex flex-wrap items-end gap-3" method="get">
        <label className="grid gap-2 text-sm">
          Zákazník
          <Input
            name="q"
            placeholder="Jméno nebo e-mail"
            defaultValue={filters.q}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Zůstatek
          <Select name="balance" defaultValue={filters.balance}>
            <option value="all">Všichni</option>
            <option value="positive">S dostupným kreditem</option>
            <option value="zero">Bez dostupného kreditu</option>
          </Select>
        </label>
        <label className="grid gap-2 text-sm">
          Registrace
          <Select name="registration" defaultValue={filters.registration}>
            <option value="all">Všichni zákazníci</option>
            <option value="registered">Registrovaní</option>
            <option value="guest">Neregistrovaní</option>
          </Select>
        </label>
        <label className="grid gap-2 text-sm">
          Řadit podle
          <Select name="sort" defaultValue={filters.sort}>
            <option value="balance">Zůstatek</option>
            <option value="name">Jméno</option>
            <option value="updated">Poslední změna</option>
          </Select>
        </label>
        <Button type="submit" variant="outline">
          Filtrovat
        </Button>
      </form>
      <p className="mb-3 text-sm text-muted-foreground">
        {rows[0]?.total ?? 0} zákazníků · 20 na stránce
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Zákazník",
              "E-mail",
              "Dostupný kredit",
              "Rezervováno",
              "Poslední změna",
              "",
            ].map((text, i) => (
              <TableHead key={i}>{text}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 20).map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <span className="block font-bold">
                  {row.registered ? (
                    <Link
                      href={`/admin/members/${row.id}`}
                      className="underline"
                    >
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.registered ? "Registrovaný" : "Neregistrovaný"}
                </span>
              </TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell className="font-bold tabular-nums">
                {formatMoney(row.balance - row.reserved)}
              </TableCell>
              <TableCell>{formatMoney(row.reserved)}</TableCell>
              <TableCell>
                {row.updated ? formatDateTime(new Date(row.updated)) : "—"}
              </TableCell>
              <TableCell>
                <CreditEditor
                  userId={row.registered ? row.id : undefined}
                  email={row.email || undefined}
                  name={row.name}
                  balance={row.balance}
                  reserved={row.reserved}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length ? (
        <p className="mt-5 text-sm">Žádní zákazníci neodpovídají filtru.</p>
      ) : null}
      <Pagination
        page={page}
        hasNext={rows.length > 20}
        label="Kreditní účty"
        hrefForPage={(n) =>
          `/admin/credits?${new URLSearchParams({ ...filters, page: String(n) })}`
        }
      />
      {!admin.isDemo ? (
        <div className="mt-6 border-t border-border pt-5">
          <GuestCreditForm />
        </div>
      ) : null}
    </>
  );
}
