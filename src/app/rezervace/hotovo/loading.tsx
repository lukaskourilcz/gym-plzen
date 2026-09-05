import { PublicHeaderSkeleton } from "@/components/site/loading-skeletons";
import { Container, Section } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function BookingConfirmationLoading() {
  return (
    <>
      <PublicHeaderSkeleton />
      <main tabIndex={-1} aria-busy="true" aria-live="polite">
        <span className="sr-only">Ověřování stavu rezervace</span>
        <Section>
          <Container className="max-w-xl text-center">
            <Skeleton className="mx-auto size-14 rounded-full" />
            <Skeleton className="mx-auto mt-5 h-9 w-72 max-w-full" />
            <Skeleton className="mx-auto mt-5 h-4 w-full max-w-md" />
            <Skeleton className="mx-auto mt-2 h-4 w-4/5 max-w-sm" />
            <div className="mt-8 flex justify-center gap-3">
              <Skeleton className="h-11 w-28" />
              <Skeleton className="h-11 w-36" />
            </div>
          </Container>
        </Section>
      </main>
    </>
  );
}
