import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      tabIndex={-1}
      className="mx-auto min-h-[60vh] max-w-[1200px] px-5 py-16"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Načítání stránky</span>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-5 h-12 w-full max-w-xl" />
      <Skeleton className="mt-4 h-4 w-full max-w-2xl" />
      <Skeleton className="mt-2 h-4 w-3/5 max-w-lg" />
      <div className="mt-10 grid gap-4 md:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-card p-5"
          >
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="mt-5 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-4/5" />
          </div>
        ))}
      </div>
    </main>
  );
}
