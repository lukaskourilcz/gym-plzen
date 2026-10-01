import {
  AdminListTotal,
  AdminListFilters,
  AdminListPagination,
} from "@/components/admin/list-filters";
import { reservationInvoiceStates } from "@/lib/services/invoice-delivery";
import { ReservationInvoice } from "@/components/admin/reservation-invoice";
import {
  splitAdminPage,
  demoAdminPage,
  readAdminFilters,
  type AdminFilters,
  type AdminSearchParams,
} from "@/lib/helpers/admin-list";
import { pageFromParam, pageLimit, pageOffset } from "@/lib/helpers/pagination";
import { activityPage, memberMessagePage } from "@/lib/services/admin-lists";
import { requireAdmin } from "@/lib/auth/guards";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { activity, loyalty, members, reservations } from "@/lib/services";
import {
  formatChannel,
  formatDate,
  formatDateTime,
  formatMessageKind,
  formatMoney,
  formatPaymentStatus,
  formatStatus,
  formatTimeRange,
} from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hasDemoAdminSession } from "@/lib/auth/demo";
import { loadDemoData } from "@/lib/demo/dummy";
import { deriveLoyaltyStatus } from "@/lib/services/loyalty";
import { MemberForm } from "../member-form";
import { MemberRoleForm } from "../member-role-form";
import { ActivityActor } from "@/components/admin/activity-actor";

export const metadata = { title: "Profil člena" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * A local demo session sees the fixture members with their fixture
 * reservations and messages; nothing behind them can be edited or logged.
 */
async function loadDemoMember(id: string) {
  const data = await loadDemoData();
  const member = data.members.find((entry) => entry.user.id === id);
  if (!member) return null;
  const owned = data.reservations.filter((row) => row.userId === id);
  return {
    member,
    status: deriveLoyaltyStatus(
      owned.filter((row) => ["confirmed", "completed"].includes(row.status))
        .length,
    ),
    history: owned.map((row) => ({
      ...row,
      totalCount: owned.length,
      paymentStatus: null,
      voucherCode: null,
      invoiceId: null,
      invoiceNumber: null,
      rescheduled: false,
      orderSlots: 0,
    })),
    deliveries: data.messages
      .filter((row) => row.userId === id)
      .map((row) => ({
        ...row,
        totalCount: data.messages.filter((m) => m.userId === id).length,
      })),
    entries: [],
  };
}

/** One line of a definition list: label on the left, value on the right. */
function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

async function loadMember(
  id: string,
  filters: AdminFilters,
  pages: { reservations: number; activity: number; messages: number },
) {
  const member = await members.getMember(id);
  if (!member) return null;
  const [status, history, deliveries, entries, totals] = await Promise.all([
    loyalty.getLoyaltyStatus(id),
    reservations.listHistoryForUser(id, pageLimit(filters.pageSize), {
      offset: pageOffset(pages.reservations, filters.pageSize),
      filters,
    }),
    memberMessagePage(id, pages.messages, filters),
    activityPage(pages.activity, filters, id),
    reservations.historyTotalsForUser(id),
  ]);
  return { member, status, history, deliveries, entries, totals };
}

/**
 * Everything the administration knows about one member on a single page:
 * who they are, how to reach them, where they stand in the loyalty cycle,
 * every reservation they ever made, what was sent to them and what happened
 * around their account, with the editable fields at the end.
 */
export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<AdminSearchParams>;
}) {
  await requireAdmin();
  const { id } = await params;
  const demo = await hasDemoAdminSession();
  const query = await searchParams;
  const filters = readAdminFilters(query);
  const pages = {
    reservations: pageFromParam(query.reservationPage),
    activity: pageFromParam(query.activityPage),
    messages: pageFromParam(query.messagePage),
  };
  const loaded = demo
    ? await loadDemoMember(id)
    : UUID.test(id)
      ? await loadMember(id, filters, pages)
      : null;
  if (!loaded) notFound();
  const { member, status } = loaded;
  const historyPage = demo
    ? demoAdminPage(loaded.history, pages.reservations, filters, (r) => ({
        text: `${r.contactName ?? ""} ${r.contactEmail ?? ""}`,
        date: r.startsAt,
        status: r.status,
      }))
    : await splitAdminPage(loaded.history, pages.reservations, filters, () =>
        reservations.listHistoryForUser(id, 1, { offset: 0, filters }),
      );
  const deliveryPage = demo
    ? demoAdminPage(loaded.deliveries, pages.messages, filters, (m) => ({
        text: m.recipient,
        date: m.sentAt ?? m.createdAt,
      }))
    : await splitAdminPage(loaded.deliveries, pages.messages, filters, () =>
        memberMessagePage(id, 1, filters),
      );
  const entriesPage = await splitAdminPage(
    loaded.entries,
    pages.activity,
    filters,
    () => (demo ? Promise.resolve([]) : activityPage(1, filters, id)),
  );
  const { rows: history } = historyPage;
  const invoiceStates = demo
    ? new Map()
    : await reservationInvoiceStates(history.map((r) => r.id));
  const { rows: deliveries } = deliveryPage;
  const { rows: entries } = entriesPage;
  const totals =
    "totals" in loaded
      ? loaded.totals
      : { count: loaded.history.length, spentCents: 0 };
  const path = `/admin/members/${id}`;
  const profile = member.profile;
  const name = member.user.name || member.user.email;
  const spentCents = totals.spentCents;

  return (
    <div>
      <Link
        href="/admin/members"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-accent-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Zpět na členy
      </Link>
      <PageHeader
        title={name}
        description={<span className="break-all">{member.user.email}</span>}
      >
        <Badge variant={member.user.role === "admin" ? "accent" : "muted"}>
          {member.user.role === "admin" ? "Správce" : "Člen"}
        </Badge>
      </PageHeader>

      <div className="mb-8 flex flex-wrap gap-4">
        <StatCard label="Návštěv celkem" value={status.totalEntries} />
        <StatCard
          label={
            status.nextEntryIsFree
              ? "Do vstupu zdarma · další vstup je zdarma"
              : "Do vstupu zdarma"
          }
          value={status.nextEntryIsFree ? 0 : status.entriesUntilFree}
        />
        <StatCard
          label="Vstupů zdarma získáno"
          value={status.freeEntriesEarned}
        />
        <StatCard label="Zaplaceno celkem" value={formatMoney(spentCents)} />
      </div>

      <section aria-labelledby="member-details">
        <h2 id="member-details" className="sr-only">
          Údaje člena
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Účet a kontakt</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                <Detail label="Jméno">
                  {profile?.firstName || profile?.lastName
                    ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim()
                    : (profile?.fullName ?? "Neuvedeno")}
                </Detail>
                <Detail label="E-mail">
                  {member.user.email || "Neuvedeno"}
                </Detail>
                <Detail label="Telefon">
                  {profile?.phone ?? "Neuvedeno"}
                  {profile?.phone && profile.phoneVerified ? " (ověřený)" : ""}
                </Detail>
                <Detail label="Registrace">
                  {formatDateTime(member.user.createdAt)}
                </Detail>
                <Detail label="Poslední úprava profilu">
                  {profile ? formatDateTime(profile.updatedAt) : "Neuvedeno"}
                </Detail>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nastavení a souhlasy</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                <Detail label="Potvrzení a kódy">
                  E-mail vždy
                  {profile?.notifyByWhatsapp ? ", WhatsApp" : ""}
                  {profile?.notifyBySms ? ", SMS" : ""}
                </Detail>
                <Detail label="Souhlas s marketingem">
                  {profile?.marketingConsent
                    ? `Ano${profile.marketingConsentAt ? ` (${formatDateTime(profile.marketingConsentAt)})` : ""}`
                    : "Ne"}
                </Detail>
                <Detail label="Obchodní podmínky účtu">
                  {profile?.termsAcceptedAt
                    ? formatDateTime(profile.termsAcceptedAt)
                    : "Souhlas se dává u každé rezervace"}
                </Detail>
                <Detail label="Interní poznámka">
                  {profile?.note || "Žádná"}
                </Detail>
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>

      <AdminListFilters
        path={path}
        filters={filters}
        placeholder="E-mail nebo popis"
        dateLabel="Datum"
      />
      <section aria-labelledby="member-reservations" className="mt-10">
        <h2 id="member-reservations" className="mb-3 text-lg font-semibold">
          Rezervace ({totals.count})
        </h2>
        <AdminListTotal total={historyPage.totalCount} />
        <Table label="Rezervace člena">
          <TableHeader>
            <TableRow>
              <TableHead>Termín</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead>Cena</TableHead>
              <TableHead>Platba</TableHead>
              <TableHead>Voucher</TableHead>
              <TableHead>Doklad</TableHead>
              <TableHead>Vytvořeno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(row.startsAt)} ·{" "}
                  {formatTimeRange(row.startsAt, row.endsAt)}
                  {row.rescheduled ? (
                    <Badge variant="outline" className="ml-2">
                      Změněný termín
                    </Badge>
                  ) : null}
                  {row.orderSlots > 1 ? (
                    <Badge variant="outline" className="ml-2">
                      Objednávka {row.orderSlots} termínů
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>{formatStatus(row.status)}</TableCell>
                <TableCell>
                  {row.priceCents === 0
                    ? row.loyaltyReward
                      ? "Zdarma (věrnost)"
                      : "Zdarma (voucher)"
                    : row.priceCents != null
                      ? formatMoney(row.priceCents, row.currency)
                      : "Neuvedena"}
                </TableCell>
                <TableCell>
                  {row.paymentStatus
                    ? formatPaymentStatus(row.paymentStatus)
                    : "Bez platby"}
                </TableCell>
                <TableCell>
                  {row.voucherCode ?? (
                    <span className="text-muted-foreground">Bez voucheru</span>
                  )}
                </TableCell>
                <TableCell>
                  {row.invoiceNumber ?? (
                    <span className="text-muted-foreground">Bez dokladu</span>
                  )}
                  {!demo && invoiceStates.has(row.id) && (
                    <ReservationInvoice
                      reservationId={row.id}
                      state={invoiceStates.get(row.id)!}
                    />
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(row.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {history.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Zatím žádná rezervace.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <AdminListPagination
          path={path}
          params={query}
          page={pages.reservations}
          hasNext={historyPage.hasNext}
          pageKey="reservationPage"
          label="Stránkování rezervací člena"
        />
      </section>

      <section aria-labelledby="member-activity" className="mt-10">
        <h2 id="member-activity" className="mb-3 text-lg font-semibold">
          Historie akcí
        </h2>
        <AdminListTotal total={entriesPage.totalCount} />
        <Table label="Historie akcí člena">
          <TableHeader>
            <TableRow>
              <TableHead>Čas</TableHead>
              <TableHead>Kdo</TableHead>
              <TableHead>Akce</TableHead>
              <TableHead>Popis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(entry.occurredAt)}
                </TableCell>
                <TableCell>
                  <ActivityActor entry={entry} />
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {activity.activityActionLabel(entry.action)}
                  </Badge>
                </TableCell>
                <TableCell>{entry.summary}</TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Zatím žádná zaznamenaná akce.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <AdminListPagination
          path={path}
          params={query}
          page={pages.activity}
          hasNext={entriesPage.hasNext}
          pageKey="activityPage"
          label="Stránkování akcí člena"
        />
      </section>

      <section aria-labelledby="member-messages" className="mt-10">
        <h2 id="member-messages" className="mb-3 text-lg font-semibold">
          Odeslané zprávy
        </h2>
        <AdminListTotal total={deliveryPage.totalCount} />
        <Table label="Zprávy odeslané členovi">
          <TableHeader>
            <TableRow>
              <TableHead>Odesláno</TableHead>
              <TableHead>Kanál</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Příjemce</TableHead>
              <TableHead>Stav</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(m.createdAt)}
                </TableCell>
                <TableCell>{formatChannel(m.channel)}</TableCell>
                <TableCell>{formatMessageKind(m.kind)}</TableCell>
                <TableCell>{m.recipient}</TableCell>
                <TableCell
                  className={
                    m.status === "failed" ? "text-destructive" : undefined
                  }
                >
                  {formatStatus(m.status)}
                </TableCell>
              </TableRow>
            ))}
            {deliveries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Zatím žádná zpráva.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <AdminListPagination
          path={path}
          params={query}
          page={pages.messages}
          hasNext={deliveryPage.hasNext}
          pageKey="messagePage"
          label="Stránkování zpráv člena"
        />
      </section>

      {demo ? null : (
        <section aria-labelledby="member-edit" className="mt-10 max-w-xl">
          <h2 id="member-edit" className="mb-3 text-lg font-semibold">
            Úprava člena
          </h2>
          <Card>
            <CardContent className="p-6">
              <MemberForm member={member} />
              <MemberRoleForm
                userId={member.user.id}
                isAdmin={member.user.role === "admin"}
                name={name}
              />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
