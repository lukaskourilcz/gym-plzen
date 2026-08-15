import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TERMS_BODY,
  parseTermsBody,
} from "../../src/lib/content/terms";

test("approved terms contain 21 structured sections", () => {
  const sections = parseTermsBody(DEFAULT_TERMS_BODY);

  assert.equal(sections.length, 21);
  assert.deepEqual(
    sections.map((section) => section.number),
    Array.from({ length: 21 }, (_, index) => String(index + 1)),
  );
  assert.equal(sections[0]?.clauses[0]?.number, "1.1");
  assert.equal(sections.at(-1)?.clauses.at(-1)?.number, "21.8");
  assert.equal(
    sections.at(-1)?.clauses.at(-1)?.text,
    "Tyto VOP nabývají účinnosti dne 17. 8. 2026.",
  );
  assert.equal(
    sections.find((section) => section.number === "20")?.clauses.at(-1)?.text,
    "Informace o mimosoudním řešení spotřebitelských sporů jsou dostupné prostřednictvím [České obchodní inspekce](https://coi.gov.cz/informace-o-adr/?utm_source=chatgpt.com).",
  );
  assert.match(DEFAULT_TERMS_BODY, /údajůdostupných/);
  assert.doesNotMatch(DEFAULT_TERMS_BODY, /údajů dostupných/);
});

test("terms parser preserves labeled and unlabeled lists", () => {
  const sections = parseTermsBody(DEFAULT_TERMS_BODY);
  const clause = (sectionNumber: string, clauseNumber: string) =>
    sections
      .find((section) => section.number === sectionNumber)
      ?.clauses.find((item) => item.number === clauseNumber);

  assert.equal(clause("10", "10.2")?.subitems.length, 9);
  assert.deepEqual(
    clause("10", "10.2")?.subitems.map((item) => item.marker),
    ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
  );
  assert.equal(clause("16", "16.1")?.subitems.length, 6);
  assert.equal(clause("17", "17.1")?.subitems.length, 9);
  assert.ok(
    clause("17", "17.1")?.subitems.every((item) => item.marker === null),
  );
});

test("manually wrapped identity details remain in their clause", () => {
  const firstSection = parseTermsBody(DEFAULT_TERMS_BODY)[0];

  assert.match(firstSection?.clauses[0]?.text ?? "", /Klára Bílková/);
  assert.match(firstSection?.clauses[0]?.text ?? "", /Renáta Janoušková/);
  assert.match(firstSection?.clauses[2]?.text ?? "", /info@namastegym\.cz/);
  assert.match(
    firstSection?.clauses[2]?.text ?? "",
    /\[www\.namastegym\.cz\]\(http:\/\/www\.namastegym\.cz\/\)/,
  );
});
