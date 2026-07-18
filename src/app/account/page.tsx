import { requireUser } from "@/lib/auth/guards";
import { loyalty, reservations } from "@/lib/services";
import { loadSiteContent } from "@/lib/content/site";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { LoyaltyWidget } from "@/components/loyalty-widget";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata = { title: "Můj účet" };

/**
 * Member account page. Shows the loyalty counter (progress to the next free
 * entry) and upcoming reservations.
 */
export default async function AccountPage() {
  const user = await requireUser("/account");
  const [status, upcoming, content] = await Promise.all([
    loyalty.getLoyaltyStatus(user.id),
    reservations.listUpcomingForUser(user.id),
    loadSiteContent(),
  ]);

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} logoUrl={content.logoUrl} />
      <main>
        <Section className="py-12">
          <Container className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight">Můj účet</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Přihlášen jako {user.email}. Cena vstupu: {formatMoney(content.entryPriceCents)}.
            </p>

            <div className="mt-6">
              <LoyaltyWidget status={status} />
            </div>

            <h2 className="mt-8 mb-2 text-lg font-semibold">Nadcházející rezervace</h2>
            <ul className="list-disc pl-5 text-sm">
              {upcoming.map((r) => (
                <li key={r.id}>
                  {formatDateTime(r.startsAt)} — {r.status}
                </li>
              ))}
              {upcoming.length === 0 && <li className="list-none text-muted-foreground">Žádné nadcházející rezervace.</li>}
            </ul>

            <div className="mt-8">
              <Button href="/rezervace">Rezervovat trénink</Button>
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter brand={content.get("brand.name")} termsUrl={content.termsUrl} />
    </>
  );
}
