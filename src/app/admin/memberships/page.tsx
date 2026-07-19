import { loyalty, members } from "@/lib/services";
import { deriveLoyaltyStatus } from "@/lib/services/loyalty";
import { DEFAULT_ENTRY_PRICE_CENTS, FREE_ENTRY_EVERY } from "@/lib/config/pricing";
import { formatMoney } from "@/lib/helpers/format";
import { loadDemoData } from "@/lib/demo/dummy";
import { DemoBanner } from "@/components/admin/demo-banner";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EntryPriceForm } from "./entry-price-form";

export const metadata = { title: "Vstupné a věrnost" };
export const dynamic = "force-dynamic";

/**
 * Pricing & loyalty admin. One product — a one-time entry, no subscriptions.
 * Every Nth entry is free; this page sets the price and shows loyalty progress.
 */
export default async function PricingPage() {
  const [entryPriceCents, liveMembers] = await Promise.all([
    loyalty.getEntryPriceCents().catch(() => DEFAULT_ENTRY_PRICE_CENTS),
    members.listMembers(200).catch(() => []),
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
    withLoyalty = d.members.map((m) => ({ member: m, status: deriveLoyaltyStatus(counts.get(m.user.id) ?? 0) }));
  } else {
    withLoyalty = await Promise.all(
      liveMembers.map(async (m) => ({ member: m, status: await loyalty.getLoyaltyStatus(m.user.id) })),
    );
  }

  return (
    <div>
      <PageHeader title="Vstupné a věrnost" />
      {demo && <DemoBanner />}

      <Card className="mb-8 max-w-xl">
        <CardHeader>
          <CardTitle>Cena vstupného</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Jednorázový vstup. Žádná měsíční předplatná. Aktuální cena:{" "}
            <strong className="text-foreground">{formatMoney(entryPriceCents)}</strong>.
          </p>
          <EntryPriceForm currentCzk={Math.round(entryPriceCents / 100)} />
          <p className="mt-4 text-sm text-muted-foreground">
            Věrnostní program: každý <strong className="text-foreground">{FREE_ENTRY_EVERY}.</strong> vstup je zdarma.
            (Kadence: <code>src/lib/config/pricing.ts</code>.)
          </p>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Věrnostní přehled členů</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Člen</TableHead>
            <TableHead>Návštěv celkem</TableHead>
            <TableHead>V aktuálním cyklu</TableHead>
            <TableHead>Do vstupu zdarma</TableHead>
            <TableHead>Vstupů zdarma získáno</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {withLoyalty.map(({ member, status }) => (
            <TableRow key={member.user.id}>
              <TableCell>{member.user.name || member.user.email}</TableCell>
              <TableCell>{status.totalEntries}</TableCell>
              <TableCell>{status.positionInCycle} / {status.cadence}</TableCell>
              <TableCell>{status.nextEntryIsFree ? "Další vstup zdarma" : status.entriesUntilFree}</TableCell>
              <TableCell>{status.freeEntriesEarned}</TableCell>
            </TableRow>
          ))}
          {withLoyalty.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Zatím žádní členové.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
