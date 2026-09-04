import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { invoices } from "@/lib/services";
import { logger } from "@/lib/helpers/logger";

/**
 * Streams one payment document as a PDF, rendered on demand from the stored
 * row. Administrators only : these carry customer names, e-mail addresses and
 * amounts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin();
  const { id } = await params;

  const row = await invoices.getInvoice(id);
  if (!row) return new NextResponse("Nenalezeno", { status: 404 });

  try {
    const pdf = await invoices.renderPdf(row);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoices.pdfFilename(row)}"`,
        // A document is immutable once issued, but it is also private.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    logger.error(e, { where: "admin.doklady.pdf", invoiceId: id });
    return new NextResponse("Doklad se nepodařilo vykreslit", { status: 500 });
  }
}
