import { PublicHeaderSkeleton } from "@/components/site/loading-skeletons";
import { Container, Section } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function BookingDetailsLoading() {
  return (
    <>
      <PublicHeaderSkeleton />
      <main tabIndex={-1} aria-busy="true" aria-live="polite">
        <span className="sr-only">Načítání údajů rezervace</span>
        <Section className="pb-24 pt-12 sm:pt-16">
          <Container className="max-w-2xl">
            <Skeleton className="h-11 w-48" />
            <Skeleton className="mt-3 h-11 w-full max-w-lg sm:h-14" />
            <div className="mt-7 flex min-h-24 items-center gap-4 rounded-lg border border-border bg-card p-5">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="mt-3 h-3 w-32" />
              </div>
            </div>
            <div className="mt-8 grid gap-5 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index}>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-11 w-full" />
                </div>
              ))}
              <Skeleton className="h-11 w-full sm:col-span-2" />
            </div>
          </Container>
        </Section>
      </main>
    </>
  );
}
