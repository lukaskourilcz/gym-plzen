import Link from "next/link";
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
                    className="font-bold text-accent-foreground hover:underline"
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
    </div>
  );
}
