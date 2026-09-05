import { vouchers } from "@/lib/services";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VoucherForm } from "./voucher-form";
import { VoucherStatusButton } from "./voucher-status-button";
import { hasDemoAdminSession } from "@/lib/auth/demo";

export const metadata = { title: "Vouchery" };
export const dynamic = "force-dynamic";

function voucherState(row: vouchers.VoucherOverview, now: Date) {
  if (!row.isActive) return { label: "Neaktivní", variant: "muted" as const };
  if (row.validFrom && row.validFrom > now)
    return { label: "Naplánovaný", variant: "outline" as const };
  if (row.validUntil && row.validUntil <= now)
    return { label: "Expirovaný", variant: "muted" as const };
  if (row.maxRedemptions != null && row.redeemedCount >= row.maxRedemptions)
    return { label: "Vyčerpaný", variant: "muted" as const };
  return { label: "Aktivní", variant: "accent" as const };
}

export default async function VouchersPage() {
  const demo = await hasDemoAdminSession();
  const rows = demo ? [] : await vouchers.listVouchers();
  const now = new Date();
  const redeemed = rows.reduce((sum, row) => sum + row.redeemedCount, 0);
  const active = rows.filter(
    (row) => voucherState(row, now).label === "Aktivní",
  ).length;

  return (
    <div>
      <PageHeader
        title="Vouchery"
        description="Slevové kódy se ověřují při rezervaci a výsledná částka se předává přímo do Stripe Checkout."
      />
      <div className="mb-8 flex flex-wrap gap-4">
        <StatCard label="Voucherů celkem" value={rows.length} />
        <StatCard label="Aktivních" value={active} />
        <StatCard label="Dokončených použití" value={redeemed} />
      </div>

      <Card className="mb-8 max-w-3xl">
        <CardHeader>
          <CardTitle>Nový voucher</CardTitle>
        </CardHeader>
        <CardContent>
          <VoucherForm />
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Přehled voucherů</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kód</TableHead>
            <TableHead>Sleva</TableHead>
            <TableHead>Platnost</TableHead>
            <TableHead>Použití</TableHead>
            <TableHead>Stav</TableHead>
            <TableHead>Akce</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const state = voucherState(row, now);
            return (
              <TableRow key={row.id}>
                <TableCell className="font-extrabold">{row.code}</TableCell>
                <TableCell>
                  {row.kind === "percentage"
                    ? `${row.value} %`
                    : formatMoney(row.value)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {row.validFrom ? formatDateTime(row.validFrom) : "ihned"}
                  <br />
                  {row.validUntil
                    ? formatDateTime(row.validUntil)
                    : "bez konce"}
                </TableCell>
                <TableCell>
                  {row.redeemedCount}
                  {row.maxRedemptions != null ? ` / ${row.maxRedemptions}` : ""}
                  {row.reservedCount > 0 ? (
                    <span className="block text-xs text-muted-foreground">
                      {row.reservedCount} čeká na platbu
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant={state.variant}>{state.label}</Badge>
                </TableCell>
                <TableCell>
                  <VoucherStatusButton id={row.id} isActive={row.isActive} />
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Zatím nebyl vytvořen žádný voucher.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
