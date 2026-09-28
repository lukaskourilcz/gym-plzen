import type { Metadata } from "next";
import {
  CalendarPlus,
  CheckCircle2,
  Clock3,
  TriangleAlert,
} from "lucide-react";
import { getSession } from "@/lib/auth/guards";
import { booking, loyalty, orders } from "@/lib/services";
import {
  footerProps,
  loadSiteContent,
  publicAddress,
} from "@/lib/content/site";
import { formatMoney, formatTimeRange } from "@/lib/helpers/format";
import { Container, Section } from "@/components/ui/container";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

interface ConfirmedSlot {
  reservationId: string;
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
  loyaltyReward: number | null;
}

type View =
  | {
      state: "confirmed";
      transactionId: string;
      totalCents: number;
      currency: string;
      slots: ConfirmedSlot[];
      orderId: string | null;
    }
  | { state: "processing"; retryHref: string }
  | { state: "cancelled" | "invalid" };

const dayFormat = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Prague",
});

/**
 * The status of a booking after checkout. An order (one or more slots paid
 * together) is identified by `order_id`; `reservation_id` is the older
 * single-slot form, kept for links and payment returns made before orders.
 * Guests prove access with the random confirmation token.
 */
async function resolveView(params: {
  userId: string | null;
  orderId?: string;
  reservationId?: string;
  token?: string;
}): Promise<View> {
  const tokenParam: Record<string, string> = params.token
    ? { token: params.token }
    : {};
  if (params.orderId) {
    const confirmation = await orders.getOrderConfirmation(params);
    if (confirmation.state === "confirmed")
      return {
        state: "confirmed",
        transactionId: confirmation.orderId,
        totalCents: confirmation.totalCents,
        currency: confirmation.currency,
        slots: confirmation.slots,
        orderId: confirmation.orderId,
      };
    if (confirmation.state === "processing")
      return {
        state: "processing",
        retryHref: `/rezervace/hotovo?${new URLSearchParams({ order_id: confirmation.orderId, ...tokenParam })}`,
      };
    return { state: confirmation.state };
  }
  const confirmation = await booking.getBookingConfirmation(params);
  if (confirmation.state === "confirmed")
    return {
      state: "confirmed",
      transactionId: confirmation.reservationId,
      totalCents: confirmation.priceCents,
      currency: confirmation.currency,
      orderId: null,
      slots: [
        {
          reservationId: confirmation.reservationId,
          startsAt: confirmation.startsAt,
          endsAt: confirmation.endsAt,
          priceCents: confirmation.priceCents,
          loyaltyReward: null,
        },
      ],
    };
  if (confirmation.state === "processing")
    return {
      state: "processing",
      retryHref: `/rezervace/hotovo?${new URLSearchParams({ reservation_id: confirmation.reservationId, ...tokenParam })}`,
    };
  return { state: confirmation.state };
}

export default async function BookingDonePage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    order_id?: string;
    reservation_id?: string;
  }>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  const [content, view] = await Promise.all([
    loadSiteContent(),
    resolveView({
      userId: session?.user.id ?? null,
      orderId: params.order_id,
      reservationId: params.reservation_id,
      token: params.token,
    }),
  ]);
  const many = view.state === "confirmed" && view.slots.length > 1;

  /*
   * Loyalty is members-only, and only worth showing once the booking is
   * actually confirmed : it is already counted by then.
   */
  let loyaltySentence = "";
  if (session && view.state === "confirmed") {
    const status = await loyalty.getLoyaltyStatus(session.user.id);
    loyaltySentence = many
      ? loyalty.orderLoyaltySentence(
          status,
          view.slots.filter((slot) => slot.loyaltyReward).length,
        )
      : loyalty.loyaltyProgressSentence(status);
  }

  const state = {
    confirmed: {
      icon: CheckCircle2,
      title: many ? "Rezervace jsou potvrzené" : "Rezervace je potvrzená",
      body: many
        ? session
          ? "Termíny najdete ve svém účtu. Vstupní kód ke každému termínu připravujeme samostatně a posíláme e-mailem hodinu před jeho začátkem."
          : "Potvrzení se všemi termíny jsme poslali na váš e-mail. Vstupní kód ke každému termínu připravujeme samostatně a posíláme e-mailem hodinu před jeho začátkem."
        : session
          ? "Termín najdete ve svém účtu. Vstupní kód připravujeme samostatně a posíláme e-mailem hodinu před začátkem; při pozdější rezervaci co nejdříve po ověření."
          : "Potvrzení jsme poslali na váš e-mail. Vstupní kód připravujeme samostatně a posíláme e-mailem hodinu před začátkem; při pozdější rezervaci co nejdříve po ověření.",
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
  }[view.state];
  const Icon = state.icon;
  const address = publicAddress(content.get("contact.address"));

  return (
    <>
      <SiteHeader
        brand={content.get("brand.name")}
        accountHref={session ? "/account" : "/login"}
        accountLabel={session ? "Můj účet" : "Přihlásit se"}
      />
      {view.state === "confirmed" ? (
        <BookingConversionTracker
          transactionId={view.transactionId}
          priceCents={view.totalCents}
          currency={view.currency}
          quantity={view.slots.length}
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
            {view.state === "processing" ? (
              <Notice className="mt-7 text-left" role="status">
                Stav platby průběžně ověřujeme. Platbu prosím neopakujte.
              </Notice>
            ) : null}
            {view.state === "confirmed" && many ? (
              <>
                <ul
                  aria-label="Potvrzené termíny"
                  className="mt-7 divide-y divide-border rounded-lg border border-border bg-card text-left"
                >
                  {view.slots.map((slot) => (
                    <li
                      key={slot.reservationId}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
                    >
                      <span className="font-bold">
                        {dayFormat.format(slot.startsAt)},{" "}
                        {formatTimeRange(slot.startsAt, slot.endsAt)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {slot.priceCents === 0
                          ? slot.loyaltyReward
                            ? "zdarma, věrnostní vstup"
                            : "zdarma"
                          : formatMoney(slot.priceCents, view.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex justify-center">
                  {/* A plain anchor: the response is a file, not a page. */}
                  <a
                    href={`/api/orders/${view.orderId}/calendar.ics${params.token ? `?${new URLSearchParams({ token: params.token })}` : ""}`}
                    download="rezervace.ics"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      // Long Czech label: wrap rather than overflow at 320px.
                      "h-auto whitespace-normal py-2 text-center",
                    )}
                  >
                    <CalendarPlus aria-hidden="true" />
                    Přidat všechny termíny do kalendáře
                  </a>
                </div>
              </>
            ) : null}
            {view.state === "confirmed" && !many && view.slots[0] ? (
              <CalendarActions
                className="mt-7 justify-center"
                reservationId={view.slots[0].reservationId}
                startsAt={view.slots[0].startsAt}
                endsAt={view.slots[0].endsAt}
                address={address}
              />
            ) : null}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {view.state === "processing" ? (
                <Button href={view.retryHref} variant="outline">
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
