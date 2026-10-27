import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { creditAccount, creditEntry } from "@/lib/db/schema";
import { uuidSchema } from "@/lib/validations/common";
import { formatMoney, formatDateTime } from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import { CreditEditor } from "@/components/admin/credit-editor";
import { Button } from "@/components/ui/button";
export default async function GuestWalletPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (admin.isDemo || !uuidSchema.safeParse(id).success) notFound();
  const [account] = await db
    .select()
    .from(creditAccount)
    .where(eq(creditAccount.id, id));
  if (!account?.guestEmail) notFound();
  const entries = await db
    .select()
    .from(creditEntry)
    .where(eq(creditEntry.accountId, id))
    .orderBy(desc(creditEntry.createdAt))
    .limit(100);
  return (
    <>
      <PageHeader
        title={account.guestName || account.guestEmail}
        description="Kredity neregistrovaného zákazníka"
      >
        <Button href="/admin/credits" variant="outline">
          Zpět na kredity
        </Button>
      </PageHeader>
      <p className="my-5 text-3xl font-bold">
        {formatMoney(account.balanceCents - account.reservedCents)}
      </p>
      <CreditEditor
        email={account.guestEmail}
        name={account.guestName || undefined}
        balance={account.balanceCents}
        reserved={account.reservedCents}
      />
      <h2 className="mt-6 text-xl font-bold">Historie kreditů</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Důvod</th>
              <th>Částka</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr className="border-t border-border" key={entry.id}>
                <td className="py-3">{formatDateTime(entry.createdAt)}</td>
                <td>{entry.reason}</td>
                <td>{formatMoney(entry.amountCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
