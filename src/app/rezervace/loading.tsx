import {
  CalendarSkeleton,
  PageIntroSkeleton,
  PublicHeaderSkeleton,
} from "@/components/site/loading-skeletons";
import { Container, Section } from "@/components/ui/container";

export default function BookingLoading() {
  return (
    <>
      <PublicHeaderSkeleton />
      <main tabIndex={-1} aria-busy="true" aria-live="polite">
        <span className="sr-only">Načítání rezervačního kalendáře</span>
        <Section className="pb-28 pt-12 sm:pt-16">
          <Container>
            <PageIntroSkeleton />
            <CalendarSkeleton className="mt-10" />
          </Container>
        </Section>
      </main>
    </>
  );
}
