import { requireAdmin } from "@/lib/auth/guards";
import { idSchema } from "@/lib/validations/common";
import Link from "next/link";
import { reservations } from "@/lib/services";
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

export const metadata = { title: "Rezervace" };
export const dynamic = "force-dynamic";

/** Reservations admin: manual booking form + a list of recent reservations. */
export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  const parsedId = idSchema.safeParse(query.id);
  const selectedId = parsedId.success ? parsedId.data : undefined;
  const demoEnabled = await hasDemoAdminSession();
  const { rows, demo } = await withDemoFallback(
    selectedId ? reservations.getReservation(selectedId).then((row) => row ? [row] : []) : reservations.listRecent(100),
    (d) => d.reservations,
    demoEnabled,
  );

  return (
    <div>
      <PageHeader title="Rezervace" />
      {selectedId && <Link href="/admin/reservations" className="mb-4 inline-flex text-sm text-accent-foreground hover:underline">Zobrazit všechny rezervace</Link>}
      <Card className="mb-8 max-w-lg">
        <CardHeader>
          <CardTitle>Nová rezervace (ručně)</CardTitle>
        </CardHeader>
        <CardContent>
          <ReservationForm />
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">{selectedId ? "Vybraná rezervace" : "Poslední rezervace"}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Začátek</TableHead>
            <TableHead>Konec</TableHead>
            <TableHead>Kontakt</TableHead>
            <TableHead>Cena</TableHead>
            <TableHead>Stav</TableHead>
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
              </TableCell>
              <TableCell>{formatStatus(r.status)}</TableCell>
              <TableCell>
                {!demo && r.status !== "cancelled" && (
                  <CancelButton reservationId={r.id} />
                )}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Zatím žádné rezervace.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
