import { isComgateConfigured } from "@/lib/integrations/comgate";
import { getOperations } from "@/lib/services/operations";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock3, Plus } from "lucide-react";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { getSession } from "@/lib/auth/guards";
import { formatMoney, formatTimeRange } from "@/lib/helpers/format";
import { dateKeyInTimeZone, minutesBetween } from "@/lib/helpers/datetime";
import { HOLD_COOKIE, parseBookingHold } from "@/lib/helpers/booking-hold";
import {
  detailsHref,
  parseSelectedStarts,
  withSelectedStarts,
} from "@/lib/helpers/booking-selection";
import { MAX_SLOTS_PER_ORDER } from "@/lib/config/orders";
import { availability, members, orders, slots } from "@/lib/services";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { BookingDetailsForm } from "./booking-details-form";

export const metadata: Metadata = {
  title: "Údaje k rezervaci",
  description: "Vyplňte údaje k rezervaci NAVI Private Gym v Plzni.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Split a stored full name back into the two fields the form asks for. */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] ?? "", lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1)!,
  };
}

const dayFormat = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Prague",
});

/** "3 termíny" / "5 termínů". */
function termCount(n: number): string {
  if (n === 1) return "1 termín";
  if (n >= 2 && n <= 4) return `${n} termíny`;
  return `${n} termínů`;
}

type SlotState = "bookable" | "held" | "confirmed" | "taken" | "unavailable";

const STATE_TEXT: Record<Exclude<SlotState, "bookable" | "held">, string> = {
  confirmed: "Tento termín už máte potvrzený. Odeberte ho z výběru.",
  taken: "Tento termín už není volný. Odeberte ho z výběru.",
  unavailable: "Tento termín už nelze rezervovat. Odeberte ho z výběru.",
};

/**
 * Step two of booking: the visitor reviews the selected slots, confirms who
 * they are and agrees to the house rules and the terms, then pays once for
 * all of them. Reachable without an account. One slot is the ordinary case.
 */
export default async function BookingDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string | string[] }>;
}) {
  const params = await searchParams;
  const starts = parseSelectedStarts(params.start);
  if (starts.length === 0) redirect("/rezervace");

  const now = new Date();
  const [horizonDays, operations, content, session, cookieStore] =
    await Promise.all([
      slots.getBookingHorizonDays(),
      getOperations(),
      loadSiteContent(),
      getSession(),
      cookies(),
    ]);
  const paymentsAvailable = operations.paymentsEnabled && isComgateConfigured();
  const userId = session?.user.id ?? null;
  const hold = parseBookingHold(cookieStore.get(HOLD_COOKIE)?.value);

  /*
   * A taken slot may be the visitor's own: a guest back from the payment
   * gateway carries the hold cookie, a member is known by account. Their
   * held slots continue here; only someone else's booking must be removed.
   */
  const own = await orders.findOwnReservations({
    userId,
    email: session?.user.email ?? null,
    starts,
    hold,
  });
  const ownAt = new Map(own.map((row) => [row.startsAt.getTime(), row]));

  const selection = await Promise.all(
    starts.map(async (startsAt) => {
      const resolved = await slots.resolveBookableSlot(startsAt);
      const dateKey = dateKeyInTimeZone(startsAt);
      const endsAt = resolved?.endsAt ?? null;
      let state: SlotState = "bookable";
      const mine = ownAt.get(startsAt.getTime());
      if (
        !resolved ||
        startsAt <= now ||
        !slots.isWithinBookingHorizon(dateKey, now, horizonDays)
      )
        state = "unavailable";
      else if (mine?.status === "confirmed") state = "confirmed";
      else if (mine?.status === "pending") state = "held";
      else if (
        !(await availability.checkAvailability(startsAt, resolved.endsAt))
          .available
      )
        state = "taken";
      return { startsAt, endsAt, dateKey, state };
    }),
  );
  const bookable = selection.filter(
    (item): item is typeof item & { endsAt: Date } =>
      (item.state === "bookable" || item.state === "held") &&
      item.endsAt !== null,
  );
  // Nothing left to book: back to the calendar on the first selected day.
  if (bookable.length === 0) {
    const taken = selection.some((item) => item.state === "taken");
    redirect(
      `/rezervace?date=${selection[0]!.dateKey}${taken ? "&stav=obsazeno" : ""}`,
    );
  }
  const blocked = selection.length - bookable.length;
  const quote = await orders.quoteOrder({ userId, slots: bookable });
  const priceAt = new Map(
    quote.slots.map((slot) => [slot.startsAt.getTime(), slot]),
  );

  const member = session ? await members.getMember(session.user.id) : null;
  const nameParts = splitName(member?.user.name ?? "");
  const allStarts = selection.map((item) => item.startsAt);
  const removeHref = (startsAt: Date) => {
    const rest = allStarts.filter((at) => at.getTime() !== startsAt.getTime());
    return rest.length > 0
      ? detailsHref(rest)
      : `/rezervace?date=${dateKeyInTimeZone(startsAt)}`;
  };
  const lastDateKey = selection.at(-1)!.dateKey;
  const calendarHref = `/rezervace?${withSelectedStarts(
    new URLSearchParams({ date: lastDateKey }),
    allStarts,
  ).toString()}`;
  const heldCount = selection.filter((item) => item.state === "held").length;

  return (
    <>
      <SiteHeader
        brand={content.get("brand.name")}
        logoUrl={content.logoUrl}
        accountHref={session ? "/account" : "/login"}
        accountLabel={session ? "Můj účet" : "Přihlásit se"}
      />
      <main id="main-content" tabIndex={-1}>
        <Section className="pb-24 pt-12 sm:pt-16">
          <Container className="max-w-2xl">
            <Link
              href={calendarHref}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-accent-foreground hover:underline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Zpět na výběr termínu
            </Link>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-.01em] sm:text-5xl">
              Vyplňte údaje k rezervaci
            </h1>

            <section aria-labelledby="chosen-heading" className="mt-7">
              <h2 id="chosen-heading" className="text-xl font-extrabold">
                {selection.length === 1
                  ? "Vybraný termín"
                  : `Vybrané termíny (${selection.length})`}
              </h2>
              <ul className="mt-3 grid gap-3">
                {selection.map((item) => {
                  const priced = priceAt.get(item.startsAt.getTime());
                  const problem =
                    item.state === "bookable" || item.state === "held"
                      ? null
                      : STATE_TEXT[item.state];
                  return (
                    <li
                      key={item.startsAt.toISOString()}
                      data-testid="chosen-slot"
                      className="flex items-start gap-4 rounded-lg border border-border bg-card p-4 sm:p-5"
                    >
                      <Clock3
                        aria-hidden="true"
                        className="mt-0.5 size-6 shrink-0 text-accent-foreground"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold">
                          {dayFormat.format(item.startsAt)}
                          {item.endsAt
                            ? `, ${formatTimeRange(item.startsAt, item.endsAt)}`
                            : null}
                        </p>
                        {problem ? (
                          <p className="mt-1 text-sm font-bold text-destructive">
                            {problem}
                          </p>
                        ) : (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.endsAt
                              ? `${minutesBetween(item.startsAt, item.endsAt)} minut · `
                              : null}
                            {priced?.isReward
                              ? "zdarma, věrnostní vstup"
                              : priced?.priceCents === 0
                                ? "vstup zdarma"
                                : formatMoney(priced?.priceCents ?? 0)}
                          </p>
                        )}
                      </div>
                      <Button
                        href={removeHref(item.startsAt)}
                        variant="ghost"
                        size="sm"
                        className="-my-1 shrink-0 px-3"
                      >
                        Odebrat
                        <span className="sr-only">
                          {` termín ${dayFormat.format(item.startsAt)}${item.endsAt ? ` ${formatTimeRange(item.startsAt, item.endsAt)}` : ""}`}
                        </span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                {selection.length < MAX_SLOTS_PER_ORDER ? (
                  <Link
                    href={calendarHref}
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-accent-foreground hover:underline"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Přidat další termín
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    V jedné objednávce může být nejvýše {MAX_SLOTS_PER_ORDER}{" "}
                    termínů.
                  </p>
                )}
                <p className="text-sm">
                  <span className="font-extrabold">
                    Celkem za {termCount(bookable.length)}:{" "}
                    {quote.totalCents === 0
                      ? "zdarma"
                      : formatMoney(quote.totalCents)}
                  </span>
                  <span className="block text-muted-foreground">
                    Cena platí za celý prostor, nikoli za osobu.
                  </span>
                </p>
              </div>
            </section>

            {blocked > 0 ? (
              <Notice
                className="mt-6"
                tone="warning"
                title={
                  blocked === 1
                    ? "Jeden termín už nelze rezervovat"
                    : "Některé termíny už nelze rezervovat"
                }
                role="status"
              >
                {blocked === 1
                  ? "Odeberte ho prosím z výběru. Ostatní termíny pak dokončíte jednou platbou."
                  : "Odeberte je prosím z výběru. Ostatní termíny pak dokončíte jednou platbou."}
              </Notice>
            ) : null}
            {heldCount > 0 ? (
              <Notice
                className="mt-6"
                tone="warning"
                title={
                  heldCount === 1
                    ? "Tento termín už pro vás držíme"
                    : "Tyto termíny už pro vás držíme"
                }
                role="status"
              >
                {heldCount === 1
                  ? "Rezervaci jste už začali, ale platba zatím neproběhla. Termín držíme jen po dobu platební relace; pokračujte k platbě a dokončete ji."
                  : "Rezervaci jste už začali, ale platba zatím neproběhla. Termíny držíme jen po dobu platební relace; pokračujte k platbě a dokončete ji."}
              </Notice>
            ) : null}
            {session ? null : (
              <Notice className="mt-6" role="status">
                {`Rezervaci dokončíte i bez registrace. S účtem se počítá každý ${content.freeEntryEvery}. vstup zdarma.`}{" "}
                <Link
                  href={`/login?next=${encodeURIComponent(detailsHref(allStarts))}`}
                  className="font-bold text-accent-foreground underline"
                >
                  Přihlásit se nebo se zaregistrovat
                </Link>
                .
              </Notice>
            )}

            {!paymentsAvailable && quote.totalCents > 0 ? (
              <Notice className="mt-6">
                Online platby se připravují. Můžete si vytvořit účet a
                prohlédnout termíny. Rezervace bude platná až po úhradě.
              </Notice>
            ) : null}
            <div className="mt-8">
              <BookingDetailsForm
                paymentsAvailable={paymentsAvailable}
                startsISO={bookable.map((item) => item.startsAt.toISOString())}
                totalCents={quote.totalCents}
                blocked={blocked > 0}
                canSavePhone={Boolean(member) && !session?.user.isDemo}
                defaultValues={{
                  firstName: member?.profile?.firstName ?? nameParts.firstName,
                  lastName: member?.profile?.lastName ?? nameParts.lastName,
                  email: member?.user.email ?? "",
                  phone: member?.profile?.phone ?? "",
                }}
              />
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
