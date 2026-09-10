import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/guards";
import { getCustomerInvoice } from "@/lib/services/customer-orders";
import { renderPdf, pdfFilename } from "@/lib/services/invoices";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user || user.isDemo)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return new NextResponse(null, { status: 404 });
  const row = await getCustomerInvoice(user.id, id);
  if (!row) return new NextResponse(null, { status: 404 });
  const pdf = await renderPdf(row);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(row)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
