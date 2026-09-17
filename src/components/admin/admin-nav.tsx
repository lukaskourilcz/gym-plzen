"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  Clock3,
  FileText,
  History,
  Home,
  KeyRound,
  ListChecks,
  Mail,
  MessageCircle,
  Palette,
  ReceiptText,
  Settings,
  Tags,
  TicketPercent,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavigationItemActive } from "@/lib/navigation";

const NAV_GROUPS = [
  {
    label: "Provoz",
    items: [
      ["/admin", "Dnes", Home],
      ["/admin/calendar", "Kalendář", CalendarDays],
      ["/admin/reservations", "Rezervace", ListChecks],
      ["/admin/schedule", "Otevírací doba a bloky", Clock3],
      ["/admin/entry-log", "Kniha vstupů", KeyRound],
    ],
  },
  {
    label: "Lidé",
    items: [
      ["/admin/members", "Členové", Users],
      ["/admin/memberships", "Vstupné a věrnost", Tags],
      ["/admin/vouchers", "Vouchery", TicketPercent],
      ["/admin/doklady", "Doklady", ReceiptText],
      ["/admin/messages", "Odeslané zprávy", MessageCircle],
    ],
  },
  {
    label: "Obsah",
    items: [
      ["/admin/content", "Obsah webu", FileText],
      ["/admin/emails", "E-maily", Mail],
      ["/admin/newsletter", "Odběratelé novinek", Mail],
      ["/admin/settings", "Nastavení a branding", Settings],
      ["/admin/design-system", "Design systém", Palette],
    ],
  },
  {
    label: "Systém",
    items: [
      ["/admin/statistics", "Statistiky", ChartNoAxesColumnIncreasing],
      ["/admin/activity", "Historie akcí", History],
      ["/admin/alerts", "Upozornění", Bell],
    ],
  },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const activeLabel = NAV_GROUPS.reduce<string | undefined>(
    (label, group) =>
      label ??
      group.items.find(([href]) => isNavigationItemActive(pathname, href))?.[1],
    undefined,
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <nav
      className="mt-4 text-sm lg:mt-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      aria-label="Administrace"
    >
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls="admin-navigation"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between rounded-md border border-white/15 px-3 text-left font-bold text-white lg:hidden"
      >
        <span>
          Menu administrace
          {activeLabel ? (
            <span className="ml-2 font-medium text-white/60">
              {activeLabel}
            </span>
          ) : null}
        </span>
        {open ? (
          <X aria-hidden="true" className="size-4" />
        ) : (
          <ChevronDown aria-hidden="true" className="size-4" />
        )}
      </button>

      <div
        id="admin-navigation"
        className={cn(
          "mt-3 gap-[18px] border-t border-white/10 pt-4 lg:mt-0 lg:grid lg:border-0 lg:pt-0",
          open ? "grid" : "hidden",
        )}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="mb-1 px-2.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-white/45">
              {group.label}
            </div>
            <div className="grid gap-px">
              {group.items.map(([href, label, Icon]) => {
                const active = isNavigationItemActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-semibold transition-colors",
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:bg-white/[.08] hover:text-white",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0",
                        active ? "text-gold" : "text-white/50",
                      )}
                    />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
