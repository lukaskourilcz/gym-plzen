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

/** Mirrors the real two-column date-and-time chooser at every breakpoint. */
export function CalendarSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.78fr)] lg:gap-12",
        className,
      )}
    >
      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-8 w-44" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="size-11" />
            <Skeleton className="size-11" />
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-card p-2 shadow-sm sm:p-4">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton key={index} className="mx-auto my-3 h-2 w-5" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }, (_, index) => (
              <Skeleton
                key={index}
                className="aspect-square min-h-11 w-full bg-muted/80"
              />
            ))}
          </div>
          <Skeleton className="mt-4 h-4 w-52 border-t border-border pt-4" />
        </div>
      </section>

      <section className="lg:pt-[4.75rem]">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="mt-3 h-8 w-40" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
        <div className="mt-6 border-t border-border pt-5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </div>
      </section>
    </div>
  );
}
