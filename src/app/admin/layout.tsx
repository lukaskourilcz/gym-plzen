import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { AdminNav } from "@/components/admin/admin-nav";
import { BrandLogo } from "@/components/site/brand";
import { DemoBanner } from "@/components/admin/demo-banner";

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
    <div className="min-h-screen bg-secondary/35 lg:flex">
      <aside className="border-b border-white/10 bg-ink px-4 py-3 text-white lg:fixed lg:inset-y-0 lg:flex lg:w-[248px] lg:flex-col lg:border-r lg:border-b-0 lg:px-3.5 lg:py-5">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/admin"
            aria-label="NAVI Private Gym, administrace"
            className="flex items-center gap-3 px-2.5 py-1"
          >
            <BrandLogo compact className="text-gold" />
            <span className="text-[11px] font-medium text-white/55">
              Administrace
            </span>
          </Link>
          <SignOutButton className="m-0 min-h-11 px-2 text-xs text-gold lg:hidden" />
        </div>
        <AdminNav />
        <div className="mt-auto hidden items-center gap-2.5 border-t border-white/10 px-2.5 pb-1 pt-3.5 lg:flex">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/12 text-xs font-extrabold text-gold">
            A
          </span>
          <div className="min-w-0 text-xs">
            <div className="truncate font-bold text-white/80">
              {admin.email}
            </div>
            <SignOutButton className="text-gold" />
          </div>
        </div>
      </aside>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1164px] p-4 sm:p-6 lg:ml-[248px] lg:w-[calc(100%_-_248px)] lg:px-8 lg:pb-12 lg:pt-7"
      >
        {admin.isDemo ? <DemoBanner /> : null}
        {children}
      </main>
    </div>
  );
}
