import { databaseReady, stopEverything } from "./setup";
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { withOperationLock } from "../../src/lib/services/operation-lock";
import { OperationBusyError } from "../../src/lib/helpers/operation-busy";

describe("operation lock pool", { skip: !databaseReady }, () => {
  after(stopEverything);
  test(
    "contention never enters or retries business work, while business failures keep their identity",
    { timeout: 10000 },
    async () => {
      let acquired!: () => void;
      const started = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      let release!: () => void;
      const finished = new Promise<void>((resolve) => {
        release = resolve;
      });
      const owner = withOperationLock("test-contention-only", async () => {
        acquired();
        await finished;
      });
      await started;
      let entered = 0;
      try {
        await assert.rejects(
          withOperationLock("test-contention-only", async () => {
            entered++;
          }),
          OperationBusyError,
        );
        assert.equal(entered, 0);
      } finally {
        release();
        await owner;
      }
      const original = Object.assign(new Error("business write timed out"), {
        code: "55P03",
      });
      await assert.rejects(
        withOperationLock("test-business-timeout", async () => {
          entered++;
          throw original;
        }),
        (error) => error === original,
      );
      assert.equal(entered, 1);
    },
  );
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
