import type { Metadata } from "next";
import { CheckCircle2, Clock3, TriangleAlert } from "lucide-react";
import { getSession } from "@/lib/auth/guards";
import { booking, loyalty } from "@/lib/services";
import {
  footerProps,
  loadSiteContent,
  publicAddress,
} from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { BookingConversionTracker } from "@/components/site/booking-conversion-tracker";
import { CalendarActions } from "@/components/site/calendar-actions";

export const metadata: Metadata = {
  title: "Stav rezervace",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function BookingDonePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; reservation_id?: string }>;
}) {
  // Guests prove access with a random confirmation token.
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const [content, confirmation] = await Promise.all([
    loadSiteContent(),
    booking.getBookingConfirmation({
      userId: session?.user.id ?? null,
      token: params.token,
      reservationId: params.reservation_id,
    }),
  ]);

  /*
   * Loyalty is members-only, and only worth showing once the reservation is
   * actually confirmed : it is already counted by then, so the sentence reads
   * "this was your Nth visit".
   */
  const loyaltySentence =
    session && confirmation.state === "confirmed"
      ? loyalty.loyaltyProgressSentence(
          await loyalty.getLoyaltyStatus(session.user.id),
        )
      : "";

  const state = {
    confirmed: {
      icon: CheckCircle2,
      title: "Rezervace je potvrzená",
      body: session
        ? "Termín najdete ve svém účtu. Pokyny ke vstupu obdržíte před návštěvou."
        : "Potvrzení jsme poslali na váš e-mail. Pokyny ke vstupu obdržíte před návštěvou e-mailem.",
    },
    cancelled: {
      icon: TriangleAlert,
      title: "Rezervace byla zrušena",
      body: "Tento termín už není potvrzený. Pokud jste platbu odeslali, kontaktujte nás a neopakujte ji.",
    },
    processing: {
      icon: Clock3,
      title: "Platbu ještě ověřujeme",
      body: session
        ? "Potvrzení může krátce trvat. Stav zkontrolujte ve svém účtu a platbu neopakujte."
        : "Potvrzení může krátce trvat. Přijde vám e-mailem, platbu prosím neopakujte.",
    },
    invalid: {
      icon: TriangleAlert,
      title: "Potvrzení se nepodařilo ověřit",
      body: session
        ? "Adresa stránky sama o sobě nepotvrzuje platbu. Zkontrolujte své rezervace v účtu."
        : "Adresa stránky sama o sobě nepotvrzuje platbu. Zkontrolujte prosím e-mail s potvrzením.",
    },
  }[confirmation.state];
  const Icon = state.icon;

  return (
    <>
      <SiteHeader
        brand={content.get("brand.name")}
        accountHref={session ? "/account" : "/login"}
        accountLabel={session ? "Můj účet" : "Přihlásit se"}
      />
      {confirmation.state === "confirmed" ? (
        <BookingConversionTracker
          reservationId={confirmation.reservationId}
          priceCents={confirmation.priceCents}
          currency={confirmation.currency}
        />
      ) : null}
      <main id="main-content" tabIndex={-1}>
        <Section>
          <Container className="max-w-xl text-center">
            <Icon
              aria-hidden="true"
              className="mx-auto size-14 text-accent-foreground"
            />
            <h1 className="mt-5 text-3xl font-extrabold tracking-[-.01em]">
              {state.title}
            </h1>
            <p className="mt-4 leading-7 text-muted-foreground">{state.body}</p>
            {loyaltySentence ? (
              <p className="mt-4 font-bold text-accent-foreground">
                {loyaltySentence}
              </p>
            ) : null}
            {confirmation.state === "processing" ? (
              <Notice className="mt-7 text-left" role="status">
                Stav platby průběžně ověřujeme. Platbu prosím neopakujte.
              </Notice>
            ) : null}
            {confirmation.state === "confirmed" ? (
              <CalendarActions
                className="mt-7 justify-center"
                reservationId={confirmation.reservationId}
                startsAt={confirmation.startsAt}
                endsAt={confirmation.endsAt}
                address={publicAddress(content.get("contact.address"))}
              />
            ) : null}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {confirmation.state === "processing" ? (
                <Button
                  href={`/rezervace/hotovo?${new URLSearchParams({ reservation_id: confirmation.reservationId, ...(params.token ? { token: params.token } : {}) })}`}
                  variant="outline"
                >
                  Ověřit stav platby
                </Button>
              ) : null}
              {session ? <Button href="/account">Můj účet</Button> : null}
              <Button
                href="/rezervace"
                variant={session ? "outline" : "default"}
              >
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
