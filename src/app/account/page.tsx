import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { loyalty, reservations } from "@/lib/services";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import { LoyaltyWidget } from "@/components/loyalty-widget";

export const metadata = { title: "Můj účet" };

/**
 * Member account page. Shows the loyalty counter (progress to the next free
 * entry) and upcoming reservations. This is the customer's own view — the
 * public booking flow and visual design come in a later phase.
 */
export default async function AccountPage() {
  const user = await requireUser("/account");
  const [status, upcoming, entryPrice] = await Promise.all([
    loyalty.getLoyaltyStatus(user.id),
    reservations.listUpcomingForUser(user.id),
    loyalty.getEntryPriceCents(),
  ]);

  return (
    <main style={{ maxWidth: 640, margin: "3rem auto", padding: "0 1rem" }}>
      <h1>Můj účet</h1>
      <p style={{ color: "var(--muted)" }}>
        Přihlášen jako {user.email}. Cena vstupu: {formatMoney(entryPrice)}.
      </p>

      <LoyaltyWidget status={status} />

      <h2 style={{ marginTop: "2rem" }}>Nadcházející rezervace</h2>
      <ul>
        {upcoming.map((r) => (
          <li key={r.id}>{formatDateTime(r.startsAt)} — {r.status}</li>
        ))}
        {upcoming.length === 0 && <li>Žádné nadcházející rezervace.</li>}
      </ul>

      <p style={{ marginTop: "2rem" }}>
        <Link href="/">← Zpět na úvod</Link>
      </p>
    </main>
  );
}
