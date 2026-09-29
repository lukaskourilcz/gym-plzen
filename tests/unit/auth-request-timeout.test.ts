import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTimeoutFetch,
  verifiedAuthUser,
} from "../../src/lib/supabase/request-timeout";

test("a stalled Auth request is actually aborted", async () => {
  let aborted = false;
  const hanging = (async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener(
        "abort",
        () => {
          aborted = true;
          reject(new DOMException("Aborted", "AbortError"));
        },
        { once: true },
      );
    })) as typeof fetch;
  await assert.rejects(
    createTimeoutFetch(20, hanging)("https://auth.example.test/user"),
    { name: "AbortError" },
  );
  assert.equal(aborted, true);
});

test("Auth request preserves an existing abort signal", async () => {
  const caller = new AbortController();
  caller.abort();
  const fake = (async (_input, init) => {
    assert.equal(init!.signal!.aborted, true);
    throw new DOMException("Aborted", "AbortError");
  }) as typeof fetch;
  await assert.rejects(
    createTimeoutFetch(1000, fake)("https://auth.example.test/user", {
      signal: caller.signal,
    }),
    { name: "AbortError" },
  );
});

test("a received header with a stalled Auth body still times out", async () => {
  const fake = (async (_input, init) =>
    new Response(
      new ReadableStream({
        start(controller) {
          init!.signal!.addEventListener(
            "abort",
            () => controller.error(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        },
      }),
      { headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  await assert.rejects(
    createTimeoutFetch(20, fake)("https://auth.example.test/user"),
    { name: "AbortError" },
  );
});

test("expired SDK refresh retries make no more network requests", async () => {
  let requests = 0;
  const fake = (async () => {
    requests++;
    return Response.json({ ok: true });
  }) as typeof fetch;
  const bounded = createTimeoutFetch(20, fake, true);
  await bounded("https://auth.example.test/user");
  await new Promise((resolve) => setTimeout(resolve, 30));
  await assert.rejects(bounded("https://auth.example.test/token"), {
    name: "AbortError",
  });
  assert.equal(requests, 1);
});

test("the server guard fails closed on a stalled or failed verified-user lookup", async () => {
  const hanging = new Promise<{
    data: { user: { id: string } | null };
    error: unknown;
  }>(() => {});
  assert.equal(await verifiedAuthUser(hanging, 20), null);
  assert.equal(
    await verifiedAuthUser(Promise.reject(new Error("offline"))),
    null,
  );
  assert.equal(
    await verifiedAuthUser(
      Promise.resolve({
        data: { user: { id: "unverified" } },
        error: new Error("invalid"),
      }),
    ),
    null,
  );
  assert.deepEqual(
    await verifiedAuthUser(
      Promise.resolve({ data: { user: { id: "verified" } }, error: null }),
    ),
    { id: "verified" },
  );
});
