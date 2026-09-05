import { loyalty, members } from "@/lib/services";
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
import { MemberForm } from "./member-form";
import { MemberRoleForm } from "./member-role-form";
import { Badge } from "@/components/ui/badge";
import { hasDemoAdminSession } from "@/lib/auth/demo";

export const metadata = { title: "Členové" };
export const dynamic = "force-dynamic";

/** Members admin : every registered user with their editable profile. */
export default async function MembersPage() {
  const demoEnabled = await hasDemoAdminSession();
  const { rows, demo } = await withDemoFallback(
    members.listMembers(200),
    (d) => d.members,
    demoEnabled,
  );

  /*
   * One grouped query for the whole page rather than a count per row. Demo data
   * has no reservations to group, so the columns simply read zero there.
   */
  const entryCounts = demo
    ? new Map<string, number>()
    : await loyalty.countEntriesForUsers(rows.map((member) => member.user.id));

  return (
    <div>
      <PageHeader title="Členové" />
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
            const status = loyalty.deriveLoyaltyStatus(
              entryCounts.get(user.id) ?? 0,
            );
            return (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
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

      {!demo && (
        <section className="mt-8 max-w-xl">
          <h2 className="mb-3 text-lg font-semibold">Úprava člena</h2>
          {rows.map((member) => (
            <details
              key={member.user.id}
              className="mb-3 rounded-lg border border-border p-3"
            >
              <summary className="cursor-pointer">
                {member.user.name} ({member.user.email})
              </summary>
              <div className="mt-3">
                <MemberForm member={member} />
                <MemberRoleForm
                  userId={member.user.id}
                  isAdmin={member.user.role === "admin"}
                  name={member.user.name || member.user.email}
                />
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
