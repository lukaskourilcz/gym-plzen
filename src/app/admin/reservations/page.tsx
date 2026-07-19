import { reservations } from "@/lib/services";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import { withDemoFallback } from "@/lib/demo/dummy";
import { DemoBanner } from "@/components/admin/demo-banner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReservationForm } from "./reservation-form";
import { CancelButton } from "./cancel-button";

export const metadata = { title: "Rezervace" };
export const dynamic = "force-dynamic";

/** Reservations admin: manual booking form + a list of recent reservations. */
export default async function ReservationsPage() {
  const { rows, demo } = await withDemoFallback(
    await reservations.listRecent(100),
    (d) => d.reservations,
  );

  return (
    <div>
      <PageHeader title="Rezervace" />
      {demo && <DemoBanner />}

      <Card className="mb-8 max-w-lg">
        <CardHeader>
          <CardTitle>Nová rezervace (ručně)</CardTitle>
        </CardHeader>
        <CardContent>
          <ReservationForm />
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Poslední rezervace</h2>
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
              <TableCell>{r.contactName ?? r.contactEmail ?? "Neuvedeno"}</TableCell>
              <TableCell>{r.priceCents != null ? formatMoney(r.priceCents, r.currency) : "členství"}</TableCell>
              <TableCell>{r.status}</TableCell>
              <TableCell>
                {!demo && r.status !== "cancelled" && <CancelButton reservationId={r.id} />}
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
