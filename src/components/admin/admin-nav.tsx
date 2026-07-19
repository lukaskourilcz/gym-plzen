"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Clock3,
  FileText,
  Home,
  KeyRound,
  Lightbulb,
  ListChecks,
  MessageCircle,
  Rocket,
  Settings,
  Tags,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  { label: "Provoz", items: [["/admin", "Přehled", Home], ["/admin/calendar", "Kalendář", CalendarDays], ["/admin/reservations", "Rezervace", ListChecks], ["/admin/schedule", "Otevírací doba a bloky", Clock3], ["/admin/entry-log", "Kniha vstupů", KeyRound]] },
  { label: "Lidé", items: [["/admin/members", "Členové", Users], ["/admin/memberships", "Vstupné a věrnost", Tags], ["/admin/messages", "Doručené zprávy", MessageCircle]] },
  { label: "Obsah", items: [["/admin/content", "Obsah webu", FileText], ["/admin/settings", "Nastavení a branding", Settings]] },
  { label: "Systém", items: [["/admin/statistics", "Statistiky", ChartNoAxesColumnIncreasing], ["/admin/alerts", "Upozornění", Bell], ["/admin/inspirations", "Inspirace", Lightbulb], ["/admin/plan", "Plán spuštění", Rocket]] },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 text-sm lg:mt-6 lg:grid lg:gap-[18px] lg:overflow-visible">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="contents lg:block">
          <div className="mb-1 hidden px-2.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-white/35 lg:block">{group.label}</div>
          <div className="flex gap-1 lg:grid lg:gap-px">
            {group.items.map(([href, label, Icon]) => {
              const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2.5 whitespace-nowrap rounded-[9px] px-2.5 py-2 text-[13px] font-semibold transition-colors", active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[.08] hover:text-white")}>
                  <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-white/40")} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
