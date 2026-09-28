import { readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { BillingProfile } from "@/lib/config/billing";

/**
 * Renders a payment document to a PDF buffer.
 *
 * Server-only: pdfkit is a Node module and the fonts are read from disk.
 *
 * Bitter is embedded rather than relying on a built-in PDF font, because the
 * standard fourteen use WinAnsi encoding, which has no ě, š, č, ř, ž or ů. A
 * Czech document set in Helvetica would silently lose its diacritics : the same
 * typeface the site uses is both correct and consistent.
 */

const FONT_DIR = path.join(process.cwd(), "src/lib/pdf/fonts");

let cached: { regular: Buffer; bold: Buffer } | null = null;

function fonts() {
  if (!cached) {
    cached = {
      regular: readFileSync(path.join(FONT_DIR, "Bitter-Regular.ttf")),
      bold: readFileSync(path.join(FONT_DIR, "Bitter-Bold.ttf")),
    };
  }
  return cached;
}

export interface InvoiceDocument {
  number: string;
  issuedAt: Date;
  suppliedAt: Date;
  description: string;
  /** Lines of a multi-slot order; empty for a single item. */
  items: { description: string; totalCents: number }[];
  totalCents: number;
  baseCents: number;
  vatCents: number;
  vatRatePercent: number;
  hasVat: boolean;
  customerName: string | null;
  customerEmail: string | null;
  supplier: BillingProfile;
}

const INK = "#003527";
const MUTED = "#5a6b64";
const RULE = "#c9d3ce";

/**
 * A tax document has to show the amounts that were actually charged. Splitting
 * 289 Kč at 21% gives a base of 238,84 Kč, so rounding the rows to whole crowns
 * would both misstate the base and let base + VAT print as one crown more than
 * the total. Documents carrying a breakdown therefore use two decimals
 * throughout; without VAT every amount is a whole number of crowns already.
 */
function czk(cents: number, decimals: boolean): string {
  const value = cents / 100;
  return `${value.toLocaleString("cs-CZ", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })} Kč`;
}

function czDate(date: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Europe/Prague",
  }).format(date);
}

/** Title, and the sentence that says which kind of document this is. */
export function documentHeading(hasVat: boolean): {
  title: string;
  note: string;
} {
  return hasVat
    ? {
        title: "Faktura – daňový doklad",
        note: "Doklad o přijaté platbě. Uhrazeno v plné výši, neplaťte znovu.",
      }
    : {
        title: "Doklad o zaplacení",
        note: "Dodavatel není plátcem DPH. Uhrazeno v plné výši, neplaťte znovu.",
      };
}

export async function renderInvoicePdf(doc: InvoiceDocument): Promise<Buffer> {
  const { regular, bold } = fonts();
  const pdf = new PDFDocument({
    size: "A4",
    margin: 56,
    /*
     * Handing pdfkit the embedded font here means it never falls back to its
     * bundled Helvetica metrics, which it would otherwise read from
     * `node_modules/pdfkit/js/data/*.afm` at construction time. Those reads are
     * invisible to Next's file tracing, so skipping them removes a whole class
     * of "works locally, throws on the server".
     */
    // pdfkit's own typings declare this as a font *name*, but `font()` (which
    // this option feeds) has always accepted a Buffer too : that is exactly how
    // an embedded TTF is registered.
    font: regular as unknown as string,
    info: {
      Title: `${documentHeading(doc.hasVat).title} ${doc.number}`,
      Author: doc.supplier.legalName,
    },
  });

  const chunks: Buffer[] = [];
  pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });

  const left = pdf.page.margins.left;
  const right = pdf.page.width - pdf.page.margins.right;
  const width = right - left;
  const heading = documentHeading(doc.hasVat);

  // ── Header ────────────────────────────────────────────────────────────────
  pdf.font(bold).fontSize(20).fillColor(INK).text(heading.title, left, left);
  pdf
    .font(bold)
    .fontSize(13)
    .fillColor(INK)
    .text(`č. ${doc.number}`, left, pdf.y + 4);

  pdf
    .font(regular)
    .fontSize(9)
    .fillColor(MUTED)
    .text(heading.note, left, pdf.y + 6, { width });

  pdf
    .moveTo(left, pdf.y + 12)
    .lineTo(right, pdf.y + 12)
    .strokeColor(RULE)
    .lineWidth(1)
    .stroke();

  // ── Parties, side by side ─────────────────────────────────────────────────
  const partiesTop = pdf.y + 26;
  const columnWidth = width / 2 - 12;

  const supplierLines = [
    doc.supplier.legalName,
    doc.supplier.street,
    `${doc.supplier.zip} ${doc.supplier.city}`.trim(),
    `IČO: ${doc.supplier.ico}`,
    doc.supplier.dic ? `DIČ: ${doc.supplier.dic}` : null,
    doc.supplier.vatRatePercent > 0 ? null : "Neplátce DPH",
    doc.supplier.bankAccount ? `Účet: ${doc.supplier.bankAccount}` : null,
  ].filter((line): line is string => Boolean(line));

  const customerLines = [
    doc.customerName || "Neuvedeno",
    doc.customerEmail,
  ].filter((line): line is string => Boolean(line));

  const column = (title: string, lines: string[], x: number): number => {
    pdf
      .font(bold)
      .fontSize(8)
      .fillColor(MUTED)
      .text(title.toUpperCase(), x, partiesTop, {
        width: columnWidth,
        characterSpacing: 1.1,
      });
    pdf.font(regular).fontSize(10).fillColor(INK);
    let y = pdf.y + 6;
    for (const line of lines) {
      pdf.text(line, x, y, { width: columnWidth });
      y = pdf.y + 2;
    }
    return y;
  };

  const supplierBottom = column("Dodavatel", supplierLines, left);
  const customerBottom = column(
    "Odběratel",
    customerLines,
    left + columnWidth + 24,
  );

  // ── Dates ─────────────────────────────────────────────────────────────────
  let y = Math.max(supplierBottom, customerBottom) + 22;
  pdf
    .font(regular)
    .fontSize(10)
    .fillColor(INK)
    .text(`Datum vystavení: ${czDate(doc.issuedAt)}`, left, y)
    .text(
      `Datum uskutečnění plnění: ${czDate(doc.suppliedAt)}`,
      left,
      pdf.y + 2,
    );

  // ── Item table ────────────────────────────────────────────────────────────
  y = pdf.y + 24;
  const amountColumn = right - 110;

  pdf.moveTo(left, y).lineTo(right, y).strokeColor(RULE).lineWidth(1).stroke();

  /*
   * A multi-slot order lists every slot with what was paid for it. The
   * lines carry the amounts actually charged, VAT included, because a split
   * of the base per line would not add up to the base of the total below.
   */
  const lines =
    doc.items.length > 0
      ? doc.items.map((item) => ({
          description: item.description,
          amount: czk(item.totalCents, doc.hasVat),
        }))
      : [
          {
            description: doc.description,
            amount: czk(
              doc.hasVat ? doc.baseCents : doc.totalCents,
              doc.hasVat,
            ),
          },
        ];
  pdf
    .font(bold)
    .fontSize(8)
    .fillColor(MUTED)
    .text("POLOŽKA", left, y + 8, { width: amountColumn - left - 8 })
    .text(
      doc.items.length > 0 && doc.hasVat ? "ČÁSTKA S DPH" : "ČÁSTKA",
      amountColumn,
      y + 8,
      { width: 110, align: "right" },
    );

  if (doc.items.length > 0)
    pdf
      .font(bold)
      .fontSize(11)
      .fillColor(INK)
      .text(doc.description, left, pdf.y + 8, {
        width: amountColumn - left - 8,
      });
  for (const line of lines) {
    const itemTop = pdf.y + (doc.items.length > 0 ? 4 : 8);
    pdf
      .font(regular)
      .fontSize(11)
      .fillColor(INK)
      .text(line.description, left, itemTop, {
        width: amountColumn - left - 8,
      });
    const bottom = pdf.y;
    pdf.text(line.amount, amountColumn, itemTop, {
      width: 110,
      align: "right",
    });
    pdf.y = Math.max(bottom, pdf.y);
  }

  y = pdf.y + 14;
  pdf.moveTo(left, y).lineTo(right, y).strokeColor(RULE).stroke();

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalRow = (label: string, value: string, strong = false) => {
    const font = strong ? bold : regular;
    const size = strong ? 13 : 10;
    const rowY = pdf.y + (strong ? 12 : 8);
    pdf
      .font(font)
      .fontSize(size)
      .fillColor(strong ? INK : MUTED)
      .text(label, amountColumn - 150, rowY, { width: 150, align: "right" })
      .fillColor(INK)
      .text(value, amountColumn, rowY, { width: 110, align: "right" });
  };

  pdf.y = y;
  if (doc.hasVat) {
    totalRow("Základ daně", czk(doc.baseCents, true));
    totalRow(`DPH ${doc.vatRatePercent} %`, czk(doc.vatCents, true));
  }
  totalRow("Celkem k úhradě", czk(doc.totalCents, doc.hasVat), true);

  pdf
    .font(regular)
    .fontSize(9)
    .fillColor(MUTED)
    .text("Uhrazeno platební kartou.", left, pdf.y + 16, {
      width,
      align: "right",
    });

  // ── Footer ────────────────────────────────────────────────────────────────
  if (doc.supplier.registryNote) {
    pdf
      .font(regular)
      .fontSize(8)
      .fillColor(MUTED)
      .text(doc.supplier.registryNote, left, pdf.page.height - 88, {
        width,
        align: "center",
      });
  }

  pdf.end();
  return done;
}
