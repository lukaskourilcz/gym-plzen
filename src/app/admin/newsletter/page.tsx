import {
  AdminListFilters,
  AdminListPagination,
} from "@/components/admin/list-filters";
import {
  ADMIN_PAGE_SIZE,
  readAdminFilters,
  type AdminSearchParams,
} from "@/lib/helpers/admin-list";
import { pageFromParam, splitPage } from "@/lib/helpers/pagination";
import { newsletterPage } from "@/lib/services/admin-lists";
import { requireAdmin } from "@/lib/auth/guards";
import { newsletter } from "@/lib/services";
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
import { hasDemoAdminSession } from "@/lib/auth/demo";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata = { title: "Odběratelé novinek" };
export const dynamic = "force-dynamic";

export default async function NewsletterPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  await requireAdmin();
  const demo = await hasDemoAdminSession();
  const query = await searchParams;
  const filters = readAdminFilters(query);
  const page = pageFromParam(query.page);
  const { rows: loaded, totals } = demo
    ? { rows: [], totals: { total: 0, active: 0 } }
    : await newsletterPage(page, filters);
  const { rows, hasNext } = splitPage(loaded, ADMIN_PAGE_SIZE);
  return (
    <div>
      <PageHeader
        title="Odběratelé novinek"
        description="E-mailové adresy získané přes formulář pod mapou na úvodní stránce. Do každého e-mailu s novinkami vložte odběrateli jeho odkaz pro odhlášení."
      />
      <div className="mb-8 flex flex-wrap gap-4">
        <StatCard label="Odběratelů celkem" value={totals.total} />
        <StatCard label="Aktivních" value={totals.active} />
      </div>
      <AdminListFilters
        path="/admin/newsletter"
        filters={filters}
        placeholder="Jméno, e-mail nebo zdroj"
        dateLabel="Souhlas udělen"
        selects={[
          {
            name: "status",
            label: "Stav",
            options: [
              { value: "subscribed", label: "Odebírá" },
              { value: "unsubscribed", label: "Odhlášen" },
            ],
          },
        ]}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>E-mail</TableHead>
            <TableHead>Stav</TableHead>
            <TableHead>Souhlas udělen</TableHead>
            <TableHead>Zdroj</TableHead>
            <TableHead>Odhlášení</TableHead>
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
              <TableCell>
                {row.status === "subscribed" ? (
                  <div className="grid gap-1">
                    <UnsubscribeButton email={row.email} />
                    {newsletter.unsubscribeUrl(row.email) ? (
                      <span className="break-all text-xs text-muted-foreground">
                        Odkaz do rozesílky:{" "}
                        {newsletter.unsubscribeUrl(row.email)}
                      </span>
                    ) : null}
                  </div>
                ) : row.unsubscribedAt ? (
                  formatDateTime(row.unsubscribedAt)
                ) : (
                  "Odhlášený"
                )}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Zatím se nikdo nepřihlásil k odběru.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      <AdminListPagination
        path="/admin/newsletter"
        params={query}
        page={page}
        hasNext={hasNext}
      />
    </div>
  );
}
