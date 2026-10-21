"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Ban,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CircleHelp,
  ChevronDown,
  Clock3,
  FileText,
  Eye,
  HandCoins,
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
    label: "Každý den",
    items: [
      ["/admin", "Dnes", Home],
      ["/admin/tomorrow", "Zítra", CalendarDays],
      ["/admin/calendar", "Kalendář", CalendarDays],
      ["/admin/blocking", "Blokování termínů", Ban],
      ["/admin/reservations", "Rezervace", ListChecks],
    ],
  },
  {
    label: "Zákazníci a ceny",
    items: [
      ["/admin/memberships", "Ceník a doprovod", Tags],
      ["/admin/members", "Členové", Users],
      ["/admin/vouchers", "Vouchery", TicketPercent],
      ["/admin/doklady", "Doklady", ReceiptText],
      ["/admin/finance", "Finance", HandCoins],
    ],
  },
  {
    label: "Web a komunikace",
    items: [
      ["/admin/content", "Obsah webu", FileText],
      ["/customer-preview", "Ukázat web jako registrovaný zákazník", Eye],
      ["/admin/emails", "E-maily", Mail],
      ["/admin/newsletter", "Odběratelé novinek", Mail],
    ],
  },
  {
    label: "Další nástroje",
    collapsible: true,
    items: [
      ["/admin/schedule", "Otevírací doba a bloky", Clock3],
      ["/admin/settings", "Nastavení a branding", Settings],
      ["/admin/access-codes", "Vstupní kódy", KeyRound],
      ["/admin/entry-log", "Kniha vstupů", KeyRound],
      ["/admin/messages", "Odeslané zprávy", MessageCircle],
      ["/admin/alerts", "Upozornění", Bell],
      ["/admin/statistics", "Statistiky", ChartNoAxesColumnIncreasing],
      ["/admin/activity", "Historie akcí", History],
      ["/admin/how-it-works", "Jak co funguje?", CircleHelp],
      ["/admin/design-system", "Design systém", Palette],
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
            <span className="ml-2 font-medium text-white/80">
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
        {NAV_GROUPS.map((group) => {
          const links = (
            <div className="grid gap-px">
              {group.items.map(([href, label, Icon]) => {
                const active = isNavigationItemActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    target={href === "/customer-preview" ? "_blank" : undefined}
                    rel={
                      href === "/customer-preview"
                        ? "noopener noreferrer"
                        : undefined
                    }
                    prefetch={href === "/customer-preview" ? false : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold transition-colors",
                      active
                        ? "bg-white/15 text-white"
                        : "text-white/80 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0",
                        active ? "text-gold" : "text-white/75",
                      )}
                    />
                    {label}
                  </Link>
                );
              })}
            </div>
          );
          if ("collapsible" in group)
            return (
              <details
                key={group.label}
                open={
                  group.items.some(([href]) =>
                    isNavigationItemActive(pathname, href),
                  ) || undefined
                }
              >
                <summary className="min-h-11 cursor-pointer rounded-md px-2.5 py-3 font-semibold text-white/80 hover:bg-white/10">
                  {group.label}
                </summary>
                {links}
              </details>
            );
          return (
            <div key={group.label}>
              <div className="mb-1 px-2.5 text-xs font-extrabold uppercase tracking-[.14em] text-white/75">
                {group.label}
              </div>
              {links}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
