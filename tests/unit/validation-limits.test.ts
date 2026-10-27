import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

test("oversized collections are rejected before traversing attacker-controlled elements", () => {
  let reads = 0;
  const item = {
    get value() {
      reads++;
      return "text";
    },
  };
  const schema = z.array(z.object({ value: z.string() })).max(2);
  const result = schema.safeParse(Array.from({ length: 10000 }, () => item));
  assert.equal(result.success, false);
  assert.equal(
    reads,
    0,
    "size limit must stop parsing, not allocate an issue per element",
  );
});
