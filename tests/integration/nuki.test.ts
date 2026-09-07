import assert from "node:assert/strict";
import { test, mock } from "node:test";

mock.module("../../src/lib/env.ts", {
  namedExports: {
    hasEnv: () => true,
    requireEnv: () => ({
      NUKI_API_TOKEN: "test-only",
      NUKI_SMARTLOCK_ID: "test-lock",
    }),
  },
});
const { createKeypadCode, revokeKeypadCode, keypadCodeName } =
  await import("../../src/lib/integrations/nuki");
const params = {
  name: keypadCodeName("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
  code: 234567,
  allowedFrom: new Date("2090-01-01T09:00:00Z"),
  allowedUntil: new Date("2090-01-01T10:30:00Z"),
};
const auth = {
  id: "auth-1",
  name: params.name,
  type: 13,
  enabled: true,
  allowedFromDate: params.allowedFrom.toISOString(),
  allowedUntilDate: params.allowedUntil.toISOString(),
};
const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });

test("Nuki code is ready only after the queued operation completes with the exact window", async (t) => {
  let reads = 0;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      if (options.method === "PUT") {
        const sent = JSON.parse(String(options.body));
        assert.equal(sent.remoteAllowed, false);
        assert.equal(sent.name.length <= 20, true);
        return new Response(null, { status: 204 });
      }
      reads++;
      return json([
        { ...auth, operationId: reads === 1 ? "queued" : undefined },
      ]);
    },
  );
  let resolved = false;
  const pending = createKeypadCode(params).then((value) => {
    resolved = true;
    return value;
  });
  // Drain the fetch/Response microtasks before advancing the polling interval.
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(resolved, false);
  t.mock.timers.tick(1000);
  const result = await pending;
  assert.deepEqual(result, { created: true, nukiAuthId: "auth-1" });
  assert.equal(reads, 2);
});

test("a queued creation reporting an error is never delivered", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) =>
      options.method === "PUT"
        ? new Response(null, { status: 204 })
        : json([{ ...auth, error: "lock offline" }]),
  );
  assert.equal((await createKeypadCode(params)).created, false);
});

test("revocation resolves an orphan by stable name and verifies deletion", async (t) => {
  let deleted = false;
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      if (options.method === "DELETE") {
        assert.match(url, /auth-1$/);
        deleted = true;
        return new Response(null, { status: 204 });
      }
      return json(deleted ? [] : [auth]);
    },
  );
  assert.equal(
    await revokeKeypadCode({ name: params.name, nukiAuthId: null }),
    true,
  );
  assert.equal(deleted, true);
});

test("unresolved or still-pending operations do not authorize a replacement", async (t) => {
  t.mock.method(globalThis, "fetch", async () => json([]));
  assert.equal(
    await revokeKeypadCode({ name: params.name, nukiAuthId: null }),
    false,
  );
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () =>
    json([{ ...auth, operationId: "queued" }]),
  );
  assert.equal(
    await revokeKeypadCode({ name: params.name, nukiAuthId: "auth-1" }),
    false,
  );
});

test("invalid keypad codes are rejected before external I/O", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw new Error("must not call");
  });
  for (const code of [123456, 203456, 23456, 2345678]) {
    assert.equal((await createKeypadCode({ ...params, code })).created, false);
  }
  assert.equal(fetch.mock.callCount(), 0);
});
