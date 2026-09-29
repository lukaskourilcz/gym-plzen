import { databaseReady, stopEverything } from "./setup";
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { withOperationLock } from "../../src/lib/services/operation-lock";

describe("operation lock pool", { skip: !databaseReady }, () => {
  after(stopEverything);
  test(
    "five outer operations can all enter nested locks without exhausting the pool",
    { timeout: 5000 },
    async () => {
      let entered = 0;
      let open!: () => void;
      const barrier = new Promise<void>((resolve) => {
        open = resolve;
      });
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          withOperationLock(`test-outer:${i}`, async () => {
            if (++entered === 5) open();
            await barrier;
            return withOperationLock(`test-inner:${i}`, async () => i);
          }),
        ),
      );
      assert.deepEqual(results, [0, 1, 2, 3, 4]);
    },
  );
  test("sibling nested operations with the same key remain serialized", async () => {
    let active = 0;
    let peak = 0;
    await withOperationLock("test-parent", () =>
      Promise.all(
        Array.from({ length: 3 }, () =>
          withOperationLock("test-child", async () => {
            peak = Math.max(peak, ++active);
            await setTimeout(20);
            active--;
          }),
        ),
      ),
    );
    assert.equal(peak, 1);
    // The same key is reentrant inside its own call chain.
    assert.equal(
      await withOperationLock("test-reentrant", () =>
        withOperationLock("test-reentrant", async () => 42),
      ),
      42,
    );
  });
});
