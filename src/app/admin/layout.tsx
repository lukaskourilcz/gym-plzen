import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { SignOutButton } from "@/components/admin/sign-out-button";

/**
 * Admin shell. `requireAdmin()` guards every route under /admin at the layout
 * level, so individual pages can assume an authenticated admin. Layout is
 * intentionally plain — visual design comes later.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 220,
          borderRight: "1px solid var(--border)",
          padding: "1rem",
          flexShrink: 0,
        }}
      >
        <strong>Gym Plzeň — administrace</strong>
        <nav style={{ display: "grid", gap: "0.35rem", marginTop: "1rem" }}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: "2rem", fontSize: "0.8rem", color: "var(--muted)" }}>
          {admin.email}
          <SignOutButton />
        </div>
      </aside>
      <main style={{ flex: 1, padding: "1.5rem", maxWidth: 1100 }}>{children}</main>
    </div>
  );
}

const NAV = [
  { href: "/admin", label: "Přehled" },
  { href: "/admin/reservations", label: "Rezervace" },
  { href: "/admin/schedule", label: "Otevírací doba a bloky" },
  { href: "/admin/members", label: "Členové" },
  { href: "/admin/memberships", label: "Vstupné a věrnost" },
  { href: "/admin/content", label: "Obsah webu" },
  { href: "/admin/messages", label: "Doručené zprávy" },
  { href: "/admin/entry-log", label: "Kniha vstupů" },
  { href: "/admin/alerts", label: "Upozornění" },
  { href: "/admin/inspirations", label: "Inspirace" },
];
