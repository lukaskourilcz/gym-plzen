import PDFDocument from "pdfkit";
import path from "node:path";
import { readFileSync } from "node:fs";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import type { reservationChange } from "@/lib/db/schema";
/** Informational settlement annex; the original invoice remains immutable. */
export function renderCreditChangePdf(
  change: typeof reservationChange.$inferSelect,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Initialize with the embedded font as invoice-pdf does: server bundles
    // do not contain PDFKit's implicit Helvetica metrics.
    const font = readFileSync(
      path.join(process.cwd(), "src/lib/pdf/fonts/Bitter-Regular.ttf"),
    );
    const pdf = new PDFDocument({
      size: "A4",
      margin: 48,
      font: font as unknown as string,
    });
    const buffers: Buffer[] = [];
    pdf.on("data", (chunk) => buffers.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(buffers)));
    pdf.on("error", reject);
    pdf.fontSize(21).text("Vyúčtování změny rezervace");
    pdf.moveDown();
    pdf.fontSize(10).text(`NAVI Private Gym · ${change.id}`);
    pdf.text(`Dokončeno: ${formatDateTime(change.updatedAt)}`);
    pdf.moveDown();
    pdf.text(
      `${change.quote.customerName || "Zákazník"} · ${change.quote.customerEmail || ""}`,
    );
    pdf.moveDown();
    const lines = [
      `Původní termín: ${formatDateTime(change.previousStartsAt)}`,
      `Nový termín: ${formatDateTime(change.startsAt)}`,
      `Původní cena: ${formatMoney(change.previousPriceCents + (change.quote.additionalPeoplePaidCents ?? 0))}`,
      `Nová cena: ${formatMoney(change.newPriceCents + (change.quote.additionalPeoplePaidCents ?? 0))}`,
      `Doplatek přes Comgate: ${formatMoney(change.cashCents)}`,
      `Úhrada kreditem: ${formatMoney(change.creditCents)}`,
      `Připsaný kredit: ${formatMoney(Math.max(0, change.previousPriceCents - change.newPriceCents))}`,
      `Zůstatek kreditů po změně: ${formatMoney(change.quote.creditBalanceCents ?? 0)}`,
    ];
    for (const line of lines) {
      pdf.fontSize(12).text(line);
      pdf.moveDown(0.5);
    }
    pdf.moveDown();
    pdf
      .fontSize(10)
      .text(
        "Vyúčtování navazuje na původní objednávku a její doklad. Nejde o nový prodej dalšího vstupu ani o výzvu k opakované platbě.",
      );
    pdf.end();
  });
}
