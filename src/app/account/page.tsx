import { requireUser } from "@/lib/auth/guards";
import { loyalty, reservations } from "@/lib/services";
import { loadSiteContent } from "@/lib/content/site";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";
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
          <Container className="max-w-4xl">
            <div className="text-xs font-extrabold uppercase tracking-[.14em] text-primary">Můj účet</div>
            <h1 className="mt-2 text-[38px] font-black tracking-[-.03em]">Dobrý den, {user.name.split(" ")[0]}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {user.email} · cena vstupu {formatMoney(content.entryPriceCents)}
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <LoyaltyWidget status={status} />
              <div className="rounded-[18px] border border-border bg-card p-7">
                <div className="text-[11px] font-extrabold uppercase tracking-[.13em] text-muted-foreground">Nejbližší trénink</div>
                {upcoming[0] ? <><div className="mt-3 text-xl font-black">{formatDateTime(upcoming[0].startsAt)}</div><div className="mt-4 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground">Vstupní údaje obdržíte před začátkem rezervace.</div></> : <p className="mt-4 text-sm text-muted-foreground">Nemáte žádnou naplánovanou rezervaci.</p>}
              </div>
            </div>

            <h2 className="mb-3 mt-10 text-lg font-extrabold">Nadcházející rezervace</h2>
            <div className="grid gap-2.5">
              {upcoming.map((r) => (
                <div key={r.id} className="flex items-center gap-4 rounded-[14px] border border-border bg-card px-5 py-4"><span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground"><CalendarDays className="size-5" /></span><div className="flex-1"><div className="font-extrabold">Trénink · celý gym</div><div className="mt-0.5 text-sm text-muted-foreground">{formatDateTime(r.startsAt)}</div></div><span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{r.status}</span></div>
              ))}
              {upcoming.length === 0 && <div className="rounded-[14px] border border-dashed border-border p-6 text-sm text-muted-foreground">Žádné nadcházející rezervace.</div>}
            </div>

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
