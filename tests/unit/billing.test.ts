import assert from "node:assert/strict";
import test from "node:test";
import {
  breakDownAmount,
  DEFAULT_BILLING_PROFILE,
  documentCounterKey,
  EMPTY_BILLING_PROFILE,
  formatDocumentNumber,
  isBillingProfileComplete,
  missingBillingFields,
  parseBillingProfile,
  type BillingProfile,
} from "../../src/lib/config/billing";
import {
  documentHeading,
  renderInvoicePdf,
} from "../../src/lib/pdf/invoice-pdf";

const COMPLETE: BillingProfile = {
  legalName: "Ukázka Fitness s.r.o.",
  street: "Americká 1234/56",
  city: "Plzeň",
  zip: "301 00",
  ico: "12345678",
  dic: "",
  vatRatePercent: 0,
  bankAccount: "",
  registryNote: "",
};

test("a half-written profile is normalised rather than trusted", () => {
  const parsed = parseBillingProfile({
    legalName: "  Ukázka  ",
    ico: 12345678,
    vatRatePercent: "21",
    nonsense: true,
  });
  assert.equal(parsed.legalName, "Ukázka");
  // A number where a string belongs is not a name: it is dropped, not coerced.
  assert.equal(parsed.ico, "");
  assert.equal(parsed.vatRatePercent, 21);
  assert.equal(parsed.city, "");

  // Out-of-range and unusable rates fall back to "not a VAT payer", which is
  // the state that prints no breakdown at all.
  assert.equal(parseBillingProfile({ vatRatePercent: -5 }).vatRatePercent, 0);
  assert.equal(parseBillingProfile({ vatRatePercent: 1000 }).vatRatePercent, 0);
  assert.equal(parseBillingProfile({ vatRatePercent: "x" }).vatRatePercent, 0);
  // Nothing saved yet is not "no issuer": it is the issuer the VOP names.
  assert.deepEqual(parseBillingProfile(null), DEFAULT_BILLING_PROFILE);
  assert.deepEqual(parseBillingProfile(undefined), DEFAULT_BILLING_PROFILE);
  // An explicitly saved-but-empty profile is an edit, and stays empty.
  assert.deepEqual(parseBillingProfile({}), EMPTY_BILLING_PROFILE);
});

test("the default issuer is the one the client's VOP names", async () => {
  // Guards against the two drifting apart: the document must never name a
  // different person or number than the legal text the client supplied.
  const fs = await import("node:fs/promises");
  const vop = await fs.readFile("src/lib/content/terms.ts", "utf8");
  assert.ok(
    vop.includes("osobou vystavující příslušné účetní a daňové doklady"),
    "the VOP still designates who issues documents",
  );
  for (const fact of [
    DEFAULT_BILLING_PROFILE.legalName,
    DEFAULT_BILLING_PROFILE.ico,
    DEFAULT_BILLING_PROFILE.street,
    DEFAULT_BILLING_PROFILE.zip,
  ]) {
    assert.ok(vop.includes(fact), `VOP does not state "${fact}"`);
  }
  // Ready to issue out of the box, so a payment is never left without a
  // document just because nobody opened the settings page.
  assert.deepEqual(missingBillingFields(DEFAULT_BILLING_PROFILE), []);
  // And no tax is claimed, because the VOP states no DIČ and no rate.
  assert.equal(DEFAULT_BILLING_PROFILE.vatRatePercent, 0);
  assert.equal(DEFAULT_BILLING_PROFILE.dic, "");
});

test("no document is issued until the operator has supplied the facts", () => {
  assert.deepEqual(missingBillingFields(EMPTY_BILLING_PROFILE), [
    "Název firmy",
    "Ulice a číslo",
    "Město",
    "PSČ",
    "IČO",
  ]);
  assert.equal(isBillingProfileComplete(EMPTY_BILLING_PROFILE), false);
  assert.equal(isBillingProfileComplete(COMPLETE), true);

  // A VAT payer additionally needs the tax number the VAT was charged under.
  const vatPayerWithoutDic = { ...COMPLETE, vatRatePercent: 21 };
  assert.deepEqual(missingBillingFields(vatPayerWithoutDic), ["DIČ"]);
  assert.equal(
    isBillingProfileComplete({ ...vatPayerWithoutDic, dic: "CZ12345678" }),
    true,
  );
});

test("a non-payer's document carries one amount and no invented tax", () => {
  const plain = breakDownAmount(28_900, 0);
  assert.deepEqual(plain, {
    totalCents: 28_900,
    baseCents: 28_900,
    vatCents: 0,
    vatRatePercent: 0,
    hasVat: false,
  });
});

test("VAT is computed down from what was actually paid", () => {
  // The customer paid 289 Kč, so that is the total; the base is derived from
  // it, never the other way round, or the printed total would not match the
  // amount that left their account.
  const split = breakDownAmount(28_900, 21);
  assert.equal(split.totalCents, 28_900);
  assert.equal(split.baseCents, 23_884);
  assert.equal(split.vatCents, 5_016);
  assert.equal(split.hasVat, true);

  // The invariant that matters to an accountant, across every plausible price
  // and rate: the parts always add back up to the total, exactly.
  for (const total of [19_900, 28_900, 10_000, 12_345, 1, 99]) {
    for (const rate of [10, 12, 15, 21, 100]) {
      const parts = breakDownAmount(total, rate);
      assert.equal(
        parts.baseCents + parts.vatCents,
        total,
        `${total} @ ${rate}%`,
      );
      assert.ok(parts.baseCents >= 0 && parts.vatCents >= 0);
    }
  }
});

test("document numbers are per-year and sort correctly as text", () => {
  assert.equal(formatDocumentNumber(2026, 1), "2026-0001");
  assert.equal(formatDocumentNumber(2026, 42), "2026-0042");
  assert.equal(formatDocumentNumber(2026, 1234), "2026-1234");
  // Zero padding is what keeps a plain string sort in issue order.
  const sorted = [
    formatDocumentNumber(2026, 10),
    formatDocumentNumber(2026, 2),
    formatDocumentNumber(2026, 1),
  ].sort();
  assert.deepEqual(sorted, ["2026-0001", "2026-0002", "2026-0010"]);
  assert.equal(documentCounterKey(2026), "invoice:2026");
});

test("the heading says which kind of document the reader is holding", () => {
  assert.match(documentHeading(true).title, /daňový doklad/i);
  assert.match(documentHeading(false).title, /Doklad o zaplacení/i);
  // A non-payer's document must say so rather than leave the reader guessing
  // why there is no VAT line.
  assert.match(documentHeading(false).note, /není plátcem DPH/i);
  assert.doesNotMatch(documentHeading(true).note, /není plátcem DPH/i);
  for (const hasVat of [true, false]) {
    assert.match(documentHeading(hasVat).note, /neplaťte znovu/i);
  }
});

test("both kinds of document render as a PDF with Czech text intact", async () => {
  const base = {
    number: "2026-0001",
    issuedAt: new Date("2026-10-04T08:00:00Z"),
    suppliedAt: new Date("2026-10-04T08:00:00Z"),
    description: "Jednorázový vstup do NAVI Private Gym, 12. 10. 2026 v 18:00",
    customerName: "Žofie Křížová-Šťastná",
    customerEmail: "zofie@example.cz",
    items: [],
  };

  const plain = await renderInvoicePdf({
    ...base,
    supplier: COMPLETE,
    ...breakDownAmount(19_900, 0),
  });
  const vat = await renderInvoicePdf({
    ...base,
    supplier: { ...COMPLETE, vatRatePercent: 21, dic: "CZ12345678" },
    ...breakDownAmount(28_900, 21),
  });

  for (const pdf of [plain, vat]) {
    assert.ok(Buffer.isBuffer(pdf));
    assert.equal(pdf.subarray(0, 4).toString("latin1"), "%PDF");
    assert.ok(pdf.length > 4_000, "a one-page document is still a few kB");
  }
  // The two differ: one carries a tax breakdown the other must not invent.
  assert.notEqual(plain.length, vat.length);
});

test("a multi-slot order renders a line per slot", async () => {
  const single = await renderInvoicePdf({
    number: "2026-0002",
    issuedAt: new Date("2026-10-04T08:00:00Z"),
    suppliedAt: new Date("2026-10-04T08:00:00Z"),
    description: "Jednorázový vstup do NAVI Private Gym, 12. 10. 2026 v 18:00",
    items: [],
    customerName: "Žofie Křížová-Šťastná",
    customerEmail: "zofie@example.cz",
    supplier: COMPLETE,
    ...breakDownAmount(45_800, 0),
  });
  const order = await renderInvoicePdf({
    number: "2026-0002",
    issuedAt: new Date("2026-10-04T08:00:00Z"),
    suppliedAt: new Date("2026-10-04T08:00:00Z"),
    description: "Vstupy do NAVI Private Gym (3×)",
    items: [
      { description: "Vstup 12. 10. 2026 v 18:00", totalCents: 22_900 },
      {
        description: "Vstup 13. 10. 2026 v 18:00 (věrnostní vstup zdarma)",
        totalCents: 0,
      },
      { description: "Vstup 14. 10. 2026 v 18:00", totalCents: 22_900 },
    ],
    customerName: "Žofie Křížová-Šťastná",
    customerEmail: "zofie@example.cz",
    supplier: COMPLETE,
    ...breakDownAmount(45_800, 0),
  });
  assert.equal(order.subarray(0, 4).toString("latin1"), "%PDF");
  assert.ok(order.length > single.length, "every slot adds a line");
});

test("the embedded font covers Czech, so no diacritic renders as .notdef", async () => {
  // pdfkit substitutes silently, so coverage is asserted against the font
  // itself: a missing ě or ů would otherwise ship as a blank box on a legal
  // document.
  // fontkit ships no type declarations, and a require() here keeps the check
  // to one line rather than adding a .d.ts for a test-only dependency.
  const { createRequire } = await import("node:module");
  const fontkit = createRequire(import.meta.url)("fontkit") as {
    openSync: (p: string) => {
      layout: (s: string) => { glyphs: { id: number }[] };
    };
  };
  const sample =
    "Příliš žluťoučký kůň úpěl ďábelské ódy ŘŠČŽÝÁÍÉŮŇŤ 289,00 Kč IČO DIČ";
  for (const file of ["Bitter-Regular.ttf", "Bitter-Bold.ttf"]) {
    const font = fontkit.openSync(`src/lib/pdf/fonts/${file}`);
    const missing = font.layout(sample).glyphs.filter((g) => g.id === 0);
    assert.equal(missing.length, 0, `${file} is missing Czech glyphs`);
  }
});

test("a payment document never blocks the entry code", async () => {
  // The reliability pipeline's invariant is that a paid customer gets in. The
  // document is an accounting convenience bolted alongside it, so its call
  // site must be wrapped: this is a structural guarantee, not a behaviour that
  // a future edit should be free to drop.
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("src/lib/services/fulfillment.ts", "utf8");
  // The call site, not the import above it.
  const call = source.indexOf("await issueDocumentFor(");
  assert.ok(call > 0, "fulfillment issues the document");
  const before = source.slice(0, call);
  const tryIndex = before.lastIndexOf("try {");
  const catchAfter = source.indexOf("catch", call);
  assert.ok(
    tryIndex > 0 && catchAfter > call,
    "issueDocumentFor must sit inside try/catch",
  );
});
