import { loyalty, members } from "@/lib/services";
import { deriveLoyaltyStatus } from "@/lib/services/loyalty";
import { FREE_ENTRY_EVERY } from "@/lib/config/pricing";
import { formatMoney } from "@/lib/helpers/format";
import { loadDemoData } from "@/lib/demo/dummy";
import { DemoBanner } from "@/components/admin/demo-banner";
import { EntryPriceForm } from "./entry-price-form";

export const metadata = { title: "Vstupné a věrnost" };
export const dynamic = "force-dynamic";

/**
 * Pricing & loyalty admin. The gym sells one product — a one-time entry — with
 * no monthly subscriptions. Every Nth entry is free; this page sets the entry
 * price and shows each member's loyalty progress.
 */
export default async function PricingPage() {
  const [entryPriceCents, liveMembers] = await Promise.all([
    loyalty.getEntryPriceCents(),
    members.listMembers(200),
  ]);

  const demo = liveMembers.length === 0;
  let withLoyalty: { member: (typeof liveMembers)[number]; status: ReturnType<typeof deriveLoyaltyStatus> }[];

  if (demo) {
    // Derive loyalty from demo reservation counts (demo ids aren't in the DB).
    const d = await loadDemoData();
    const counts = new Map<string, number>();
    for (const r of d.reservations) {
      if ((r.status === "confirmed" || r.status === "completed") && r.userId) {
        counts.set(r.userId, (counts.get(r.userId) ?? 0) + 1);
      }
    }
    withLoyalty = d.members.map((m) => ({
      member: m,
      status: deriveLoyaltyStatus(counts.get(m.user.id) ?? 0),
    }));
  } else {
    withLoyalty = await Promise.all(
      liveMembers.map(async (m) => ({
        member: m,
        status: await loyalty.getLoyaltyStatus(m.user.id),
      })),
    );
  }

  return (
    <div>
      <h1>Vstupné a věrnost</h1>
      {demo && <DemoBanner />}

      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "1rem",
          maxWidth: 520,
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Cena vstupného</h2>
        <p style={{ color: "var(--muted)" }}>
          Jednorázový vstup. Žádná měsíční předplatná. Aktuální cena:{" "}
          <strong>{formatMoney(entryPriceCents)}</strong>.
        </p>
        <EntryPriceForm currentCzk={Math.round(entryPriceCents / 100)} />
        <p style={{ color: "var(--muted)", marginTop: "1rem" }}>
          Věrnostní program: každý <strong>{FREE_ENTRY_EVERY}.</strong> vstup je
          zdarma. (Nastavení kadence: <code>src/lib/config/pricing.ts</code>.)
        </p>
      </section>

      <h2>Věrnostní přehled členů</h2>
      <table>
        <thead>
          <tr>
            <th>Člen</th>
            <th>Návštěv celkem</th>
            <th>V aktuálním cyklu</th>
            <th>Do vstupu zdarma</th>
            <th>Vstupů zdarma získáno</th>
          </tr>
        </thead>
        <tbody>
          {withLoyalty.map(({ member, status }) => (
            <tr key={member.user.id}>
              <td>{member.user.name || member.user.email}</td>
              <td>{status.totalEntries}</td>
              <td>
                {status.positionInCycle} / {status.cadence}
              </td>
              <td>{status.nextEntryIsFree ? "🎉 další zdarma" : status.entriesUntilFree}</td>
              <td>{status.freeEntriesEarned}</td>
            </tr>
          ))}
          {withLoyalty.length === 0 && (
            <tr>
              <td colSpan={5}>Zatím žádní členové.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
