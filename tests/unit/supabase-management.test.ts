import assert from "node:assert/strict";
import test from "node:test";
import { describeSupabaseAuthFailure } from "../../src/lib/config/email-templates";

// The adapter reads its credentials from `env`, which is parsed on import.
process.env.NEXT_PUBLIC_SUPABASE_URL =
  "https://abcdefghijklmnopqrst.supabase.co";
process.env.SUPABASE_MANAGEMENT_API_TOKEN = "sbp_test_token";
const management =
  await import("../../src/lib/integrations/supabase-management");

type Call = { url: string; init: RequestInit };

function stubFetch(handler: (call: Call) => Response): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return calls;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("the sync is configured from the project URL and the token", () => {
  assert.equal(management.isSupabaseAuthTemplateSyncConfigured(), true);
});

test("a rejected PATCH reports the status and the API's message", async () => {
  const calls = stubFetch(() => jsonResponse(401, { message: "Unauthorized" }));
  const result = await management.syncSupabaseAuthEmailTemplate({
    id: "password_reset",
    template: { subject: "Obnova hesla", body: "Dobrý den, {name}." },
  });
  assert.deepEqual(result, {
    synced: false,
    reason: "request_failed",
    status: 401,
    detail: "Unauthorized",
  });

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.ok(call);
  assert.equal(
    call.url,
    "https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/config/auth",
  );
  assert.equal(call.init.method, "PATCH");
  assert.equal(
    new Headers(call.init.headers).get("authorization"),
    "Bearer sbp_test_token",
  );
  const payload = JSON.parse(String(call.init.body)) as Record<
    string,
    string | undefined
  >;
  assert.equal(payload.mailer_subjects_recovery, "Obnova hesla");
  assert.equal(payload.smtp_sender_name, "NAVI Private Gym");
  assert.match(
    payload.mailer_templates_recovery_content ?? "",
    /\/auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&(amp;)?type=recovery/,
  );
});

test("an accepted PATCH is reported as synced", async () => {
  stubFetch(() => jsonResponse(200, {}));
  assert.deepEqual(
    await management.syncSupabaseAuthEmailTemplate({
      id: "signup_confirmation",
      template: { subject: "Potvrzení registrace", body: "Ahoj {name}." },
    }),
    { synced: true },
  );
});

test("the status check tells which hosted templates carry our link", async () => {
  stubFetch(() =>
    jsonResponse(200, {
      mailer_templates_confirmation_content:
        '<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email&amp;redirect_to={{ .RedirectTo }}">Potvrdit e-mail</a>',
      mailer_templates_recovery_content:
        '<a href="{{ .ConfirmationURL }}">Reset password</a>',
      smtp_sender_name: "Namasté Private Gym",
    }),
  );
  assert.deepEqual(await management.checkSupabaseAuthTemplateSync(), {
    configured: true,
    ok: true,
    synced: { signup_confirmation: true, password_reset: false },
    senderName: "Namasté Private Gym",
  });
});

test("the status check surfaces a token the API rejects", async () => {
  stubFetch(() => jsonResponse(403, { message: "Forbidden resource" }));
  assert.deepEqual(await management.checkSupabaseAuthTemplateSync(), {
    configured: true,
    ok: false,
    status: 403,
    detail: "Forbidden resource",
  });
});

test("describeSupabaseAuthFailure renders only what is known", () => {
  assert.equal(
    describeSupabaseAuthFailure({ status: 401, detail: "Unauthorized" }),
    " (HTTP 401: Unauthorized)",
  );
  assert.equal(describeSupabaseAuthFailure({ status: 404 }), " (HTTP 404)");
  assert.equal(describeSupabaseAuthFailure({}), "");
});
