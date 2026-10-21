import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultPublicNotices,
  parseNoticeFields,
  renderNotice,
  saveNoticeSchema,
} from "../../src/lib/config/public-notices";
import { cancellationPrice } from "../../src/lib/config/customer-cancellation";

test("notice edits allow only known dialogs and fields, require complete copy, preserve required facts", () => {
  const fields = defaultPublicNotices().cancellation;
  assert.equal(
    saveNoticeSchema.safeParse({ id: "cancellation", fields }).success,
    true,
  );
  for (const input of [
    { id: "booking.operations", fields },
    { id: "cancellation", fields: { ...fields, unknown: "text" } },
    { id: "cancellation", fields: { title: "Jen nadpis" } },
    { id: "cancellation", fields: { ...fields, title: " " } },
    { id: "cancellation", fields: { ...fields, keep: "a".repeat(101) } },
    { id: "cancellation", fields: { ...fields, refund: "Peníze vracíme" } },
    { id: "cancellation", fields: { ...fields, title: "{private_token}" } },
  ])
    assert.equal(saveNoticeSchema.safeParse(input).success, false);
  for (const selection of ["Nový termín: {time}", "Cena: {price}"])
    assert.equal(
      saveNoticeSchema.safeParse({
        id: "reschedule",
        fields: { ...defaultPublicNotices().reschedule, selection },
      }).success,
      false,
    );
});
test("partial or corrupted stored copy falls back field by field and never leaks unknown keys", () => {
  const parsed = parseNoticeFields("cancellation", {
    title: " Vlastní nadpis ",
    body: 42,
    refund: "Chybí podmínky",
    secret: "private",
  });
  assert.equal(parsed.title, "Vlastní nadpis");
  assert.equal(parsed.body, defaultPublicNotices().cancellation.body);
  assert.equal(parsed.refund, "{refund_note}");
  assert.equal(parsed.secret, undefined);
  for (const invalid of [null, [], "not-json", 42])
    assert.deepEqual(
      parseNoticeFields("cookies", invalid),
      defaultPublicNotices().cookies,
    );
});
test("refund copy retains actual paid, free and bonus facts, including paid accompaniment", () => {
  for (const [
    priceCents,
    loyaltyReward,
    additionalPeoplePaidCents,
    expected,
  ] of [
    [19900, null, 10000, "299"],
    [0, 10, 0, "bonusový 10."],
    [0, null, 0, "nebyla uhrazena"],
    [null, null, 0, "nevzniká nárok"],
  ] as const) {
    const amount = cancellationPrice({
      priceCents,
      currency: "czk",
      loyaltyReward,
      additionalPeoplePaidCents,
    });
    const text = renderNotice("Před potvrzením: {refund_note}", {
      refund_note: amount.note,
    });
    assert.ok(text.includes(expected));
  }
});
test("variables are replaced once as plain text, preserving literal dollar signs and braces", () => {
  assert.equal(
    renderNotice("{time} / {price}", {
      time: "{price}<script>$&",
      price: "199 Kč",
    }),
    "{price}<script>$& / 199 Kč",
  );
});
