import { members } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";
import { loadDemoData } from "@/lib/demo/dummy";
import { DemoBanner } from "@/components/admin/demo-banner";
import { MemberForm } from "./member-form";

export const metadata = { title: "Členové" };
export const dynamic = "force-dynamic";

/**
 * Members admin — every registered user with their profile. Expanding a row
 * reveals the editable profile (contact, notification channels, GDPR consent,
 * internal note). Payment/visit history links in as those views are built.
 */
export default async function MembersPage() {
  let rows = await members.listMembers(200);
  const demo = rows.length === 0;
  if (demo) rows = (await loadDemoData()).members;

  return (
    <div>
      <h1>Členové</h1>
      {demo && <DemoBanner />}
      <table>
        <thead>
          <tr>
            <th>Jméno</th>
            <th>E-mail</th>
            <th>Telefon</th>
            <th>Registrace</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ user, profile }) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{profile?.phone ?? "—"}</td>
              <td>{formatDateTime(user.createdAt)}</td>
              <td>{user.role ?? "member"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5}>Zatím žádní členové.</td>
            </tr>
          )}
        </tbody>
      </table>

      {!demo && (
        <section style={{ marginTop: "2rem", maxWidth: 520 }}>
          <h2>Úprava člena</h2>
          {rows.map((member) => (
            <details key={member.user.id} style={{ marginBottom: "0.75rem" }}>
              <summary>
                {member.user.name} — {member.user.email}
              </summary>
              <div style={{ marginTop: "0.75rem" }}>
                <MemberForm member={member} />
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
