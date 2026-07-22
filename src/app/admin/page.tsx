import Link from "next/link";
import { reservations, alerts, messages } from "@/lib/services";
import { formatDateTime, formatStatus } from "@/lib/helpers/format";
import { loadDemoData } from "@/lib/demo/dummy";
import { DemoBanner } from "@/components/admin/demo-banner";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Přehled" };
export const dynamic = "force-dynamic";

/**
 * Admin dashboard : a quick operational snapshot: upcoming reservations,
 * unresolved alerts, and recent message deliveries.
 */
export default async function AdminDashboard() {
  const [liveReservations, recentAlerts, liveMessages] = await Promise.all([
    reservations.listRecent(8).catch(() => []),
    alerts.listRecentAlerts(8).catch(() => []),
    messages.listRecent(8).catch(() => []),
  ]);

  const demo = liveReservations.length === 0;
  const d = demo ? await loadDemoData() : null;
  const recentReservations = d ? d.reservations.slice(0, 8) : liveReservations;
  const recentMessages = d ? d.messages.slice(0, 8) : liveMessages;
  const upcoming = recentReservations.filter((r) => r.startsAt > new Date());

  return (
    <div>
      <PageHeader title="Přehled" />
      {demo && <DemoBanner />}

      <div className="mb-8 flex flex-wrap gap-4">
        <StatCard label="Nadcházející rezervace" value={upcoming.length} />
        <StatCard
          label="Neuzavřená upozornění"
          value={recentAlerts.filter((a) => !a.resolvedAt).length}
        />
        <StatCard
          label="Nedoručené zprávy (posl. 8)"
          value={recentMessages.filter((m) => m.status === "failed").length}
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold">Poslední rezervace</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Začátek</TableHead>
            <TableHead>Kontakt</TableHead>
            <TableHead>Stav</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recentReservations.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatDateTime(r.startsAt)}</TableCell>
              <TableCell>
                {r.contactName ?? r.contactEmail ?? "Neuvedeno"}
              </TableCell>
              <TableCell>{formatStatus(r.status)}</TableCell>
            </TableRow>
          ))}
          {recentReservations.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                Zatím žádné rezervace.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <p className="mt-2 text-sm">
        <Link
          href="/admin/reservations"
          className="text-primary hover:underline"
        >
          Všechny rezervace →
        </Link>
      </p>
    </div>
  );
}
