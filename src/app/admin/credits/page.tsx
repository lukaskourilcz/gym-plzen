import { db } from "@/lib/db";
import { reservationChange, profiles } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { CreditChangeRecovery } from "@/components/admin/credit-change-recovery";
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const raw = await searchParams;
  const query = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      typeof value === "string" ? value : undefined,
    ]),
  );
  const page = Math.max(
    1,
    Math.min(100000, Number.parseInt(query.page || "1", 10) || 1),
  );
  const filters = {
    q: (query.q || "").slice(0, 120),
    registration: query.registration || "all",
    sort: query.sort || "balance",
    page,
  };
  const rows = admin.isDemo ? [] : await creditCustomers(filters);
  const unresolved = admin.isDemo
    ? []
    : await db
        .select({
          change: reservationChange,
          name: profiles.fullName,
          email: profiles.email,
        })
        .from(reservationChange)
        .leftJoin(profiles, eq(profiles.id, reservationChange.userId))
        .where(
          inArray(reservationChange.status, [
            "review_needed",
            "refund_pending",
          ]),
        )
        .orderBy(desc(reservationChange.updatedAt))
        .limit(20);
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
        Zákazníci s kreditem: {rows[0]?.total ?? 0} · 20 na stránce
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Zákazník",
              "E-mail",
              "Dostupný kredit",
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
                    <Link
                      className="underline"
                      href={`/admin/credits/${row.id}`}
                    >
                      {row.name}
                    </Link>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.registered
                    ? "Registrovaný"
                    : row.pendingClaim
                      ? "Kredit čeká na ověření e-mailu"
                      : "Neregistrovaný"}
                </span>
              </TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell className="font-bold tabular-nums">
                {formatMoney(row.balance - row.reserved)}
              </TableCell>
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
        <p className="mt-5 text-sm">
          Žádní zákazníci s kreditem neodpovídají filtru.
        </p>
      ) : null}
      <Pagination
        page={page}
        hasNext={rows.length > 20}
        label="Kreditní účty"
        hrefForPage={(n) =>
          `/admin/credits?${new URLSearchParams({ ...filters, page: String(n) })}`
        }
      />
      {unresolved.length ? (
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-bold">Změny vyžadující ověření</h2>
          <div className="grid gap-4">
            {unresolved.map(({ change, name, email }) => (
              <article
                key={change.id}
                className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-[1fr_20rem]"
              >
                <div>
                  <p className="font-bold">
                    {name || email} · {formatMoney(change.cashCents)}
                  </p>
                  <p className="mt-2 text-sm">
                    {change.error || "Změnu se nepodařilo bezpečně dokončit."}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Stav vrácení:{" "}
                    {
                      (
                        {
                          none: "Čeká na nápravu",
                          submitting:
                            "Požadavek mohl být odeslán — ověřte Comgate",
                          requested:
                            "Požadavek přijat Comgate, ověřte dokončení",
                          unknown: "Nejistý výsledek — ověřte Comgate",
                          rejected: "Požadavek odmítnut — vyřešte v Comgate",
                          confirmed: "Vráceno",
                        } as const
                      )[change.refundState]
                    }
                  </p>
                  <Link
                    className="mt-2 inline-block text-sm underline"
                    href={`/admin/reservations?q=${change.reservationId}`}
                  >
                    Rezervace
                  </Link>
                </div>
                <CreditChangeRecovery
                  id={change.id}
                  refundPending={change.status === "refund_pending"}
                />
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {!admin.isDemo ? (
        <div className="mt-6 border-t border-border pt-5">
          <GuestCreditForm />
        </div>
      ) : null}
    </>
  );
}
