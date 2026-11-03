import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:4549";
process.env.SUPABASE_SECRET_KEY = "local-unit-key";
process.env.NEXT_PUBLIC_APP_URL = "https://navigym.test";
delete process.env.SENTRY_DSN;
delete process.env.NEXT_PUBLIC_SENTRY_DSN;
const { memberAuthDirectory } =
  await import("../../src/lib/services/admin-member-auth");
const userId = "22222222-2222-4222-8222-222222222222";

test("admin Auth writes only the email, and a lost response is reconciled by reading the same account", async () => {
  const original = globalThis.fetch;
  let email = "old@example.test";
  const methods: string[] = [];
  globalThis.fetch = (async (url, init) => {
    assert.equal(new URL(String(url)).origin, "http://127.0.0.1:4549");
    assert.equal(
      new URL(String(url)).pathname,
      `/auth/v1/admin/users/${userId}`,
    );
    const method = init?.method ?? "GET";
    methods.push(method);
    if (method === "PUT") {
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body, { email: "new@example.test" });
      email = body.email;
      return new Response(
        JSON.stringify({ msg: "Temporary transport failure" }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ id: userId, email }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const auth = memberAuthDirectory();
    await auth.setEmail(userId, "new@example.test");
    assert.deepEqual(methods, ["PUT", "GET"]);
    assert.equal(await auth.getEmail(userId), "new@example.test");
  } finally {
    globalThis.fetch = original;
  }
});

test("duplicate Auth emails and mismatched returned identities are rejected without another write", async () => {
  const original = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = (async (_url, init) => {
    methods.push(init?.method ?? "GET");
    return new Response(
      JSON.stringify({
        code: "email_exists",
        error_code: "email_exists",
        msg: "Email already registered",
      }),
      {
        status: 422,
        headers: {
          "content-type": "application/json",
          "x-supabase-api-version": "2024-01-01",
        },
      },
    );
  }) as typeof fetch;
  try {
    await assert.rejects(
      memberAuthDirectory().setEmail(userId, "existing@example.test"),
      /už používá jiný zákazník/,
    );
    assert.deepEqual(methods, ["PUT"]);
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          id: "33333333-3333-4333-8333-333333333333",
          email: "other@example.test",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    await assert.rejects(memberAuthDirectory().getEmail(userId), /ověřit/);
  } finally {
    globalThis.fetch = original;
  }
});
