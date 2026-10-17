import test from "node:test";
import assert from "node:assert/strict";
import { blockTemplateSchema } from "../../src/lib/config/blocking";

test("template period validation returns normal validation errors for missing, impossible, reversed and oversized dates", () => {
  const template = {
    name: "Local template",
    slots: [{ dayOfWeek: 6, startMinute: 300, endMinute: 375 }],
  };
  for (const [validFrom, validTo] of [
    ["", ""],
    ["invalid", "invalid"],
    ["2026-02-30", "2026-03-01"],
    ["2026-10-18", "2026-10-17"],
    ["2026-01-01", "2027-01-02"],
  ]) {
    assert.equal(
      blockTemplateSchema.safeParse({ ...template, validFrom, validTo })
        .success,
      false,
    );
  }
  for (const [validFrom, validTo] of [
    ["2026-10-17", "2026-10-17"],
    ["2026-10-17", "2026-10-18"],
    ["2028-01-01", "2028-12-31"],
  ]) {
    assert.equal(
      blockTemplateSchema.safeParse({ ...template, validFrom, validTo })
        .success,
      true,
    );
  }
});
