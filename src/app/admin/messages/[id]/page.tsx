import { requireAdmin } from "@/lib/auth/guards";
import { notFound, redirect } from "next/navigation";
import { getAdminEmail, getAdminMessage } from "@/lib/services/messages";
import {
  formatChannel,
  formatDateTime,
  formatMessageKind,
  formatStatus,
} from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detail odeslaného e-mailu" };

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const email = await getAdminEmail(id);
  if (!email) {
    const message = await getAdminMessage(id);
    if (!message) notFound();
    if (message.archiveId) redirect(`/admin/messages/${message.archiveId}`);
    return (
      <div>
        <Button href="/admin/messages" variant="outline" className="mb-6">
          Zpět na odeslané zprávy
        </Button>
        <PageHeader
          title={formatMessageKind(message.kind)}
          description="Detail doručení zprávy"
        />
        <dl className="grid gap-3 rounded-lg border border-border bg-card p-6 text-sm">
          <div>
            <dt className="text-muted-foreground">Příjemce</dt>
            <dd>{message.recipient}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Kanál</dt>
            <dd>{formatChannel(message.channel)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Stav</dt>
            <dd>{formatStatus(message.status)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Vytvořeno</dt>
            <dd>{formatDateTime(message.createdAt)}</dd>
          </div>
          {message.sentAt && (
            <div>
              <dt className="text-muted-foreground">Odesláno</dt>
              <dd>{formatDateTime(message.sentAt)}</dd>
            </div>
          )}
          {message.deliveredAt && (
            <div>
              <dt className="text-muted-foreground">Doručeno</dt>
              <dd>{formatDateTime(message.deliveredAt)}</dd>
            </div>
          )}
          {message.readAt && (
            <div>
              <dt className="text-muted-foreground">Přečteno</dt>
              <dd>{formatDateTime(message.readAt)}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          Obsah této zprávy není v archivu dostupný. Náhledy e-mailů se
          uchovávají 30 dnů.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {message.reservationId && (
            <Button
              href={`/admin/reservations?id=${message.reservationId}`}
              variant="outline"
            >
              Otevřít rezervaci
            </Button>
          )}
          {message.userId && (
            <Button href={`/admin/members/${message.userId}`} variant="outline">
              Profil zákazníka
            </Button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div>
      <Button href="/admin/messages" variant="outline" className="mb-6">
        Zpět na odeslané zprávy
      </Button>
      <PageHeader
        title={email.subject}
        description="Skutečný obsah odeslaného e-mailu. Náhled je dostupný 30 dnů od odeslání."
      />
      <dl className="mb-6 grid gap-2 text-sm">
        <div>
          <dt className="inline font-medium">Příjemce: </dt>
          <dd className="inline">{email.recipient}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Odesílatel: </dt>
          <dd className="inline">{email.sender}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Odesláno: </dt>
          <dd className="inline">{formatDateTime(email.sentAt)}</dd>
        </div>
        {email.attachmentNames.length > 0 && (
          <div>
            <dt className="inline font-medium">Přílohy: </dt>
            <dd className="inline">
              {email.attachmentNames.join(", ")} (obsah příloh se neukládá)
            </dd>
          </div>
        )}
      </dl>
      <iframe
        title="Obsah odeslaného e-mailu"
        sandbox=""
        referrerPolicy="no-referrer"
        srcDoc={
          "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\">" +
          email.html
        }
        className="h-[75vh] min-h-[480px] w-full rounded-lg border bg-white"
      />
      {email.bodyText && (
        <details className="mt-4">
          <summary className="cursor-pointer font-medium">
            Textová verze
          </summary>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm">
            {email.bodyText}
          </pre>
        </details>
      )}
    </div>
  );
}
