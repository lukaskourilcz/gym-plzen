import { requireAdmin } from "@/lib/auth/guards";
import Link from "next/link";
import { invoices } from "@/lib/services";
import { PageHeader } from "@/components/admin/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/helpers/format";
import { ResendDocumentButton } from "./resend-button";
import { hasDemoAdminSession } from "@/lib/auth/demo";
import {
  DEFAULT_BILLING_PROFILE,
  missingBillingFields,
} from "@/lib/config/billing";

export const metadata = { title: "Doklady" };
export const dynamic = "force-dynamic";

function czk(cents: number, decimals: boolean): string {
  return `${(cents / 100).toLocaleString("cs-CZ", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })} Kč`;
}

/** Issued payment documents: what went out, to whom, and when. */
export default async function DocumentsPage() {
  await requireAdmin();
  const demo = await hasDemoAdminSession();
  const [rows, billing] = demo
    ? [
        [],
        {
          profile: DEFAULT_BILLING_PROFILE,
          missing: missingBillingFields(DEFAULT_BILLING_PROFILE),
          ready: false,
          sendingEnabled: false,
        },
      ]
    : await Promise.all([
        invoices.listInvoices(),
        invoices.getBillingReadiness(),
      ]);

  return (
    <div>
      <PageHeader
        title="Doklady"
        description="Doklady o zaplacení vystavené k potvrzeným rezervacím. Číslují se průběžně a každá rezervace dostane nejvýše jeden."
      />

      {!billing.ready && (
        <Card className="mb-6 max-w-3xl">
          <CardHeader>
            <CardTitle>Doklady se zatím nevystavují</CardTitle>
            <CardDescription>
              V{" "}
              <Link href="/admin/settings" className="underline">
                Nastavení a branding
              </Link>{" "}
              chybí: <strong>{billing.missing.join(", ")}</strong>. Systém údaje
              nikdy nedoplní za vás.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {billing.ready && !billing.sendingEnabled && (
        <Card className="mb-6 max-w-3xl">
          <CardHeader>
            <CardTitle>Automatické odesílání je vypnuté</CardTitle>
            <CardDescription>
              Údaje jsou vyplněné, ale doklady se po zaplacení neposílají.
              Zapnete to v{" "}
              <Link href="/admin/settings" className="underline">
                Nastavení a branding
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Vystavené doklady</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Zatím žádný doklad. První se vystaví po nejbližší zaplacené
              rezervaci.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-extrabold">Číslo</th>
                    <th className="py-2 pr-4 font-extrabold">Vystaveno</th>
                    <th className="py-2 pr-4 font-extrabold">Zákazník</th>
                    <th className="py-2 pr-4 font-extrabold">Částka</th>
                    <th className="py-2 pr-4 font-extrabold">Odesláno</th>
                    <th className="py-2 font-extrabold">Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border">
                      <td className="py-3 pr-4 font-bold">{row.number}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatDateTime(row.issuedAt)}
                      </td>
                      <td className="py-3 pr-4">
                        {row.customerName || "—"}
                        {row.customerEmail && (
                          <span className="block text-xs text-muted-foreground">
                            {row.customerEmail}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {czk(row.totalCents, row.vatRatePercent > 0)}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {row.sentAt ? formatDateTime(row.sentAt) : "Neodesláno"}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <a
                            href={`/admin/doklady/${row.id}/pdf`}
                            className="inline-flex min-h-11 items-center font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Stáhnout PDF
                          </a>
                          {row.customerEmail && (
                            <ResendDocumentButton
                              id={row.id}
                              number={row.number}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
