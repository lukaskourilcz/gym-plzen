import { cn } from "@/lib/utils";

/**
 * Code-owned social glyphs. Lucide dropped brand icons, so these are drawn on
 * the same 24px grid with the same 2px round stroke to sit with the Lucide set.
 * Decorative by default : the surrounding link carries the accessible name.
 */
const base = "size-5 shrink-0";
const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn(base, className)}
    >
      <path
        {...strokeProps}
        d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v4H9v7h4v-7h2.5l.5-4H13V7a1 1 0 0 1 1-1h2V3Z"
      />
    </svg>
  );
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn(base, className)}
    >
      <rect {...strokeProps} x="3" y="3" width="18" height="18" rx="5" />
      <circle {...strokeProps} cx="12" cy="12" r="3.8" />
      <circle cx="17.1" cy="6.9" r="1.2" fill="currentColor" />
    </svg>
  );
}
