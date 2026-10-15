"use client";

import { useState } from "react";
import Link from "next/link";
import { StickyNote } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Only admin readers pass the private note; never infer identity from a name. */
export function AdminMemberName({
  name,
  note,
  href,
  className,
  nameHint,
}: {
  name: string;
  note?: string | null;
  href?: string;
  className?: string;
  nameHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const text = note?.trim();
  return (
    <span className={cn("inline-flex max-w-full items-start gap-1", className)}>
      {href ? (
        <Link
          href={href}
          className="min-w-0 font-semibold text-accent-foreground hover:underline"
        >
          {name}
        </Link>
      ) : nameHint ? (
        <NameHint name={name} hint={nameHint} />
      ) : (
        <span className="min-w-0">{name}</span>
      )}
      {text ? (
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Poznámka k zákazníkovi ${name}`}
              className="-mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-current opacity-80 hover:bg-secondary hover:text-secondary-foreground hover:opacity-100"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen((current) => !current);
              }}
            >
              <StickyNote className="size-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            className="admin-note-tooltip whitespace-pre-wrap"
            align="end"
          >
            {text}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}

/** A separate trigger keeps the reservation hint and private note independent. */
function NameHint({ name, hint }: { name: string; hint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={name}
          className="min-w-0 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            // Touch can focus (and open) before click. Keep the first tap open.
            setOpen(true);
          }}
        >
          {name}
        </button>
      </TooltipTrigger>
      <TooltipContent className="admin-note-tooltip">{hint}</TooltipContent>
    </Tooltip>
  );
}
