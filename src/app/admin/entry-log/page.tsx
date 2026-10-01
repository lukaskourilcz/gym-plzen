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
import { pageFromParam } from "@/lib/helpers/pagination";
import { entryPage } from "@/lib/services/admin-lists";
import { requireAdmin } from "@/lib/auth/guards";
import {
  formatDateTime,
  formatLockAction,
  formatLockTrigger,
} from "@/lib/helpers/format";
import { withDemoFallback } from "@/lib/demo/dummy";
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

export const metadata = { title: "Kniha vstupů" };
export const dynamic = "force-dynamic";

/** Actual unlocks read from the Nuki lock (synced by webhook + cron). */
export default async function EntryLogPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  await requireAdmin();
  const demoEnabled = await hasDemoAdminSession();
  const query = await searchParams;
  const filters = readAdminFilters(query);
  const page = pageFromParam(query.page);
  const { rows: loaded, demo } = await withDemoFallback(
    demoEnabled ? Promise.resolve([]) : entryPage(page, filters),
    (d) => d.entries,
    demoEnabled,
  );

  const { rows, hasNext, totalCount } = demo
    ? demoAdminPage(loaded, page, filters, (e) => ({
        text: e.nukiName ?? "",
        date: e.occurredAt,
        action: e.action ?? "",
        trigger: e.trigger ?? "",
        name: e.nukiName ?? "",
        sortValues: { action: e.action, trigger: e.trigger },
      }))
    : await splitAdminPage(loaded, page, filters, () => entryPage(1, filters));

  return (
    <div>
      <PageHeader
        title="Kniha vstupů"
        description="Přehled skutečných odemčení načtený ze zámku Nuki."
      />
      <AdminListFilters
        path="/admin/entry-log"
        filters={filters}
        placeholder="Jméno nebo autorizace"
        selects={[
          {
            name: "action",
            label: "Akce",
            options: ["unlock", "lock", "unlatch", "lock_n_go", "keypad_open"]
              .map((value) => ({ value, label: formatLockAction(value) }))
              .concat([{ value: "keypad_failure", label: "Neúspěšný vstup" }]),
          },
          {
            name: "trigger",
            label: "Spouštěč",
            options: [
              "system",
              "manual",
              "button",
              "automatic",
              "web",
              "app",
              "auto_lock",
              "accessory",
              "keypad",
            ].map((value) => ({ value, label: formatLockTrigger(value) })),
          },
        ]}
      />
      <AdminListTotal total={totalCount} label="Celkem záznamů" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Čas</TableHead>
            <TableHead>Jméno / autorizace</TableHead>
            <TableHead>Akce</TableHead>
            <TableHead>Spouštěč</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{formatDateTime(e.occurredAt)}</TableCell>
              <TableCell>{e.nukiName ?? "Neuvedeno"}</TableCell>
              <TableCell>
                {e.action ? formatLockAction(e.action) : "Neuvedeno"}
              </TableCell>
              <TableCell>
                {e.trigger ? formatLockTrigger(e.trigger) : "Neuvedeno"}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                Zatím žádné záznamy.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <AdminListPagination
        path="/admin/entry-log"
        params={query}
        page={page}
        hasNext={hasNext}
      />
    </div>
  );
}
