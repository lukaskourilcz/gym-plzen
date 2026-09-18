import { CustomerAvatar } from "@/components/site/customer-avatar";
import Link from "next/link";
import { getMember } from "@/lib/services/members";
import { splitFullName } from "@/lib/helpers/profile";
import { ProfileForm, PasswordForm } from "./profile-form";
import { Orders } from "./orders";
import { requireUser } from "@/lib/auth/guards";
import { loyalty, reservations, rescheduling } from "@/lib/services";
import {
  footerProps,
  loadSiteContent,
  publicAddress,
} from "@/lib/content/site";
import {
  formatDate,
  formatMoney,
  formatStatus,
  formatTimeRange,
} from "@/lib/helpers/format";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { pageFromParam } from "@/lib/helpers/pagination";
import { CalendarDays } from "lucide-react";
import { LoyaltyWidget } from "@/components/loyalty-widget";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { deriveLoyaltyStatus } from "@/lib/services/loyalty";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { CalendarActions } from "@/components/site/calendar-actions";

export const metadata = {
  title: "Můj účet",
  robots: { index: false, follow: false },
};

/**
 * Member account page. Shows the loyalty counter (progress to the next free
 * entry) and upcoming reservations.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser("/account");
  const isDemoCustomer = user.isDemo;
  const tab =
    params.tab === "profile" || params.tab === "orders"
      ? params.tab
      : "reservations";
  const page = pageFromParam(params.page);
  const member = isDemoCustomer ? null : await getMember(user.id);
  const names = splitFullName(user.name);
  const profileValues = {
    firstName: member?.profile?.firstName ?? names.firstName,
    lastName: member?.profile?.lastName ?? names.lastName,
    phone: member?.profile?.phone ?? "",
    notifyByWhatsapp: member?.profile?.notifyByWhatsapp ?? false,
    avatarSource: user.googleAvatarUrl
      ? (member?.profile?.avatarSource ?? "google")
      : ("initials" as const),
  };
  const [status, upcoming, rescheduledIds, content] = await Promise.all([
    isDemoCustomer
      ? Promise.resolve(deriveLoyaltyStatus(6))
      : loyalty.getLoyaltyStatus(user.id),
    isDemoCustomer
      ? Promise.resolve(demoUpcomingReservations())
      : reservations.listUpcomingForUser(user.id),
    isDemoCustomer
      ? Promise.resolve(new Set<string>())
      : rescheduling.listRescheduledReservationIds(user.id),
    loadSiteContent(),
  ]);

  return (
    <>
      <SiteHeader
        brand={content.get("brand.name")}
        logoUrl={content.logoUrl}
        accountHref="/account"
        accountLabel="Můj účet"
      />
      <main id="main-content" tabIndex={-1}>
        <Section className="py-12">
          <Container className="max-w-4xl">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
                Můj účet
              </div>
              <SignOutButton className="m-0 min-h-11 px-2 text-sm font-bold text-accent-foreground" />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-5">
              <CustomerAvatar
                name={user.name}
                photo={
                  profileValues.avatarSource === "google"
                    ? user.googleAvatarUrl
                    : null
                }
              />
              <div className="min-w-0 flex-1">
                <h1 className="mt-2 break-words text-3xl font-extrabold tracking-[-.01em] sm:text-4xl">
                  Dobrý den, {user.name.split(" ")[0]}
                </h1>
                <p className="mt-2 break-all text-sm text-muted-foreground">
                  {user.email} · cena vstupu{" "}
                  {formatMoney(content.entryPriceCents)}
                </p>
              </div>
            </div>
            <nav
              aria-label="Můj účet"
              className="my-8 flex flex-wrap gap-2 border-b border-border pb-4"
            >
              {(
                [
                  { id: "reservations", label: "Moje tréninky" },
                  { id: "orders", label: "Historie objednávek" },
                  { id: "profile", label: "Profil a heslo" },
                ] as const
              ).map((item) => (
                <Link
                  key={item.id}
                  href={`/account?tab=${item.id}`}
                  aria-current={tab === item.id ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-md px-4 py-3 text-sm font-bold ${tab === item.id ? "bg-primary text-primary-foreground" : "text-accent-foreground hover:bg-accent"}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {tab === "profile" ? (
              <div className="grid gap-6">
                <ProfileForm
                  values={profileValues}
                  email={user.email}
                  googlePhoto={user.googleAvatarUrl ?? null}
                  isDemo={isDemoCustomer}
                />
                <PasswordForm isDemo={isDemoCustomer} />
              </div>
            ) : tab === "orders" ? (
              <Orders userId={user.id} page={page} isDemo={isDemoCustomer} />
            ) : (
              <>
                {params.zmena === "uspesna" ? (
                  <Notice
                    tone="success"
                    title="Termín byl změněn"
                    className="mt-6"
                    role="status"
                  >
                    Původní čas je znovu volný. Potvrzení nového termínu s
                    aktualizovanou pozvánkou do kalendáře jsme vám poslali
                    e-mailem.
                  </Notice>
                ) : null}

                <div className="mt-8 grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
                  <LoyaltyWidget status={status} />
                  <div className="rounded-lg border border-border bg-card p-7">
                    <div className="text-xs font-extrabold uppercase tracking-[.13em] text-muted-foreground">
                      Nejbližší trénink
                    </div>
                    {upcoming[0] ? (
                      <>
                        <div className="mt-3 text-xl font-extrabold">
                          {formatDate(upcoming[0].startsAt)}
                        </div>
                        <div className="mt-1 text-sm font-bold text-muted-foreground">
                          {formatTimeRange(
                            upcoming[0].startsAt,
                            upcoming[0].endsAt,
                          )}
                        </div>
                        <div className="mt-4 rounded-md bg-accent px-4 py-3 text-sm font-bold text-accent-foreground">
                          Vstupní údaje obdržíte před začátkem rezervace.
                        </div>
                      </>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Nemáte žádnou naplánovanou rezervaci.
                      </p>
                    )}
                  </div>
                </div>

                <h2 className="mb-3 mt-10 text-lg font-extrabold">
                  Nadcházející rezervace
                </h2>
                <div className="grid gap-2.5">
                  {upcoming.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-md border border-border bg-card px-5 py-4"
                    >
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="grid size-11 place-items-center rounded-sm bg-accent text-accent-foreground">
                          <CalendarDays className="size-5" />
                        </span>
                        <div className="min-w-48 flex-1">
                          <div className="font-extrabold">
                            Trénink · celý gym
                          </div>
                          <div className="mt-0.5 text-sm text-muted-foreground">
                            {formatDate(r.startsAt)} ·{" "}
                            {formatTimeRange(r.startsAt, r.endsAt)}
                          </div>
                        </div>
                        <span className="rounded-sm bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                          {formatStatus(r.status)}
                        </span>
                        {!isDemoCustomer &&
                        rescheduling.getRescheduleEligibility(
                          r,
                          rescheduledIds.has(r.id),
                        ).eligible ? (
                          <Button
                            href={`/account/rezervace/${r.id}/zmenit`}
                            variant="outline"
                            size="sm"
                          >
                            Změnit termín
                          </Button>
                        ) : null}
                      </div>
                      {/* Demo reservations have no row behind them to authorise. */}
                      {isDemoCustomer ? null : (
                        <CalendarActions
                          className="mt-3"
                          reservationId={r.id}
                          startsAt={r.startsAt}
                          endsAt={r.endsAt}
                          address={publicAddress(
                            content.get("contact.address"),
                          )}
                        />
                      )}
                    </div>
                  ))}
                  {upcoming.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                      Žádné nadcházející rezervace.
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <Button href="/rezervace">Rezervovat trénink</Button>
                </div>
              </>
            )}
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}

function demoUpcomingReservations() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0);

  const nextWeek = new Date(tomorrow);
  nextWeek.setDate(nextWeek.getDate() + 4);
  nextWeek.setHours(7, 0, 0, 0);

  return [
    {
      id: "demo-reservation-1",
      startsAt: tomorrow,
      endsAt: new Date(tomorrow.getTime() + 75 * 60_000),
      status: "confirmed" as const,
    },
    {
      id: "demo-reservation-2",
      startsAt: nextWeek,
      endsAt: new Date(nextWeek.getTime() + 60 * 60_000),
      status: "confirmed" as const,
    },
  ];
}
