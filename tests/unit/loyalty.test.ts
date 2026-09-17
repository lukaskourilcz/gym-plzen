import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveLoyaltyStatus,
  entriesRemainingPhrase,
  loyaltyFilledSegments,
  loyaltyProgressSentence,
  pluralEntries,
} from "../../src/lib/services/loyalty";
import {
  getEmailTemplateDefinition,
  renderEmailTemplateText,
} from "../../src/lib/config/email-templates";

test("loyalty status tracks the ten-entry cycle", () => {
  const fresh = deriveLoyaltyStatus(0);
  assert.equal(fresh.positionInCycle, 0);
  assert.equal(fresh.entriesUntilFree, 10);
  assert.equal(fresh.freeEntriesEarned, 0);
  assert.equal(fresh.nextEntryIsFree, false);

  const seven = deriveLoyaltyStatus(7);
  assert.equal(seven.entriesUntilFree, 3);
  assert.equal(seven.nextEntryIsFree, false);

  // Nine entries in: the tenth is the free one.
  const nine = deriveLoyaltyStatus(9);
  assert.equal(nine.entriesUntilFree, 1);
  assert.equal(nine.nextEntryIsFree, true);

  // A completed cycle is a full cadence away from the next free entry, never
  // "0 remaining" : the eleventh entry costs full price.
  const ten = deriveLoyaltyStatus(10);
  assert.equal(ten.positionInCycle, 0);
  assert.equal(ten.entriesUntilFree, 10);
  assert.equal(ten.freeEntriesEarned, 1);
  assert.equal(ten.nextEntryIsFree, false);

  const nineteen = deriveLoyaltyStatus(19);
  assert.equal(nineteen.nextEntryIsFree, true);
  assert.equal(nineteen.freeEntriesEarned, 1);
});

test("the loyalty sentence stays truthful and grammatical in Czech", () => {
  assert.equal(loyaltyProgressSentence(deriveLoyaltyStatus(0)), "");
  // 5 and up take the singular verb with the genitive plural.
  assert.equal(
    loyaltyProgressSentence(deriveLoyaltyStatus(1)),
    "Tohle byla vaše 1. návštěva, do vstupu zdarma zbývá 9 vstupů.",
  );
  // 2 to 4 take the plural verb.
  assert.equal(
    loyaltyProgressSentence(deriveLoyaltyStatus(8)),
    "Tohle byla vaše 8. návštěva, do vstupu zdarma zbývají 2 vstupy.",
  );
  assert.equal(
    loyaltyProgressSentence(deriveLoyaltyStatus(7)),
    "Tohle byla vaše 7. návštěva, do vstupu zdarma zbývají 3 vstupy.",
  );
  assert.equal(
    loyaltyProgressSentence(deriveLoyaltyStatus(9)),
    "Tohle byla vaše 9. návštěva. Příští vstup máte zdarma.",
  );
  assert.match(
    loyaltyProgressSentence(deriveLoyaltyStatus(10)),
    /^Tohle byla vaše 10\. návštěva a byla zdarma\./,
  );
});

test("Czech pluralisation of vstup follows 1 / 2-4 / 5+", () => {
  assert.equal(pluralEntries(1), "vstup");
  assert.equal(pluralEntries(3), "vstupy");
  assert.equal(pluralEntries(5), "vstupů");
  assert.equal(pluralEntries(0), "vstupů");
});

test("an empty loyalty variable leaves no blank block in a guest confirmation", () => {
  const template = getEmailTemplateDefinition(
    "reservation_confirmation",
  ).fallback;
  const variables = {
    name: "Klára",
    time: "pondělí v 18:00",
    duration: "75 minut",
    price: "290 Kč",
  };

  const guest = renderEmailTemplateText(template, {
    ...variables,
    loyalty: "",
  });
  assert.doesNotMatch(guest.body, /\n\s*\n\s*\n/);
  assert.doesNotMatch(guest.body, /\{loyalty\}/);
  // The detail lines are single-newline separated and must survive untouched.
  assert.match(guest.body, /Termín: pondělí v 18:00\nDélka: 75 minut/);

  const member = renderEmailTemplateText(template, {
    ...variables,
    loyalty: loyaltyProgressSentence(deriveLoyaltyStatus(7)),
  });
  assert.match(member.body, /do vstupu zdarma zbývají 3 vstupy\./);
  assert.doesNotMatch(member.body, /\n\s*\n\s*\n/);
});

test("both progress presentations fill from the same rule", () => {
  // The segment bar and the modern ring read this one number, so they cannot
  // disagree about how far along a member is.
  assert.equal(loyaltyFilledSegments(deriveLoyaltyStatus(0)), 0);
  assert.equal(loyaltyFilledSegments(deriveLoyaltyStatus(6)), 6);
  // Nine entries in, the reward is ready: the track reads full rather than 9.
  assert.equal(loyaltyFilledSegments(deriveLoyaltyStatus(9)), 10);
  // And a completed cycle starts the next one from empty.
  assert.equal(loyaltyFilledSegments(deriveLoyaltyStatus(10)), 0);
  assert.equal(loyaltyFilledSegments(deriveLoyaltyStatus(16)), 6);
});

test("the remaining-entries phrase agrees in Czech at every boundary", () => {
  // One shared phrase behind the widget and the confirmation copy.
  assert.equal(entriesRemainingPhrase(1), "zbývá 1 vstup");
  assert.equal(entriesRemainingPhrase(2), "zbývají 2 vstupy");
  assert.equal(entriesRemainingPhrase(4), "zbývají 4 vstupy");
  assert.equal(entriesRemainingPhrase(5), "zbývá 5 vstupů");
  assert.equal(entriesRemainingPhrase(10), "zbývá 10 vstupů");
});

test("the batched admin status is exposed by the loyalty service", async () => {
  const loyalty = await import("../../src/lib/services/loyalty");
  assert.equal(typeof loyalty.getLoyaltyStatusForUsers, "function");
  // An empty list must not touch the database at all.
  assert.deepEqual(await loyalty.getLoyaltyStatusForUsers([]), new Map());
});
