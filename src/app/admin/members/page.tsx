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
import { memberFilters } from "@/components/admin/list-filter-options";
import { memberDirectoryPage as memberPage } from "@/lib/services/member-directory";
import { requireAdmin } from "@/lib/auth/guards";
import { AdminMemberName } from "@/components/admin/member-name";
import { MemberNoteEditor } from "@/components/admin/member-note-editor";
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
import { MemberRegistrationBadge } from "@/components/admin/member-registration-badge";
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

  const { rows, hasNext, totalCount } = demo
    ? demoAdminPage(loaded, page, filters, (m) => ({
        registration: "registered",
        name: m.user.name,
        email: m.user.email,
        whatsapp: m.profile?.notifyByWhatsapp ? "enabled" : "disabled",
        text: `${m.user.name} ${m.user.email} ${m.profile?.phone ?? ""}`,
        date: m.user.createdAt,
        role: m.user.role,
        sortValues: { phone: m.profile?.phone ?? null, role: m.user.role },
      }))
    : await splitAdminPage(loaded, page, filters, () => memberPage(1, filters));

  /*
   * One grouped query for the whole page rather than a count per row. Demo data
   * has no reservations to group, so the columns simply read zero there.
   */
  const statuses = demo
    ? new Map<string, ReturnType<typeof loyalty.deriveLoyaltyStatus>>()
    : await loyalty.getLoyaltyStatusForUsers(
        rows
          .filter((member) => member.profile !== null)
          .map((member) => member.user.id),
      );

  return (
    <div>
      <PageHeader
        title="Členové"
        description="Registrovaní členové i zákazníci bez účtu. Jméno otevře profil člena nebo rezervace neregistrovaného zákazníka."
      />
      <AdminListFilters
        path="/admin/members"
        filters={filters}
        selects={memberFilters}
        dateLabel="Zařazení do evidence"
      />
      <AdminListTotal total={totalCount} label="Celkem členů" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Jméno</TableHead>
            <TableHead>Účet</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>V evidenci od</TableHead>
            <TableHead>Návštěvy</TableHead>
            <TableHead>Do zdarma</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Poznámka</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((entry) => {
            const { user, profile } = entry;
            const guest = profile === null;
            const status =
              statuses.get(user.id) ?? loyalty.deriveLoyaltyStatus(0);
            return (
              <TableRow key={user.id}>
                <TableCell>
                  <AdminMemberName
                    href={
                      guest
                        ? `/admin/reservations?q=${encodeURIComponent(user.email)}`
                        : `/admin/members/${user.id}`
                    }
                    name={user.name || user.email}
                    note={profile?.note}
                    className="min-h-11 items-center"
                  />
                </TableCell>
                <TableCell>
                  <MemberRegistrationBadge registered={!guest} />
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  {profile?.phone ??
                    ("contactPhone" in entry &&
                    typeof entry.contactPhone === "string"
                      ? entry.contactPhone
                      : null) ??
                    "Neuvedeno"}
                </TableCell>
                <TableCell>{formatDateTime(user.createdAt)}</TableCell>
                <TableCell>{guest ? "—" : status.totalEntries}</TableCell>
                <TableCell>
                  {guest
                    ? "—"
                    : status.nextEntryIsFree
                      ? "další zdarma"
                      : status.entriesUntilFree}
                </TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "accent" : "muted"}>
                    {guest
                      ? "Bez účtu"
                      : user.role === "admin"
                        ? "Správce"
                        : "Člen"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {!demo && !guest ? (
                    <MemberNoteEditor
                      userId={user.id}
                      name={user.name || user.email}
                      note={profile?.note}
                    />
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-muted-foreground">
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
