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
import { pageFromParam, splitPage } from "@/lib/helpers/pagination";
import { reservationPage } from "@/lib/services/admin-lists";
import { reservationFilters } from "@/components/admin/list-filter-options";
import { reservationAccessState } from "@/lib/helpers/reservation-access-state";
import { adminReservationAccess } from "@/lib/services/reservation-access";
import { requireAdmin } from "@/lib/auth/guards";
import { idSchema } from "@/lib/validations/common";
import Link from "next/link";
import { reservations } from "@/lib/services";
import { isCancellableByAdmin } from "@/lib/services/admin-reservations";
import {
  formatDateTime,
  formatMoney,
  formatStatus,
} from "@/lib/helpers/format";
import { withDemoFallback } from "@/lib/demo/dummy";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReservationForm } from "./reservation-form";
import { CancelButton } from "./cancel-button";
import { hasDemoAdminSession } from "@/lib/auth/demo";
import { reservationInvoiceStates } from "@/lib/services/invoice-delivery";
import { ReservationInvoice } from "@/components/admin/reservation-invoice";

export const metadata = { title: "Rezervace" };
export const dynamic = "force-dynamic";

/** Reservations admin: manual booking form + a list of recent reservations. */
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  await requireAdmin();
  const now = new Date();
  const query = await searchParams;
  const parsedId = idSchema.safeParse(query.id);
  const selectedId = parsedId.success ? parsedId.data : undefined;
  const demoEnabled = await hasDemoAdminSession();
  const filters = readAdminFilters(query);
  const page = pageFromParam(query.page);
  const { rows: loaded, demo } = await withDemoFallback(
    demoEnabled
      ? Promise.resolve([])
      : selectedId
        ? reservations
            .getReservation(selectedId)
            .then((row) => (row ? [row] : []))
        : reservationPage(page, filters),
    (d) => d.reservations,
    demoEnabled,
  );

  const { rows, hasNext, totalCount } = demo
    ? selectedId
      ? {
          rows: loaded.filter((r) => r.id === selectedId),
          hasNext: false,
          totalCount: loaded.filter((r) => r.id === selectedId).length,
        }
      : demoAdminPage(loaded, page, filters, (r) => ({
          text: `${r.contactName ?? ""} ${r.contactEmail ?? ""}`,
          date: r.startsAt,
          status: r.status,
          name: r.contactName ?? "",
          email: r.contactEmail ?? "",
          sortValues: {
            price: r.priceCents,
            status: r.status,
            created: r.createdAt,
          },
        }))
    : selectedId
      ? { ...splitPage(loaded, filters.pageSize), totalCount: loaded.length }
      : await splitAdminPage(loaded, page, filters, () =>
          reservationPage(1, filters),
        );

  // Slots bought together in one checkout carry a note, so cancelling one of
  // them is not mistaken for cancelling the whole purchase.
  const orderSlots = demo
    ? new Map<string, number>()
    : await reservations.countOrderSlots([
        ...new Set(rows.flatMap((r) => (r.orderId ? [r.orderId] : []))),
      ]);
  const invoiceStates = demo
    ? new Map()
    : await reservationInvoiceStates(rows.map((r) => r.id));

  const access = demo
    ? new Map(
        rows.map((r) => [
          r.id,
          {
            ...reservationAccessState({
              ...r,
              hold: false,
              delivered: false,
              enabled: true,
            }),
            pin: undefined as string | undefined,
          },
        ]),
      )
    : await adminReservationAccess(rows);

  return (
    <div>
      <PageHeader
        title="Rezervace"
        description="Kód připravujeme 24 hodin před termínem a posíláme e-mailem hodinu před začátkem. U bližších rezervací začne příprava ihned po potvrzení."
      />
      {query.cancelled === "1" ? (
        <p
          role="status"
          className="mb-5 rounded-lg border border-primary/30 bg-primary/10 p-4 font-bold"
        >
          Rezervace zrušena.
        </p>
      ) : null}
      {selectedId && (
        <Link
          href="/admin/reservations"
          className="mb-4 inline-flex text-sm text-accent-foreground hover:underline"
        >
          Zobrazit všechny rezervace
        </Link>
      )}
      <Card className="mb-8 max-w-lg">
        <CardHeader>
          <CardTitle>Nová rezervace (ručně)</CardTitle>
        </CardHeader>
        <CardContent>
          <ReservationForm />
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">
        {selectedId ? "Vybraná rezervace" : "Poslední rezervace"}
      </h2>
      {!selectedId ? (
        <AdminListFilters
          path="/admin/reservations"
          filters={filters}
          selects={reservationFilters}
          dateLabel="Termín"
        />
      ) : null}
      <AdminListTotal total={totalCount} label="Celkem rezervací" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Začátek</TableHead>
            <TableHead>Konec</TableHead>
            <TableHead>Kontakt</TableHead>
            <TableHead>Cena</TableHead>
            <TableHead>Stav</TableHead>
            <TableHead>Vstupní kód</TableHead>
            <TableHead>Faktura</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatDateTime(r.startsAt)}</TableCell>
              <TableCell>{formatDateTime(r.endsAt)}</TableCell>
              <TableCell>
                {r.userId && !demo ? (
                  <Link
                    href={`/admin/members/${r.userId}`}
                    className="inline-flex min-h-11 items-center font-bold text-accent-foreground hover:underline"
                  >
                    {r.contactName ?? r.contactEmail ?? "Člen"}
                  </Link>
                ) : (
                  <>
                    {r.contactName ?? r.contactEmail ?? "Neuvedeno"}
                    {!r.userId && (
                      <span className="block text-xs text-muted-foreground">
                        Bez účtu
                      </span>
                    )}
                  </>
                )}
              </TableCell>
              <TableCell>
                {r.priceCents != null
                  ? formatMoney(r.priceCents, r.currency)
                  : "členství"}
                {r.orderId && (orderSlots.get(r.orderId) ?? 0) > 1 ? (
                  <span className="block text-xs text-muted-foreground">
                    Součást objednávky {orderSlots.get(r.orderId)} termínů
                  </span>
                ) : null}
              </TableCell>
              <TableCell>{formatStatus(r.status)}</TableCell>
              <TableCell className="min-w-52">
                {access.get(r.id)?.pin && (
                  <span className="block font-mono text-base font-semibold tracking-widest">
                    {access.get(r.id)?.pin}
                  </span>
                )}
                <span className="block text-sm">
                  {access.get(r.id)?.label ?? "Ukázková rezervace"}
                </span>
                {access.get(r.id)?.at && (
                  <span className="block text-sm text-muted-foreground">
                    {formatDateTime(access.get(r.id)!.at!)}
                  </span>
                )}
              </TableCell>
              <TableCell>
                {!demo && invoiceStates.has(r.id) && (
                  <ReservationInvoice
                    reservationId={r.id}
                    state={invoiceStates.get(r.id)!}
                  />
                )}
              </TableCell>
              <TableCell>
                {!demo && isCancellableByAdmin(r, now) && (
                  <CancelButton
                    reservationId={r.id}
                    startsAtLabel={formatDateTime(r.startsAt)}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground">
                Zatím žádné rezervace.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {!selectedId ? (
        <AdminListPagination
          path="/admin/reservations"
          params={query}
          page={page}
          hasNext={hasNext}
        />
      ) : null}
    </div>
  );
}
