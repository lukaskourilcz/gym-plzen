import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { hasMalformedActionReference } from "../../src/lib/helpers/server-action-request";
import { middleware } from "../../src/middleware";

test("malformed action probes are refused before Auth, providers or body processing", async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    throw new Error("Unexpected network access");
  };
  try {
    for (const reference of [
      "",
      "x",
      "test",
      "not-a-real-action",
      "a".repeat(1000),
    ]) {
      const request = new NextRequest("http://localhost/index", {
        method: "POST",
        headers: { "next-action": reference },
        body: "untrusted action body",
      });
      const response = await middleware(request);
      assert.equal(response.status, 400);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(request.bodyUsed, false);
    }
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("valid action references, native forms, webhook bodies and GET requests are not changed", () => {
  for (const id of ["a".repeat(40), "01" + "b".repeat(40), "C".repeat(64)])
    assert.equal(
      hasMalformedActionReference(
        new Request("http://localhost/rezervace/udaje", {
          method: "POST",
          headers: { "next-action": id },
        }),
      ),
      false,
    );
  assert.equal(
    hasMalformedActionReference(
      new Request("http://localhost/newsletter", { method: "POST" }),
    ),
    false,
  );
  assert.equal(
    hasMalformedActionReference(
      new Request("http://localhost/api/webhooks/comgate", { method: "POST" }),
    ),
    false,
  );
  assert.equal(
    hasMalformedActionReference(
      new Request("http://localhost/", { headers: { "next-action": "x" } }),
    ),
    false,
  );
});
