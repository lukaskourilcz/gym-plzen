import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
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
  scheduled: "Odejde hodinu předem",
  pending: "Čeká na odeslání",
  queued: "Odesílá se",
  sent: "Odesláno",
  delivered: "Doručeno",
  read: "Přečteno",
  failed: "Chyba odeslání",
};

/** Read-only evening checklist. The API PIN is compared on the server. */
export default async function TomorrowPage() {
  await requireAdmin();
  const demo = await hasDemoAdminSession();
  const overview = demo ? null : await getTomorrowOverview();
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
        description={
          headingDate
            ? `Kontrola rezervací na ${headingDate}`
            : "Kontrola rezervací na další den"
        }
      />
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Tady večer uvidíte, zda je pro zítřejší rezervace připravený kód a zda
        se shoduje s Nuki. E-mail s kódem a případný WhatsApp se posílají až
        hodinu před začátkem rezervace. „Odesláno“ ještě neznamená, že
        poskytovatel potvrdil doručení.
      </p>
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
          <div className="grid gap-4">
            {overview.rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <strong className="tabular-nums">
                        {formatTimeRange(row.startsAt, row.endsAt)}
                      </strong>
                      <span className="ml-3">{row.contactName}</span>
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
                        {DELIVERY_LABEL[row.whatsApp]}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex gap-4 text-sm">
                    <Link
                      className="text-accent-foreground hover:underline"
                      href={`/admin/reservations?id=${row.id}`}
                    >
                      Rezervace →
                    </Link>
                    {row.userId && (
                      <Link
                        className="text-accent-foreground hover:underline"
                        href={`/admin/members/${row.userId}`}
                      >
                        Profil zákazníka →
                      </Link>
                    )}
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
