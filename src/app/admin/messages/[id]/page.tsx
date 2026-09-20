import { notFound } from "next/navigation";
import { getAdminEmail } from "@/lib/services/messages";
import { formatDateTime } from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detail odeslaného e-mailu" };

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const email = await getAdminEmail(id);
  if (!email) notFound();
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
          <dt className="inline font-bold">Příjemce: </dt>
          <dd className="inline">{email.recipient}</dd>
        </div>
        <div>
          <dt className="inline font-bold">Odesílatel: </dt>
          <dd className="inline">{email.sender}</dd>
        </div>
        <div>
          <dt className="inline font-bold">Odesláno: </dt>
          <dd className="inline">{formatDateTime(email.sentAt)}</dd>
        </div>
        {email.attachmentNames.length > 0 && (
          <div>
            <dt className="inline font-bold">Přílohy: </dt>
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
          <summary className="cursor-pointer font-bold">Textová verze</summary>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm">
            {email.bodyText}
          </pre>
        </details>
      )}
    </div>
  );
}
