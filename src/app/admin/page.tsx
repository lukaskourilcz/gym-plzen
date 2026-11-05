import { IncidentDetails } from "@/components/admin/incident-details";
import { ResolveAllAlertsButton } from "./alerts/resolve-all-alerts-button";
import { Pagination } from "@/components/ui/pagination";
import {
  pageFromParam,
  pageLimit,
  pageOffset,
  splitPage,
} from "@/lib/helpers/pagination";
import { programmeCodeStates } from "@/lib/services/admin-programme";
import { DailyProgramme } from "@/components/admin/daily-programme";
import { requireAdmin } from "@/lib/auth/guards";
import { AdminMemberName } from "@/components/admin/member-name";
import { getMemberNotes } from "@/lib/services/admin-member-notes";
import Link from "next/link";
import { AlertTriangle, DoorOpen, MailWarning } from "lucide-react";
import { alerts, entryLog, messages, stats } from "@/lib/services";
import { formatDateTime, formatMoney, formatTime } from "@/lib/helpers/format";
import { aggregateDayOverview, pragueDayBounds } from "@/lib/services/stats";
import { loadDemoData } from "@/lib/demo/dummy";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard, StatGroup } from "@/components/admin/stat-card";
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
export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ entriesPage?: string | string[] }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const entriesPage = pageFromParam(query.entriesPage);
  const entriesPageSize = 20;
  const now = new Date();
  const bounds = pragueDayBounds(now);
  const demo = await hasDemoAdminSession();
  const demoData = demo ? await loadDemoData(now) : null;
  const [overview, todaysEntries, incidentOverview, recentMessages] = demo
    ? [
        aggregateDayOverview(demoData!.reservations, now),
        [],
        { open: [], openCount: 0, recentClosed: [] },
        [],
      ]
    : await Promise.all([
        stats.getDayOverview(now),
        entryLog.listEntriesForDay(bounds, {
          page: entriesPage,
          pageSize: entriesPageSize,
        }),
        alerts.dashboardAlerts(new Date(now.getTime() - 24 * 60 * 60_000)),
        messages.listRecent(12),
      ]);

  // Empty live tables are shown honestly. Fixtures belong only to local demo
  // sessions, never to a quiet production day.
  const day = demoData
    ? aggregateDayOverview(demoData.reservations, now)
    : overview;
  const todaysReservations = day.reservations.filter((r) =>
    ["confirmed", "completed", "no_show"].includes(r.status),
  );
  const codeStates = demo
    ? new Map<string, { sent: boolean; used: boolean }>()
    : await programmeCodeStates(todaysReservations.map((r) => r.id));
  const entryRows = demoData
    ? demoData.entries
        .filter(
          (e) => e.occurredAt >= bounds.start && e.occurredAt < bounds.end,
        )
        .sort(
          (a, b) =>
            b.occurredAt.getTime() - a.occurredAt.getTime() ||
            b.id.localeCompare(a.id),
        )
        .slice(
          pageOffset(entriesPage, entriesPageSize),
          pageOffset(entriesPage, entriesPageSize) + pageLimit(entriesPageSize),
        )
        .map((entry) => ({
          ...entry,
          customerName:
            demoData.reservations.find((r) => r.id === entry.reservationId)
              ?.contactName ?? null,
        }))
    : todaysEntries;
  const { rows: entries, hasNext: entriesHaveNext } = splitPage(
    entryRows,
    entriesPageSize,
  );
  const messageRows = demoData
    ? demoData.messages.slice(0, 12)
    : recentMessages;

  const upcoming = todaysReservations.filter((r) => r.startsAt > now);
  const memberNotes = demo
    ? new Map<string, string>()
    : await getMemberNotes([
        ...todaysReservations.map((r) => r.userId),
        ...entries.map((entry) => entry.userId),
      ]);
  const { open: openAlerts, openCount } = incidentOverview;
  const failedMessages = messageRows.filter((m) => m.status === "failed");

  return (
    <div>
      <PageHeader title="Dnes" detail={capitalise(DAY_FORMAT.format(now))} />
      <StatGroup className="mb-8 flex flex-wrap gap-4">
        <StatCard
          label={
            upcoming[0]
              ? `Dnešní rezervace · další ${formatTime(upcoming[0].startsAt)}`
              : "Dnešní rezervace"
          }
          value={todaysReservations.length}
        />
        <StatCard
          label={
            day.freeEntries > 0
              ? `Dnešní tržba · ${day.freeEntries} bez platby`
              : "Dnešní tržba"
          }
          value={formatMoney(day.revenueCents)}
        />
        <StatCard label="Neuzavřená upozornění" value={openCount} />
        <StatCard label="Nedoručené zprávy" value={failedMessages.length} />
      </StatGroup>

      <div className="grid items-start gap-8 lg:grid-cols-2">
        <section aria-labelledby="today-programme">
          <h2 id="today-programme" className="mb-3 text-lg font-semibold">
            Dnešní program
          </h2>
          <DailyProgramme
            initialNow={now.getTime()}
            bookings={todaysReservations.map((r) => ({
              id: r.id,
              startsAt: r.startsAt.toISOString(),
              endsAt: r.endsAt.toISOString(),
              name: r.contactName ?? r.contactEmail ?? "Neuvedeno",
              memberHref: r.userId ? `/admin/members/${r.userId}` : undefined,
              note: memberNotes.get(r.userId ?? ""),
              free: r.priceCents === 0,
              codeCreated: codeStates.has(r.id),
              codeSent: codeStates.get(r.id)?.sent ?? false,
              codeUsed: codeStates.get(r.id)?.used ?? false,
            }))}
          />
          <p className="mt-3 text-sm">
            <Link
              href="/admin/reservations"
              className="text-accent-foreground hover:underline"
            >
              Všechny rezervace →
            </Link>
          </p>
        </section>

        <div className="grid content-start gap-8">
          <section aria-labelledby="today-entries">
            <h2 id="today-entries" className="mb-3 text-lg font-semibold">
              Dnešní vstupy
            </h2>
            <div className="grid gap-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm"
                >
                  <DoorOpen
                    aria-hidden="true"
                    className="size-4 shrink-0 text-accent-foreground"
                  />
                  <span className="font-medium tabular-nums">
                    {formatTime(entry.occurredAt)}
                  </span>
                  <span className="min-w-0 break-words text-muted-foreground">
                    {entry.nukiName ?? entry.trigger ?? "Zámek"}
                    {entry.customerName ? (
                      <>
                        {" "}
                        (
                        <AdminMemberName
                          name={entry.customerName}
                          note={memberNotes.get(entry.userId ?? "")}
                          href={
                            entry.userId
                              ? `/admin/members/${entry.userId}`
                              : undefined
                          }
                        />
                        )
                      </>
                    ) : null}
                  </span>
                </div>
              ))}
              {entries.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  {entriesPage === 1
                    ? "Zámek dnes nezaznamenal žádný vstup."
                    : "Na této stránce nejsou další vstupy."}
                </p>
              )}
            </div>
            <Pagination
              page={entriesPage}
              hasNext={entriesHaveNext}
              hrefForPage={(page) => `/admin?entriesPage=${page}#today-entries`}
              label="Stránkování dnešních vstupů"
            />
            {/* The lock log records unlocks, not departures. */}
            <p className="mt-2 text-xs text-muted-foreground">
              Kniha vstupů zaznamenává odemčení, nikoli odchody.
            </p>
          </section>

          <section aria-labelledby="today-activity">
            <h2 id="today-activity" className="mb-3 text-lg font-semibold">
              Co vyžaduje pozornost
            </h2>
            <div className="mb-4">
              <ResolveAllAlertsButton
                count={openCount}
                before={now.toISOString()}
              />
            </div>
            <div className="grid gap-2">
              {openAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm"
                >
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-warning"
                  />
                  <div className="min-w-0">
                    <IncidentDetails alert={alert} compact />
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
                    <div className="font-medium">
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
