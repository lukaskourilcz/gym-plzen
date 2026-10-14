"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** A controlled, keyboard-operable admin switch with a 44px touch target. */
export function AdminSwitch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(
        "inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-md disabled:cursor-wait disabled:opacity-50",
        className,
      )}
      onClick={() => onCheckedChange?.(!checked)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-6 w-11 items-center rounded-full p-0.5 transition-colors motion-reduce:transition-none",
          checked ? "bg-primary" : "bg-muted-foreground",
        )}
      >
        <span
          className={cn(
            "size-5 rounded-full bg-card shadow-sm transition-transform motion-reduce:transition-none",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}
