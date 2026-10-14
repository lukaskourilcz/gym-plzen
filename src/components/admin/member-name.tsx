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
}: {
  name: string;
  note?: string | null;
  href?: string;
  className?: string;
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
