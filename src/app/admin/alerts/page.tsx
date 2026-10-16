import { IncidentDetails } from "@/components/admin/incident-details";
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
      <PageHeader
        title="Upozornění"
        description="Co se stalo, kterého termínu se problém týká a jak postupovat. Opakované výskyty zůstávají v jednom otevřeném incidentu."
      />
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
      <div className="space-y-3 md:hidden" data-incident-list="mobile">
        {rows.map((a) => (
          <article
            key={a.id}
            className="space-y-3 rounded-lg border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <time dateTime={a.createdAt.toISOString()}>
                {formatDateTime(a.createdAt)}
              </time>
              <span
                className={
                  a.resolvedAt
                    ? "font-medium"
                    : a.severity === "critical"
                      ? "font-semibold text-destructive"
                      : "font-semibold text-foreground"
                }
              >
                {formatSeverity(a.severity)}
              </span>
            </div>
            <IncidentDetails alert={a} />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
              <span>
                {a.notifiedAt
                  ? `Upozornění odesláno ${formatDateTime(a.notifiedAt)}`
                  : "Upozornění neodesláno"}
              </span>
              {a.resolvedAt ? (
                <span>Vyřešeno {formatDateTime(a.resolvedAt)}</span>
              ) : (
                <ResolveAlertButton id={a.id} title={a.title} />
              )}
            </div>
          </article>
        ))}
        {rows.length === 0 ? (
          <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            Žádná upozornění.
          </p>
        ) : null}
      </div>
      <div className="hidden md:block">
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
                className={
                  "[&>td]:align-top " +
                  (a.resolvedAt
                    ? ""
                    : a.severity === "critical"
                      ? "bg-destructive/5"
                      : a.severity === "warning"
                        ? "bg-warning/5"
                        : "bg-muted/40")
                }
              >
                <TableCell>{formatDateTime(a.createdAt)}</TableCell>
                <TableCell>{formatSeverity(a.severity)}</TableCell>
                <TableCell>
                  <IncidentDetails alert={a} />
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
      </div>
      <AdminListPagination
        path="/admin/alerts"
        params={query}
        page={page}
        hasNext={hasNext}
      />
    </div>
  );
}
