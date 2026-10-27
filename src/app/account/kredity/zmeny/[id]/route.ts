import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { reservationChange } from "@/lib/db/schema";
import { uuidSchema } from "@/lib/validations/common";
import { renderCreditChangePdf } from "@/lib/pdf/credit-change-pdf";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  const { id } = await params;
  if (!user || user.isDemo || !uuidSchema.safeParse(id).success)
    return new Response(null, { status: 404 });
  const [change] = await db
    .select()
    .from(reservationChange)
    .where(eq(reservationChange.id, id));
  if (
    !change ||
    change.status !== "completed" ||
    (change.userId !== user.id && user.role !== "admin")
  )
    return new Response(null, { status: 404 });
  const pdf = await renderCreditChangePdf(change);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="zmena-rezervace-${id}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
