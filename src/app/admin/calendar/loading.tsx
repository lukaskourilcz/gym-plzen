import { Skeleton } from "@/components/ui/skeleton";

export default function AdminCalendarLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Načítání administračního kalendáře</span>
      <div className="mb-6">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        <Skeleton className="mt-2 h-4 w-3/5 max-w-lg" />
      </div>

      <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <Skeleton className="h-7 w-44 sm:order-2 sm:justify-self-center" />
          <div className="order-2 flex gap-2 sm:order-1">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-16" />
          </div>
          <div className="order-3 grid grid-cols-3 gap-1 sm:flex">
            <Skeleton className="h-10 w-full sm:w-16" />
            <Skeleton className="h-10 w-full sm:w-16" />
            <Skeleton className="h-10 w-full sm:w-16" />
          </div>
        </div>

        <div
          aria-hidden="true"
          className="mt-4 animate-[skeleton-pulse_2.2s_ease-in-out_infinite] overflow-hidden rounded-sm border border-border motion-reduce:animate-none sm:hidden"
        >
          <div className="grid grid-cols-[3.5rem_1fr] bg-muted/40">
            <div className="h-11 border-b border-r border-border bg-muted/70" />
            <div className="h-11 border-b border-border bg-muted/70" />
          </div>
          {Array.from({ length: 10 }, (_, row) => (
            <div key={row} className="grid grid-cols-[3.5rem_1fr]">
              <div className="h-16 border-b border-r border-border bg-card" />
              <div className="h-16 border-b border-border bg-card" />
            </div>
          ))}
        </div>

        <div
          aria-hidden="true"
          className="mt-4 hidden animate-[skeleton-pulse_2.2s_ease-in-out_infinite] overflow-hidden rounded-sm border border-border motion-reduce:animate-none sm:block"
        >
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(4rem,1fr))] bg-muted/40">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="h-11 border-b border-r border-border bg-muted/70 last:border-r-0"
              />
            ))}
          </div>
          {Array.from({ length: 10 }, (_, row) => (
            <div
              key={row}
              className="grid grid-cols-[3.5rem_repeat(7,minmax(4rem,1fr))]"
            >
              {Array.from({ length: 8 }, (_, column) => (
                <div
                  key={column}
                  className="h-16 border-b border-r border-border bg-card last:border-r-0"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
