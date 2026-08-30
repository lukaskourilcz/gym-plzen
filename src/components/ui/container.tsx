import * as React from "react";
import { cn } from "@/lib/utils";

/** Centered max-width content wrapper used across the public site. */
export function Container({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1200px] px-5 sm:px-6", className)}
      {...props}
    />
  );
}

/**
 * A vertical page section with consistent spacing and an optional id anchor.
 * Spacing comes from the design-variant tokens, whose classic values are the
 * approved `py-20 sm:py-24`; the modern variant breathes wider.
 */
export function Section({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "py-[var(--section-space)] sm:py-[var(--section-space-lg)]",
        className,
      )}
      {...props}
    />
  );
}
