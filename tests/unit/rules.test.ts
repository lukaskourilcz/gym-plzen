import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_RULES_BODY,
  parseRulesBody,
} from "../../src/lib/content/rules";

test("approved operating rules contain nine structured sections", () => {
  const sections = parseRulesBody(DEFAULT_RULES_BODY);

  assert.ok(DEFAULT_RULES_BODY.length <= 10_000);
  assert.equal(sections.length, 9);
  assert.deepEqual(
    sections.map((section) => section.number),
    ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
  );
  assert.equal(
    sections.reduce((count, section) => count + section.clauses.length, 0),
    36,
  );
  assert.equal(sections[0]?.clauses[0]?.number, "1.1");
  assert.equal(sections.at(-1)?.clauses.at(-1)?.number, "9.2");
});

test("manually wrapped CMS clauses keep their continuation text", () => {
  const [section] = parseRulesBody(
    "1. Nadpis\n\n1.1. První část věty.\nPokračování věty.",
  );

  assert.equal(section?.clauses[0]?.text, "První část věty. Pokračování věty.");
});
