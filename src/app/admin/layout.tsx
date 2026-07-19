import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { AdminNav } from "@/components/admin/admin-nav";

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
        <Link href="/admin" className="flex items-center gap-2.5 px-2.5 py-1 tracking-[-.02em]">
          <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-primary text-primary-foreground"><Dumbbell className="size-[18px]" /></span>
          <span><strong className="block text-[15px] font-extrabold">GYM PLZEŇ</strong><span className="block text-[11px] font-medium text-white/45">Administrace</span></span>
        </Link>
        <AdminNav />
        <div className="mt-auto hidden items-center gap-2.5 border-t border-white/10 px-2.5 pb-1 pt-3.5 lg:flex">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-extrabold text-primary">A</span>
          <div className="min-w-0 text-xs"><div className="truncate font-bold text-white/80">{admin.email}</div><SignOutButton /></div>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-[1164px] p-4 sm:p-6 lg:ml-[248px] lg:w-[calc(100%_-_248px)] lg:px-8 lg:pb-12 lg:pt-7">{children}</main>
    </div>
  );
}
