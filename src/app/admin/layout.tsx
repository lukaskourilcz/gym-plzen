import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { isPreviewMode } from "@/lib/preview";
import { SignOutButton } from "@/components/admin/sign-out-button";

/**
 * Admin shell. `requireAdmin()` guards every route under /admin at the layout
 * level, so individual pages can assume an authenticated admin. In client
 * preview the guard resolves to a synthetic admin and sign-out is replaced by
 * a "back to the site" link.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  const preview = isPreviewMode();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border bg-card p-4">
        <Link href="/admin" className="font-bold tracking-tight">
          Gym Plzeň
          <span className="block text-xs font-normal text-muted-foreground">administrace</span>
        </Link>
        <nav className="mt-6 grid gap-0.5 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
          <div className="truncate">{preview ? "Režim náhledu (bez přihlášení)" : admin.email}</div>
          {preview ? (
            <Link href="/" className="mt-1 inline-block text-primary hover:underline">
              Zpět na web
            </Link>
          ) : (
            <SignOutButton />
          )}
        </div>
      </aside>
      <main className="max-w-6xl flex-1 p-6">{children}</main>
    </div>
  );
}

const NAV = [
  { href: "/admin", label: "Přehled" },
  { href: "/admin/calendar", label: "Kalendář" },
  { href: "/admin/reservations", label: "Rezervace" },
  { href: "/admin/schedule", label: "Otevírací doba a bloky" },
  { href: "/admin/members", label: "Členové" },
  { href: "/admin/memberships", label: "Vstupné a věrnost" },
  { href: "/admin/statistics", label: "Statistiky" },
  { href: "/admin/content", label: "Obsah webu" },
  { href: "/admin/settings", label: "Nastavení a branding" },
  { href: "/admin/messages", label: "Doručené zprávy" },
  { href: "/admin/entry-log", label: "Kniha vstupů" },
  { href: "/admin/alerts", label: "Upozornění" },
  { href: "/admin/inspirations", label: "Inspirace" },
  { href: "/admin/plan", label: "Plán spuštění" },
];
