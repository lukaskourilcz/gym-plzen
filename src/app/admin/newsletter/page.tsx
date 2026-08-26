import { newsletter } from "@/lib/services";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Odběratelé novinek" };
export const dynamic = "force-dynamic";

export default async function NewsletterPage() {
  await requireAdmin();
  const rows = await newsletter.listSubscribers().catch(() => []);
  const active = rows.filter((row) => row.status === "subscribed").length;
  return (
    <div>
      <PageHeader
        title="Odběratelé novinek"
        description="E-mailové adresy získané přes formulář pod mapou na úvodní stránce."
      />
      <div className="mb-8 flex flex-wrap gap-4">
        <StatCard label="Odběratelů celkem" value={rows.length} />
        <StatCard label="Aktivních" value={active} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>E-mail</TableHead>
            <TableHead>Stav</TableHead>
            <TableHead>Souhlas udělen</TableHead>
            <TableHead>Zdroj</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-semibold">{row.email}</TableCell>
              <TableCell>
                <Badge
                  variant={row.status === "subscribed" ? "accent" : "muted"}
                >
                  {row.status === "subscribed" ? "Odebírá" : "Odhlášený"}
                </Badge>
              </TableCell>
              <TableCell>{formatDateTime(row.consentedAt)}</TableCell>
              <TableCell>
                {row.source === "homepage" ? "Úvodní stránka" : row.source}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                Zatím se nikdo nepřihlásil k odběru.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
