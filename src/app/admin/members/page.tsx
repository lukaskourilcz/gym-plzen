import {
  AdminListFilters,
  AdminListPagination,
} from "@/components/admin/list-filters";
import {
  ADMIN_PAGE_SIZE,
  readAdminFilters,
  demoAdminPage,
  type AdminSearchParams,
} from "@/lib/helpers/admin-list";
import { pageFromParam, splitPage } from "@/lib/helpers/pagination";
import { memberFilters } from "@/components/admin/list-filter-options";
import { memberPage } from "@/lib/services/admin-lists";
import { requireAdmin } from "@/lib/auth/guards";
import Link from "next/link";
import { loyalty } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";
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
import { Badge } from "@/components/ui/badge";
import { hasDemoAdminSession } from "@/lib/auth/demo";

export const metadata = { title: "Členové" };
export const dynamic = "force-dynamic";

/** Members admin : every registered user with their editable profile. */
export default async function MembersPage({
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
    demoEnabled ? Promise.resolve([]) : memberPage(page, filters),
    (d) => d.members,
    demoEnabled,
  );

  const { rows, hasNext } = demo
    ? demoAdminPage(loaded, page, filters, (m) => ({
        text: `${m.user.name} ${m.user.email} ${m.profile?.phone ?? ""}`,
        date: m.user.createdAt,
        role: m.user.role,
      }))
    : splitPage(loaded, ADMIN_PAGE_SIZE);

  /*
   * One grouped query for the whole page rather than a count per row. Demo data
   * has no reservations to group, so the columns simply read zero there.
   */
  const statuses = demo
    ? new Map<string, ReturnType<typeof loyalty.deriveLoyaltyStatus>>()
    : await loyalty.getLoyaltyStatusForUsers(
        rows.map((member) => member.user.id),
      );

  return (
    <div>
      <PageHeader
        title="Členové"
        description="Každý registrovaný účet. Jméno otevře profil člena s kontaktem, věrností, historií rezervací a záznamem akcí."
      />
      <AdminListFilters
        path="/admin/members"
        filters={filters}
        selects={memberFilters}
        dateLabel="Registrace"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Jméno</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>Registrace</TableHead>
            <TableHead>Návštěvy</TableHead>
            <TableHead>Do zdarma</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ user, profile }) => {
            const status =
              statuses.get(user.id) ?? loyalty.deriveLoyaltyStatus(0);
            return (
              <TableRow key={user.id}>
                <TableCell>
                  <Link
                    href={`/admin/members/${user.id}`}
                    className="inline-flex min-h-11 items-center font-bold text-accent-foreground hover:underline"
                  >
                    {user.name || user.email}
                  </Link>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{profile?.phone ?? "Neuvedeno"}</TableCell>
                <TableCell>{formatDateTime(user.createdAt)}</TableCell>
                <TableCell>{status.totalEntries}</TableCell>
                <TableCell>
                  {status.nextEntryIsFree
                    ? "další zdarma"
                    : status.entriesUntilFree}
                </TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "accent" : "muted"}>
                    {user.role === "admin" ? "Správce" : "Člen"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                Zatím žádní členové.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <AdminListPagination
        path="/admin/members"
        params={query}
        page={page}
        hasNext={hasNext}
      />
    </div>
  );
}
