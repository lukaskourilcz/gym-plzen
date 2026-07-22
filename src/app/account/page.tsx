import { requireUser } from "@/lib/auth/guards";
import { loyalty, reservations } from "@/lib/services";
import { loadSiteContent } from "@/lib/content/site";
import {
  formatDate,
  formatMoney,
  formatStatus,
  formatTimeRange,
} from "@/lib/helpers/format";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";
import { LoyaltyWidget } from "@/components/loyalty-widget";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { DEMO_CUSTOMER_ID } from "@/lib/auth/demo";
import { deriveLoyaltyStatus } from "@/lib/services/loyalty";
import { SignOutButton } from "@/components/admin/sign-out-button";

export const metadata = { title: "Můj účet" };

/**
 * Member account page. Shows the loyalty counter (progress to the next free
 * entry) and upcoming reservations.
 */
export default async function AccountPage() {
  const user = await requireUser("/account");
  const isDemoCustomer = user.id === DEMO_CUSTOMER_ID;
  const [status, upcoming, content] = await Promise.all([
    isDemoCustomer
      ? Promise.resolve(deriveLoyaltyStatus(6))
      : loyalty.getLoyaltyStatus(user.id),
    isDemoCustomer
      ? Promise.resolve(demoUpcomingReservations())
      : reservations.listUpcomingForUser(user.id),
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
      <main>
        <Section className="py-12">
          <Container className="max-w-4xl">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
                Můj účet
              </div>
              <SignOutButton className="m-0 min-h-11 px-2 text-sm font-bold text-accent-foreground" />
            </div>
            <h1 className="mt-2 text-[38px] font-black tracking-[-.03em]">
              Dobrý den, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {user.email} · cena vstupu {formatMoney(content.entryPriceCents)}
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <LoyaltyWidget status={status} />
              <div className="rounded-lg border border-border bg-card p-7">
                <div className="text-[11px] font-extrabold uppercase tracking-[.13em] text-muted-foreground">
                  Nejbližší trénink
                </div>
                {upcoming[0] ? (
                  <>
                    <div className="mt-3 text-xl font-black">
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
                  className="flex items-center gap-4 rounded-md border border-border bg-card px-5 py-4"
                >
                  <span className="grid size-11 place-items-center rounded-sm bg-accent text-accent-foreground">
                    <CalendarDays className="size-5" />
                  </span>
                  <div className="flex-1">
                    <div className="font-extrabold">Trénink · celý gym</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {formatDate(r.startsAt)} ·{" "}
                      {formatTimeRange(r.startsAt, r.endsAt)}
                    </div>
                  </div>
                  <span className="rounded-sm bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                    {formatStatus(r.status)}
                  </span>
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
          </Container>
        </Section>
      </main>
      <SiteFooter
        brand={content.get("brand.name")}
        termsUrl={content.termsUrl}
      />
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
      status: "confirmed",
    },
    {
      id: "demo-reservation-2",
      startsAt: nextWeek,
      endsAt: new Date(nextWeek.getTime() + 60 * 60_000),
      status: "confirmed",
    },
  ];
}
