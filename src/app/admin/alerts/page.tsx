import {
  AdminListTotal,
  AdminListFilters,
  AdminListPagination,
} from "@/components/admin/list-filters";
import {
  splitAdminPage,
  readAdminFilters,
  type AdminSearchParams,
} from "@/lib/helpers/admin-list";
import { pageFromParam } from "@/lib/helpers/pagination";
import { alertPage } from "@/lib/services/admin-lists";
import { alertseverity } from "@/lib/db/schema/enums";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTime, formatSeverity } from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hasDemoAdminSession } from "@/lib/auth/demo";
import { ResolveAlertButton } from "./resolve-alert-button";

export const metadata = { title: "Upozornění" };
export const dynamic = "force-dynamic";

/** Operational alerts history : failures pushed to the WhatsApp group. */
export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  await requireAdmin();
  const demo = await hasDemoAdminSession();
  const query = await searchParams;
  const filters = readAdminFilters(query);
  const page = pageFromParam(query.page);
  const { rows, hasNext, totalCount } = await splitAdminPage(
    demo ? [] : await alertPage(page, filters),
    page,
    filters,
    () => (demo ? Promise.resolve([]) : alertPage(1, filters)),
  );

  return (
    <div>
      <PageHeader title="Upozornění" />
      <AdminListFilters
        path="/admin/alerts"
        filters={filters}
        placeholder="Titulek nebo popis"
        selects={[
          {
            name: "severity",
            label: "Závažnost",
            options: alertseverity.enumValues.map((value) => ({
              value,
              label: formatSeverity(value),
            })),
          },
          {
            name: "state",
            label: "Vyřešeno",
            options: [
              { value: "open", label: "Nevyřešeno" },
              { value: "resolved", label: "Vyřešeno" },
            ],
          },
        ]}
      />
      <AdminListTotal total={totalCount} label="Celkem záznamů" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Čas</TableHead>
            <TableHead>Závažnost</TableHead>
            <TableHead>Titulek</TableHead>
            <TableHead>Odesláno</TableHead>
            <TableHead>Vyřešeno</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow
              key={a.id}
              className={a.resolvedAt ? undefined : "bg-destructive/5"}
            >
              <TableCell>{formatDateTime(a.createdAt)}</TableCell>
              <TableCell>{formatSeverity(a.severity)}</TableCell>
              <TableCell>
                {a.title}
                {a.body && (
                  <div className="text-xs text-muted-foreground">{a.body}</div>
                )}
              </TableCell>
              <TableCell>
                {a.notifiedAt ? formatDateTime(a.notifiedAt) : "Neodesláno"}
              </TableCell>
              <TableCell>
                {a.resolvedAt ? (
                  formatDateTime(a.resolvedAt)
                ) : (
                  <ResolveAlertButton id={a.id} title={a.title} />
                )}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Žádná upozornění.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <AdminListPagination
        path="/admin/alerts"
        params={query}
        page={page}
        hasNext={hasNext}
      />
    </div>
  );
}
