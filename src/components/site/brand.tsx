import Image from "next/image";
import { cn } from "@/lib/utils";

const BRAND_ASSET = "/images/namaste-logo.png";
const BRAND_LOTUS_ASSET = "/images/namaste-lotus.png";
const BRAND_WORDMARK_ASSET = "/images/namaste-wordmark.png";

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
    <svg
      viewBox="0 0 48 48"
      {...(decorative
        ? { "aria-hidden": true, focusable: false }
        : { role: "img", "aria-label": title })}
      className={cn("size-10", className)}
    >
      <path
        d="M24 7c-4.7 5.3-7 10-7 14.1 0 3.6 2.5 6.4 7 8.5 4.5-2.1 7-4.9 7-8.5C31 17 28.7 12.3 24 7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 16.5c-5.4 1.7-8.8 4.8-10.2 9.4 3.4 4.7 8 7.2 13.8 7.5M30.5 16.5c5.4 1.7 8.8 4.8 10.2 9.4-3.4 4.7-8 7.2-13.8 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 34.5c4 4.3 8.3 6.5 13 6.5s9-2.2 13-6.5M24 29.5V41"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
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
