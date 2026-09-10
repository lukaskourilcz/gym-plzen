import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { getSession } from "@/lib/auth/guards";
import { formatMoney, formatTimeRange } from "@/lib/helpers/format";
import { dateKeyInTimeZone, minutesBetween } from "@/lib/helpers/datetime";
import { availability, loyalty, members, slots } from "@/lib/services";
import { Container, Section } from "@/components/ui/container";
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

/**
 * Step two of booking: the visitor confirms who they are and agrees to the
 * house rules and the terms, then goes to payment. Reachable without an
 * account : the whole point of this step is that a reservation no longer
 * requires one.
 */
export default async function BookingDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const params = await searchParams;
  const startsAt = params.start ? new Date(params.start) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) redirect("/rezervace");

  const [resolved, horizonDays] = await Promise.all([
    slots.resolveBookableSlot(startsAt),
    slots.getBookingHorizonDays(),
  ]);
  const dateKey = dateKeyInTimeZone(startsAt);
  // An expired link or a slot outside the horizon goes back to the calendar on
  // the day it was pointing at, rather than dead-ending here.
  if (
    !resolved ||
    !slots.isWithinBookingHorizon(dateKey, new Date(), horizonDays) ||
    startsAt.getTime() <= Date.now()
  ) {
    redirect(`/rezervace?date=${dateKey}`);
  }

  const [content, session, free] = await Promise.all([
    loadSiteContent(),
    getSession(),
    availability.checkAvailability(startsAt, resolved.endsAt),
  ]);
  if (!free.available) redirect(`/rezervace?date=${dateKey}&stav=obsazeno`);

  const member = session ? await members.getMember(session.user.id) : null;
  const entryPriceCents = session
    ? (await loyalty.priceForNextEntry(session.user.id)).priceCents
    : await loyalty.getEntryPriceCents();

  const nameParts = splitName(member?.user.name ?? "");
  const slotLabel = formatTimeRange(startsAt, resolved.endsAt);
  const dayLabel = new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00Z`));

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
              href={`/rezervace?date=${dateKey}`}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-accent-foreground hover:underline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Zpět na výběr termínu
            </Link>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-.01em] sm:text-5xl">
              Vyplňte údaje k rezervaci
            </h1>

            <div
              data-testid="chosen-slot"
              className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card p-5"
            >
              <Clock3
                aria-hidden="true"
                className="size-6 shrink-0 text-accent-foreground"
              />
              <p className="font-extrabold">
                {dayLabel}, {slotLabel}
              </p>
              <p className="text-sm text-muted-foreground">
                {minutesBetween(startsAt, resolved.endsAt)} minut ·{" "}
                {entryPriceCents === 0
                  ? "vstup zdarma"
                  : formatMoney(entryPriceCents)}
              </p>
            </div>

            {session ? null : (
              <Notice className="mt-6" role="status">
                Rezervaci dokončíte i bez registrace. S účtem navíc uvidíte své
                termíny na jednom místě a počítá se vám každý{" "}
                {content.freeEntryEvery}. vstup zdarma.{" "}
                <Link
                  href={`/login?next=${encodeURIComponent(`/rezervace/udaje?start=${startsAt.toISOString()}`)}`}
                  className="font-bold text-accent-foreground underline"
                >
                  Přihlásit se nebo se zaregistrovat
                </Link>
                .
              </Notice>
            )}

            <div className="mt-8">
              <BookingDetailsForm
                startsAtISO={startsAt.toISOString()}
                entryPriceCents={entryPriceCents}
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
