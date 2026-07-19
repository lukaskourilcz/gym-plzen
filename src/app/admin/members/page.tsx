import { members } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";
import { withDemoFallback } from "@/lib/demo/dummy";
import { DemoBanner } from "@/components/admin/demo-banner";
import { PageHeader } from "@/components/admin/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MemberForm } from "./member-form";

export const metadata = { title: "Členové" };
export const dynamic = "force-dynamic";

/** Members admin — every registered user with their editable profile. */
export default async function MembersPage() {
  const { rows, demo } = await withDemoFallback(members.listMembers(200), (d) => d.members);

  return (
    <div>
      <PageHeader title="Členové" />
      {demo && <DemoBanner />}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Jméno</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>Registrace</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ user, profile }) => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{profile?.phone ?? "Neuvedeno"}</TableCell>
              <TableCell>{formatDateTime(user.createdAt)}</TableCell>
              <TableCell>{user.role ?? "member"}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
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
            <details key={member.user.id} className="mb-3 rounded-lg border border-border p-3">
              <summary className="cursor-pointer">
                {member.user.name} ({member.user.email})
              </summary>
              <div className="mt-3">
                <MemberForm member={member} />
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
