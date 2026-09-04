import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Brand artwork.
 *
 * The supplied NAVI artwork is gold, which reads at roughly 1.9:1 on the cream
 * page background. Every part is therefore rendered as a CSS mask tinted with
 * `currentColor`, so a surface picks the treatment the design system requires:
 * `accent-foreground` green on light, `gold` on ink. The silhouettes are the
 * client's own artwork; nothing here redraws it.
 */
const BRAND_MARK_ASSET = "/images/navi-mark.png";
const BRAND_WORDMARK_ASSET = "/images/navi-wordmark.png";
const BRAND_LOCKUP_ASSET = "/images/navi-logo.png";

function maskStyle(asset: string): CSSProperties {
  return {
    backgroundColor: "currentColor",
    WebkitMaskImage: `url("${asset}")`,
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskImage: `url("${asset}")`,
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
  };
}

const MARK_STYLE = maskStyle(BRAND_MARK_ASSET);
const WORDMARK_STYLE = maskStyle(BRAND_WORDMARK_ASSET);
const LOCKUP_STYLE = maskStyle(BRAND_LOCKUP_ASSET);

/**
 * The kettlebell-and-N symbol on its own: a supporting interface motif, not
 * the primary lockup. Never smaller than 32 CSS pixels.
 */
export function BrandMark({
  className,
  title = "NAVI",
  decorative = false,
}: {
  className?: string;
  title?: string;
  /** Hide from assistive tech when the surrounding text already names it. */
  decorative?: boolean;
}) {
  return (
    <span
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": title })}
      data-brand="mark"
      className={cn(
        "inline-block size-10 shrink-0 text-accent-foreground",
        className,
      )}
      style={MARK_STYLE}
    />
  );
}

/**
 * Navigation lockup: the symbol beside the wordmark. Both are masks, so the
 * whole logo takes the colour of its surface.
 */
export function BrandLogo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      data-brand="logo"
      className={cn(
        "inline-flex shrink-0 items-center gap-2 text-accent-foreground sm:gap-2.5",
        className,
      )}
    >
      {/* 377x486 artwork: 34px wide is 44px tall, clearing the 32px floor. */}
      <span
        aria-hidden
        className={cn(
          "block aspect-[377/486]",
          compact ? "w-[26px]" : "w-[30px] sm:w-[34px]",
        )}
        style={MARK_STYLE}
      />
      {/*
       * The header carries a permanent booking button, and below 380px the
       * lockup, the button and the menu toggle cannot all fit. The wordmark
       * drops out there rather than shrinking `PRIVATE GYM` to a smear; the
       * symbol carries the brand alone at those widths.
       */}
      <span
        aria-hidden
        className={cn(
          "block aspect-[638/203]",
          compact ? "w-[76px]" : "w-[100px] max-[379px]:hidden sm:w-[116px]",
        )}
        style={WORDMARK_STYLE}
      />
    </span>
  );
}

/**
 * The full stacked lockup, used where the brand is the primary element of the
 * surface (footer, authentication) rather than a navigation item.
 */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span
      data-brand="lockup"
      className={cn(
        "inline-flex w-[150px] items-center text-accent-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className="block aspect-[638/756] w-full"
        style={LOCKUP_STYLE}
      />
    </span>
  );
}
