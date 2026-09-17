import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { ActionError, defineAction } from "../../src/lib/helpers/action";

/** Capture console output without printing it. */
function capture<T>(run: () => Promise<T>) {
  const lines: { level: "warn" | "error"; message: string }[] = [];
  const original = { warn: console.warn, error: console.error };
  console.warn = (message: string) => lines.push({ level: "warn", message });
  console.error = (message: string) => lines.push({ level: "error", message });
  return run()
    .finally(() => {
      console.warn = original.warn;
      console.error = original.error;
    })
    .then((value) => ({ value, lines }));
}

test("an expected outcome is reported to the visitor as a warning, not an error", async () => {
  const action = defineAction({
    schema: z.object({ slot: z.string() }),
    handler: async () => {
      throw new ActionError("Tento termín je již rezervovaný.");
    },
  });
  const { value, lines } = await capture(() => action({ slot: "x" }));
  assert.deepEqual(value, {
    ok: false,
    error: "Tento termín je již rezervovaný.",
    fieldErrors: undefined,
  });
  assert.equal(lines.filter((line) => line.level === "error").length, 0);
  assert.equal(lines.length, 1);
  assert.match(lines[0]!.message, /^\[warn\] Action rejected/);
});

test("an unexpected failure stays an error and is hidden behind a generic message", async () => {
  const action = defineAction({
    schema: z.object({}),
    handler: async () => {
      throw new TypeError("Cannot read properties of undefined");
    },
  });
  const { value, lines } = await capture(() => action({}));
  assert.equal(value.ok, false);
  if (!value.ok)
    assert.equal(
      value.error,
      "Došlo k neočekávané chybě. Zkuste to prosím znovu.",
    );
  assert.equal(lines.filter((line) => line.level === "error").length, 1);
});

test("invalid input never reaches the handler", async () => {
  let called = false;
  const action = defineAction({
    schema: z.object({ email: z.string().email() }),
    handler: async () => {
      called = true;
    },
  });
  const result = await action({ email: "nope" });
  assert.equal(result.ok, false);
  assert.equal(called, false);
});
