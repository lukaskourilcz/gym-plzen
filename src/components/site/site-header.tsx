"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/site/brand";
import { cn } from "@/lib/utils";
import { PUBLIC_NAV } from "@/lib/config/navigation";

/** Public navigation: lotus plus wordmark on the left, booking action first. */
export function SiteHeader({
  brand = "NAMASTÉ Private Gym",
  accountHref = "/login",
  accountLabel = "Přihlásit se",
}: {
  brand?: string;
  logoUrl?: string | null;
  accountHref?: string;
  accountLabel?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      document.getElementById("public-menu-toggle")?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      {/* Deliberately not inside `Container`: the brand sits in the very left
          corner and the actions in the very right one, at full viewport width. */}
      {/* Three tracks from `lg`: brand hard left, links centred, actions hard
          right. Equal 1fr side tracks are what keeps the nav optically centred. */}
      <div className="flex min-h-[78px] items-center justify-between gap-3 px-4 sm:px-5 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        {/*
         * `scroll={false}` plus an explicit jump to the document top: the router
         * picks the first non-sticky element as its scroll target, skips this
         * sticky header, and lands on `main` : leaving the page 68px short of
         * the top on a same-page click.
         */}
        <Link
          href="/"
          scroll={false}
          onClick={() => window.scrollTo({ top: 0 })}
          aria-label={`${brand}, úvodní stránka`}
          className="flex min-h-11 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <BrandLogo />
        </Link>

        <nav
          aria-label="Hlavní navigace"
          data-testid="desktop-navigation"
          className="hidden items-center justify-between lg:flex lg:w-[min(42vw,42rem)]"
        >
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="flex min-h-11 items-center px-2 text-sm font-bold uppercase tracking-[.09em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:justify-self-end">
          {/* Visible at every width: on mobile the hero no longer carries a
              booking action of its own above the fold. */}
          <Button
            href="/rezervace"
            size="sm"
            className="px-3 uppercase tracking-[.04em] sm:px-4 sm:tracking-[.1em]"
          >
            Rezervovat
          </Button>
          <Button
            href={accountHref}
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            {accountLabel}
          </Button>
          <Button
            id="public-menu-toggle"
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            disabled={!ready}
            data-ready={ready ? "true" : "false"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Zavřít menu" : "Otevřít menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </div>

      <div
        id="mobile-menu"
        className={cn(
          "border-t border-border bg-background lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <div className="grid gap-1 px-4 py-3 sm:px-5">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center border-b border-border/60 px-1 text-base font-bold uppercase tracking-[.08em] last:border-0"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button href="/rezervace" className="uppercase tracking-[.08em]">
              Rezervovat
            </Button>
            <Button href={accountHref} variant="outline">
              {accountLabel}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
