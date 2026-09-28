import { requireAdmin } from "@/lib/auth/guards";
import Link from "next/link";
import { AlertTriangle, DoorOpen, MailWarning } from "lucide-react";
import { alerts, entryLog, messages, stats } from "@/lib/services";
import {
  formatDateTime,
  formatMoney,
  formatStatus,
  formatTime,
  formatTimeRange,
} from "@/lib/helpers/format";
import { aggregateDayOverview, pragueDayBounds } from "@/lib/services/stats";
import { loadDemoData } from "@/lib/demo/dummy";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { hasDemoAdminSession } from "@/lib/auth/demo";

export const metadata = { title: "Dnes" };
export const dynamic = "force-dynamic";

const DAY_FORMAT = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Prague",
});

/**
 * Admin dashboard: one operating day at a glance. It composes data the
 * administration already holds on separate pages (reservations, entry log,
 * alerts, message deliveries) so the operator can open one screen in the
 * morning and see what today asks of them.
 */
export default async function AdminDashboard() {
  await requireAdmin();
  const now = new Date();
  const bounds = pragueDayBounds(now);
  const demo = await hasDemoAdminSession();
  const demoData = demo ? await loadDemoData(now) : null;
  const [overview, todaysEntries, recentAlerts, recentMessages] = demo
    ? [aggregateDayOverview(demoData!.reservations, now), [], [], []]
    : await Promise.all([
        stats.getDayOverview(now),
        entryLog.listEntriesForDay(bounds),
        alerts.listRecentAlerts(8),
        messages.listRecent(12),
      ]);

  // Empty live tables are shown honestly. Fixtures belong only to local demo
  // sessions, never to a quiet production day.
  const day = demoData
    ? aggregateDayOverview(demoData.reservations, now)
    : overview;
  const todaysReservations = day.reservations;
  const entries = demoData
    ? demoData.entries.filter(
        (e) => e.occurredAt >= bounds.start && e.occurredAt < bounds.end,
      )
    : todaysEntries;
  const messageRows = demoData
    ? demoData.messages.slice(0, 12)
    : recentMessages;

  const upcoming = todaysReservations.filter(
    (r) => r.startsAt > now && r.status !== "cancelled",
  );
  const openAlerts = recentAlerts.filter((a) => !a.resolvedAt);
  const failedMessages = messageRows.filter((m) => m.status === "failed");
  const trend = day.last7 - day.previous7;

  return (
    <div>
      <PageHeader
        title="Dnes"
        description={capitalise(DAY_FORMAT.format(now))}
      />
      <div className="mb-8 flex flex-wrap gap-4">
        <StatCard
          label={
            upcoming[0]
              ? `Dnešní rezervace · další ${formatTime(upcoming[0].startsAt)}`
              : "Dnešní rezervace"
          }
          value={
            todaysReservations.filter((r) => r.status !== "cancelled").length
          }
        />
        <StatCard
          label={
            day.freeEntries > 0
              ? `Dnešní tržba · ${day.freeEntries} bez platby`
              : "Dnešní tržba"
          }
          value={formatMoney(day.revenueCents)}
        />
        <StatCard label="Neuzavřená upozornění" value={openAlerts.length} />
        <StatCard label="Nedoručené zprávy" value={failedMessages.length} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="today-programme">
          <h2 id="today-programme" className="mb-3 text-lg font-semibold">
            Dnešní program
          </h2>
          <div className="grid gap-2">
            {todaysReservations.map((r) => {
              const running = r.startsAt <= now && now < r.endsAt;
              return (
                <Card key={r.id} className={running ? "border-primary" : ""}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <span className="font-bold tabular-nums">
                      {formatTimeRange(r.startsAt, r.endsAt)}
                    </span>
                    <span className="min-w-32 flex-1 text-sm text-muted-foreground">
                      {r.contactName ?? r.contactEmail ?? "Neuvedeno"}
                    </span>
                    {running && <Badge variant="accent">Právě probíhá</Badge>}
                    {r.priceCents === 0 && (
                      <Badge variant="muted">Zdarma (věrnost)</Badge>
                    )}
                    <Badge variant="outline">{formatStatus(r.status)}</Badge>
                  </CardContent>
                </Card>
              );
            })}
            {todaysReservations.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                Na dnešek nemáte žádnou rezervaci.
              </p>
            )}
          </div>
          <p className="mt-3 text-sm">
            <Link
              href="/admin/reservations"
              className="text-accent-foreground hover:underline"
            >
              Všechny rezervace →
            </Link>
          </p>
        </section>

        <div className="grid gap-8">
          <section aria-labelledby="today-entries">
            <h2 id="today-entries" className="mb-3 text-lg font-semibold">
              Dnešní vstupy
            </h2>
            <div className="grid gap-2">
              {entries.slice(0, 8).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm"
                >
                  <DoorOpen
                    aria-hidden="true"
                    className="size-4 shrink-0 text-accent-foreground"
                  />
                  <span className="font-bold tabular-nums">
                    {formatTime(entry.occurredAt)}
                  </span>
                  <span className="text-muted-foreground">
                    {entry.nukiName ?? entry.trigger ?? "Zámek"}
                  </span>
                </div>
              ))}
              {entries.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Zámek dnes nezaznamenal žádný vstup.
                </p>
              )}
            </div>
            {/* The lock log records unlocks, not departures. */}
            <p className="mt-2 text-xs text-muted-foreground">
              Kniha vstupů zaznamenává odemčení, nikoli odchody.
            </p>
          </section>

          <section aria-labelledby="week-kpis">
            <h2 id="week-kpis" className="mb-3 text-lg font-semibold">
              Posledních 7 dní
            </h2>
            <dl className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-card p-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Rezervace</dt>
                <dd className="mt-1 text-2xl font-bold">
                  {day.last7}{" "}
                  <span className="text-sm font-bold text-muted-foreground">
                    {trend === 0
                      ? "beze změny"
                      : `${trend > 0 ? "+" : ""}${trend}`}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Storna</dt>
                <dd className="mt-1 text-2xl font-bold">
                  {day.cancelledLast7}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Nedorazili</dt>
                <dd className="mt-1 text-2xl font-bold">{day.noShowLast7}</dd>
              </div>
            </dl>
            <p className="mt-2 text-sm">
              <Link
                href="/admin/statistics"
                className="text-accent-foreground hover:underline"
              >
                Podrobné statistiky →
              </Link>
            </p>
          </section>

          <section aria-labelledby="today-activity">
            <h2 id="today-activity" className="mb-3 text-lg font-semibold">
              Co vyžaduje pozornost
            </h2>
            <div className="grid gap-2">
              {openAlerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm"
                >
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-warning"
                  />
                  <div>
                    <div className="font-bold">{alert.title}</div>
                    <div className="text-muted-foreground">
                      {formatDateTime(alert.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
              {failedMessages.slice(0, 4).map((message) => (
                <div
                  key={message.id}
                  className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm"
                >
                  <MailWarning
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                  />
                  <div>
                    <div className="font-bold">
                      Nedoručeno: {message.channel}
                    </div>
                    <div className="text-muted-foreground">
                      {formatDateTime(message.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
              {openAlerts.length === 0 && failedMessages.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Nic nevyžaduje pozornost.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** `Intl` gives a lowercase Czech weekday; a headline starts upper case. */
function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
