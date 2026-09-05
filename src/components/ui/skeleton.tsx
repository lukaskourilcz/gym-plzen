import * as React from "react";
import { cn } from "@/lib/utils";

/** A quiet, shape-preserving loading placeholder. Parent regions name the wait. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn(
        "animate-[skeleton-pulse_2.2s_ease-in-out_infinite] rounded-sm bg-muted motion-reduce:animate-none",
        className,
      )}
    />
  );
}
