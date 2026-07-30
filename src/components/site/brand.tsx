import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const BRAND_ASSET = "/images/namaste-logo.png";
const BRAND_LOTUS_ASSET = "/images/namaste-lotus.png";
const BRAND_WORDMARK_ASSET = "/images/namaste-wordmark.png";
const LOTUS_MASK_STYLE = {
  backgroundColor: "currentColor",
  WebkitMaskImage: `url("${BRAND_LOTUS_ASSET}")`,
  WebkitMaskPosition: "center",
  WebkitMaskRepeat: "no-repeat",
  WebkitMaskSize: "contain",
  maskImage: `url("${BRAND_LOTUS_ASSET}")`,
  maskPosition: "center",
  maskRepeat: "no-repeat",
  maskSize: "contain",
} satisfies CSSProperties;

export function LotusMark({
  className,
  title = "NAMASTÉ",
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
      className={cn("inline-block size-10 shrink-0", className)}
      style={LOTUS_MASK_STYLE}
    />
  );
}

export function BrandLogo({
  className,
  inverse = false,
  compact = false,
}: {
  className?: string;
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src={BRAND_LOTUS_ASSET}
        alt=""
        width={460}
        height={289}
        priority
        className={cn(
          "h-auto object-contain",
          compact ? "w-10" : "w-[54px]",
          inverse && "brightness-0 invert",
        )}
      />
      <Image
        src={BRAND_WORDMARK_ASSET}
        alt=""
        width={712}
        height={241}
        priority
        className={cn(
          "h-auto object-contain",
          compact ? "w-[76px]" : "w-[116px]",
          inverse && "brightness-0 invert",
        )}
      />
    </span>
  );
}

/**
 * Full client-supplied lockup. Used where the brand is the primary element of
 * the surface (footer and authentication) rather than a navigation item.
 */
export function BrandLockup({
  className,
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src={BRAND_ASSET}
        alt=""
        width={720}
        height={536}
        className={cn(
          "h-auto w-[190px] object-contain",
          inverse && "brightness-0 invert",
        )}
      />
    </span>
  );
}
