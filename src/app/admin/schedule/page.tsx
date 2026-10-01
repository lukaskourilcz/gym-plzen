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
import { blockPage } from "@/lib/services/admin-lists";
import { requireAdmin } from "@/lib/auth/guards";
import { schedule } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BlockedSlotForm,
  DeleteBlockButton,
  OpeningHoursRow,
  ShowerMinutesForm,
} from "./schedule-forms";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
  DEFAULT_SHOWER_MINUTES,
  BLOCK_REASON_LABELS,
} from "@/lib/config/schedule";
import { minutesToHHmm } from "@/lib/helpers/format";
import { hasDemoAdminSession } from "@/lib/auth/demo";

export const metadata = { title: "Otevírací doba a bloky" };
export const dynamic = "force-dynamic";

/** Weekly opening hours + one-off blocked slots (maintenance, holidays). */
export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  await requireAdmin();
  const now = new Date();
  const demo = await hasDemoAdminSession();
  const query = await searchParams;
  const filters = readAdminFilters(query);
  const page = pageFromParam(query.page);
  const [hours, loaded, showerMinutes] = demo
    ? [[], [], DEFAULT_SHOWER_MINUTES]
    : await Promise.all([
        schedule.listOpeningHours(),
        blockPage(page, filters),
        schedule.getShowerMinutes(),
      ]);
  const { rows: blocks, hasNext } = splitPage(loaded, ADMIN_PAGE_SIZE);
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));

  return (
    <div>
      <PageHeader title="Otevírací doba a bloky" />

      <section>
        <h2 className="mb-1 text-lg font-semibold">Týdenní otevírací doba</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Časová okna navazují na sebe od otevírací doby (např. 05:00–06:15,
          06:15–07:30). Výchozí provoz je denně{" "}
          {minutesToHHmm(DEFAULT_OPEN_MINUTE)} až{" "}
          {minutesToHHmm(DEFAULT_CLOSE_MINUTE)} po 75 minutách.
        </p>
        {Array.from({ length: 7 }, (_, day) => (
          <OpeningHoursRow key={day} dayOfWeek={day} hours={byDay.get(day)} />
        ))}
      </section>

      <section className="mt-8">
        <h2 className="mb-1 text-lg font-semibold">Doba na sprchu</h2>
        <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
          O kolik minut po skončení tréninku ještě platí vstupní kód, aby se
          člen mohl osprchovat. Tato doba neblokuje další rezervaci. Následující
          člen může začít trénovat, zatímco předchozí využívá sprchu.
        </p>
        <ShowerMinutesForm current={showerMinutes} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Blokované termíny</h2>
        <BlockedSlotForm />

        <div className="mt-4">
          <AdminListFilters
            path="/admin/schedule"
            filters={filters}
            placeholder="Poznámka"
            dateLabel="Termín"
            selects={[
              {
                name: "reason",
                label: "Důvod",
                options: Object.entries(BLOCK_REASON_LABELS).map(
                  ([value, label]) => ({ value, label }),
                ),
              },
            ]}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Začátek</TableHead>
                <TableHead>Konec</TableHead>
                <TableHead>Důvod</TableHead>
                <TableHead>Poznámka</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocks.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    {formatDateTime(b.startsAt)}
                    {b.startsAt <= now && b.endsAt > now && (
                      <Badge variant="accent" className="ml-2">
                        Probíhá
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDateTime(b.endsAt)}</TableCell>
                  <TableCell>
                    {BLOCK_REASON_LABELS[b.reason] ?? b.reason}
                  </TableCell>
                  <TableCell>{b.note ?? "Bez poznámky"}</TableCell>
                  <TableCell>
                    <DeleteBlockButton id={b.id} />
                  </TableCell>
                </TableRow>
              ))}
              {blocks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Žádné blokované termíny.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <AdminListPagination
            path="/admin/schedule"
            params={query}
            page={page}
            hasNext={hasNext}
          />
        </div>
      </section>
    </div>
  );
}
