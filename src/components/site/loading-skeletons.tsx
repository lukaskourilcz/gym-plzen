import { BrandLogo } from "@/components/site/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Keeps the public navigation silhouette stable while its server data loads. */
export function PublicHeaderSkeleton() {
  return (
    <header
      aria-hidden="true"
      className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur"
    >
      <div className="flex min-h-[78px] items-center justify-between gap-2 px-4 sm:gap-3 sm:px-5 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <BrandLogo />
        <div className="hidden items-center justify-between lg:flex lg:w-[min(42vw,42rem)]">
          {["w-16", "w-14", "w-12", "w-10", "w-12"].map((width, index) => (
            <Skeleton key={index} className={cn("h-3", width)} />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:justify-self-end">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="hidden h-11 w-28 sm:block" />
          <Skeleton className="size-11 lg:hidden" />
        </div>
      </div>
    </header>
  );
}

export function PageIntroSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("max-w-2xl", compact && "max-w-xl")} aria-hidden="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-11 w-full max-w-md sm:h-14" />
      <Skeleton className="mt-5 h-4 w-full max-w-xl" />
      <Skeleton className="mt-2 h-4 w-4/5 max-w-lg" />
    </div>
  );
}
