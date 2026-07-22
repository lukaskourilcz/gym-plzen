"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { LotusMark } from "@/components/site/brand";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/#jak-to-funguje", label: "Jak to funguje" },
  { href: "/#cenik", label: "Ceník" },
  { href: "/vybaveni", label: "Vybavení" },
  { href: "/faq", label: "FAQ" },
  { href: "/#kontakt", label: "Kontakt" },
];

/** Public navigation. The header intentionally uses the lotus symbol only. */
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

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <Container className="flex min-h-[68px] items-center justify-between gap-3">
        <Link
          href="/"
          aria-label={`${brand}, úvodní stránka`}
          className="grid size-11 place-items-center rounded-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <LotusMark className="size-9" />
        </Link>

        <nav
          aria-label="Hlavní navigace"
          className="hidden items-center gap-1 lg:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="flex min-h-11 items-center px-3 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            href={accountHref}
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          >
            {accountLabel}
          </Button>
          <Button
            href="/rezervace"
            size="sm"
            variant="ink"
            className="hidden text-primary sm:inline-flex"
          >
            Rezervovat
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Zavřít menu" : "Otevřít menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
        </div>
      </Container>

      <div
        id="mobile-menu"
        className={cn(
          "border-t border-border bg-background lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <Container className="grid gap-1 py-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center border-b border-border/60 px-1 text-base font-bold last:border-0"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button href={accountHref} variant="outline">
              {accountLabel}
            </Button>
            <Button href="/rezervace" variant="ink" className="text-primary">
              Rezervovat
            </Button>
          </div>
        </Container>
      </div>
    </header>
  );
}
