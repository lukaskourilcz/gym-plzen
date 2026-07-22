import { cn } from "@/lib/utils";

export function LotusMark({
  className,
  title = "NAMASTÉ",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
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
  brand = "NAMASTÉ Private Gym",
  className,
  inverse = false,
}: {
  brand?: string;
  className?: string;
  inverse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-3",
        inverse ? "text-white" : "text-foreground",
        className,
      )}
    >
      <LotusMark className="text-primary" />
      <span className="leading-none">
        <strong className="block text-base font-extrabold tracking-[0.08em]">
          NAMASTÉ
        </strong>
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] opacity-65">
          Private Gym
        </span>
      </span>
      <span className="sr-only">{brand}</span>
    </span>
  );
}
