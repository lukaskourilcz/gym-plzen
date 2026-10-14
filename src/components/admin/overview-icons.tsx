"use client";

import Link from "next/link";
import { CalendarDays, Check, UserRound, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function OverviewStatus({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  const Icon = active ? Check : X;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="img"
          aria-label={label}
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-md",
            active ? "text-success" : "text-muted-foreground",
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="admin-note-tooltip">{label}</TooltipContent>
    </Tooltip>
  );
}
export function OverviewIconLink({
  href,
  kind,
}: {
  href: string;
  kind: "reservation" | "profile";
}) {
  const label = kind === "reservation" ? "Rezervace" : "Profil zákazníka";
  const Icon = kind === "reservation" ? CalendarDays : UserRound;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-label={label}
          className="inline-flex size-11 items-center justify-center rounded-md text-accent-foreground hover:bg-muted active:bg-muted"
        >
          <Icon aria-hidden="true" className="size-4" />
        </Link>
      </TooltipTrigger>
      <TooltipContent className="admin-note-tooltip">{label}</TooltipContent>
    </Tooltip>
  );
}
