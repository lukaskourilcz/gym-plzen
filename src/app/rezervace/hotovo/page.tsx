import type { Metadata } from "next";
import { CheckCircle2, Clock3, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { booking } from "@/lib/services";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Stav rezervace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function BookingDonePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; reservation_id?: string }>;
}) {
  const user = await requireUser("/rezervace/hotovo");
  const params = await searchParams;
  const [content, confirmation] = await Promise.all([
    loadSiteContent(),
    booking.getBookingConfirmation({
      userId: user.id,
      stripeSessionId: params.session_id,
      reservationId: params.reservation_id,
    }),
  ]);

  const state = {
    confirmed: {
      icon: CheckCircle2,
      title: "Rezervace je potvrzená",
      body: "Termín najdete ve svém účtu. Pokyny ke vstupu obdržíte před návštěvou.",
    },
    processing: {
      icon: Clock3,
      title: "Platbu ještě ověřujeme",
      body: "Potvrzení může krátce trvat. Stav zkontrolujte ve svém účtu a platbu neopakujte.",
    },
    invalid: {
      icon: TriangleAlert,
      title: "Potvrzení se nepodařilo ověřit",
      body: "Adresa stránky sama o sobě nepotvrzuje platbu. Zkontrolujte své rezervace v účtu.",
    },
  }[confirmation.state];
  const Icon = state.icon;

  return (
    <>
      <SiteHeader
        brand={content.get("brand.name")}
        accountHref="/account"
        accountLabel="Můj účet"
      />
      <main id="main-content" tabIndex={-1}>
        <Section>
          <Container className="max-w-xl text-center">
            <Icon
              aria-hidden="true"
              className="mx-auto size-14 text-accent-foreground"
            />
            <h1 className="mt-5 text-3xl font-black tracking-tight">
              {state.title}
            </h1>
            <p className="mt-4 leading-7 text-muted-foreground">{state.body}</p>
            {confirmation.state === "processing" ? (
              <Notice className="mt-7 text-left" role="status">
                Stripe odešle konečný stav zabezpečeným webhookem.
              </Notice>
            ) : null}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button href="/account">Můj účet</Button>
              <Button href="/rezervace" variant="outline">
                Další rezervace
              </Button>
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
