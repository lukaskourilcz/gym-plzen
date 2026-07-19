import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { SignOutButton } from "@/components/admin/sign-out-button";

/**
 * Admin shell. `requireAdmin()` guards every route under /admin at the layout
 * level, so individual pages can assume an authenticated admin.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside className="border-b border-white/10 bg-ink px-4 py-3 text-white lg:fixed lg:inset-y-0 lg:w-64 lg:border-r lg:border-b-0 lg:p-5">
        <Link href="/admin" className="font-extrabold tracking-[-.02em]">
          GYM PLZEŇ
          <span className="block text-[11px] font-medium uppercase tracking-[.14em] text-white/40">Administrace</span>
        </Link>
        <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 text-sm lg:mt-8 lg:grid lg:gap-6 lg:overflow-visible">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="contents lg:block">
              <div className="mb-1 hidden px-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-white/35 lg:block">
                {group.label}
              </div>
              <div className="flex gap-1 lg:grid lg:gap-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="whitespace-nowrap rounded-lg px-2.5 py-2 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-8 hidden border-t border-white/10 pt-4 text-xs text-white/45 lg:block">
          <div className="truncate">{admin.email}</div>
          <SignOutButton />
        </div>
      </aside>
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:ml-64 lg:p-8">{children}</main>
    </div>
  );
}

const NAV_GROUPS = [
  {
    label: "Provoz",
    items: [
      { href: "/admin", label: "Přehled" },
      { href: "/admin/calendar", label: "Kalendář" },
      { href: "/admin/reservations", label: "Rezervace" },
      { href: "/admin/schedule", label: "Otevírací doba a bloky" },
      { href: "/admin/entry-log", label: "Kniha vstupů" },
    ],
  },
  {
    label: "Lidé",
    items: [
      { href: "/admin/members", label: "Členové" },
      { href: "/admin/memberships", label: "Ceny a věrnost" },
      { href: "/admin/messages", label: "Doručené zprávy" },
    ],
  },
  {
    label: "Obsah",
    items: [
      { href: "/admin/content", label: "Obsah webu" },
      { href: "/admin/settings", label: "Nastavení a branding" },
    ],
  },
  {
    label: "Systém",
    items: [
      { href: "/admin/statistics", label: "Statistiky" },
      { href: "/admin/alerts", label: "Upozornění" },
      { href: "/admin/inspirations", label: "Inspirace" },
      { href: "/admin/plan", label: "Plán spuštění" },
    ],
  },
];
