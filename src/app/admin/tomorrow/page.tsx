import {
  OverviewIconLink,
  OverviewStatus,
} from "@/components/admin/overview-icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/guards";
import { AdminMemberName } from "@/components/admin/member-name";
import { getMemberNotes } from "@/lib/services/admin-member-notes";
import { hasDemoAdminSession } from "@/lib/auth/demo";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { formatTimeRange } from "@/lib/helpers/format";
import { getTomorrowOverview } from "@/lib/services/tomorrow";

export const metadata = { title: "Zítra" };
export const dynamic = "force-dynamic";

const CODE_LABEL: Record<string, string> = {
  awaiting_payment: "Čeká na platbu",
  scheduled: "Příprava ještě nezačala",
  missing: "Kód chybí",
  preparing: "Kód se připravuje",
  match: "Kód potvrzen v Nuki",
  mismatch: "Neshoda s Nuki – zkontrolovat",
  unavailable: "Nuki teď nelze ověřit",
};
const DELIVERY_LABEL: Record<string, string> = {
  awaiting_payment: "Čeká na platbu",
  not_applicable: "Nepoužívá se",
  scheduled: "Hodinu předem",
  pending: "Čeká na odeslání",
  queued: "Odesílá se",
  sent: "Odesláno",
  delivered: "Doručeno",
  read: "Přečteno",
  sent_early: "Kód odeslán předčasně – zkontrolovat",
  failed: "Chyba odeslání",
};

/** Read-only evening checklist. The API PIN is compared on the server. */
export default async function TomorrowPage() {
  await requireAdmin();
  const demo = await hasDemoAdminSession();
  const overview = demo ? null : await getTomorrowOverview();
  const memberNotes = overview
    ? await getMemberNotes(overview.rows.map((r) => r.userId))
    : new Map<string, string>();
  const headingDate = overview?.dateKey
    ? new Intl.DateTimeFormat("cs-CZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Prague",
      }).format(new Date(`${overview.dateKey}T12:00:00Z`))
    : "";

  return (
    <div>
      <PageHeader
        title="Zítra"
        detail={`kontrola rezervací na ${headingDate || "další den"}`}
      />
      {demo ? (
        <p className="rounded-lg border border-border p-5 text-sm">
          Ukázkový režim nezobrazuje skutečné rezervace ani stav zámku.
        </p>
      ) : overview ? (
        <>
          <div className="mb-7 flex flex-wrap gap-4">
            <StatCard label="Potvrzené rezervace" value={overview.confirmed} />
            <StatCard label="Čekající na platbu" value={overview.pending} />
            <StatCard
              label="Vyžadují kontrolu"
              value={overview.needsAttention}
            />
          </div>
          <div className="hidden lg:block">
            <Table label="Zítřejší rezervace">
              <TableHeader>
                <TableRow>
                  {[
                    "Čas",
                    "Jméno",
                    "Nuki kód",
                    "Email",
                    "Whatsapp",
                    "Potvrzeno",
                  ].map((label) => (
                    <TableHead key={label} scope="col">
                      {label}
                    </TableHead>
                  ))}
                  <TableHead scope="col" className="w-12 px-1">
                    <span className="sr-only">Rezervace</span>
                  </TableHead>
                  <TableHead scope="col" className="w-12 px-1">
                    <span className="sr-only">Profil zákazníka</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap font-semibold tabular-nums">
                      {formatTimeRange(row.startsAt, row.endsAt)}
                    </TableCell>
                    <TableCell className="min-w-32">
                      <AdminMemberName
                        name={row.contactName}
                        note={memberNotes.get(row.userId ?? "")}
                        href={
                          row.userId
                            ? `/admin/members/${row.userId}`
                            : undefined
                        }
                      />
                    </TableCell>
                    <TableCell>{CODE_LABEL[row.codeCheck]}</TableCell>
                    <TableCell>{DELIVERY_LABEL[row.email]}</TableCell>
                    <TableCell>
                      <OverviewStatus
                        active={row.whatsAppEnabled}
                        label={
                          row.whatsAppEnabled ? "Používá se" : "Nepoužívá se"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <OverviewStatus
                        active={row.status === "confirmed"}
                        label={
                          row.status === "confirmed"
                            ? "Potvrzeno"
                            : "Čeká na platbu"
                        }
                      />
                    </TableCell>
                    <TableCell className="px-1">
                      <OverviewIconLink
                        kind="reservation"
                        href={`/admin/reservations?id=${row.id}`}
                      />
                    </TableCell>
                    <TableCell className="px-1">
                      {row.userId ? (
                        <OverviewIconLink
                          kind="profile"
                          href={`/admin/members/${row.userId}`}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
                {overview.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-6 text-muted-foreground"
                    >
                      Na zítřek zatím nejsou žádné rezervace.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-4 lg:hidden">
            {overview.rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <strong className="tabular-nums">
                        {formatTimeRange(row.startsAt, row.endsAt)}
                      </strong>
                      <AdminMemberName
                        className="ml-3"
                        name={row.contactName}
                        note={memberNotes.get(row.userId ?? "")}
                        href={
                          row.userId
                            ? `/admin/members/${row.userId}`
                            : undefined
                        }
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {row.status === "pending"
                        ? "Čeká na platbu"
                        : "Potvrzená"}
                    </span>
                  </div>
                  <dl className="grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Kód a Nuki</dt>
                      <dd className="font-semibold">
                        {CODE_LABEL[row.codeCheck]}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">E-mail s kódem</dt>
                      <dd className="font-semibold">
                        {DELIVERY_LABEL[row.email]}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">WhatsApp</dt>
                      <dd className="font-semibold">
                        <OverviewStatus
                          active={row.whatsAppEnabled}
                          label={
                            row.whatsAppEnabled ? "Používá se" : "Nepoužívá se"
                          }
                        />
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex gap-2">
                    <OverviewIconLink
                      kind="reservation"
                      href={`/admin/reservations?id=${row.id}`}
                    />
                    {row.userId ? (
                      <OverviewIconLink
                        kind="profile"
                        href={`/admin/members/${row.userId}`}
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
            {overview.rows.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                Na zítřek zatím nejsou žádné rezervace.
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
