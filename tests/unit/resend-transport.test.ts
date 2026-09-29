import assert from "node:assert/strict";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { test } from "node:test";
import { createResendSender } from "../../src/lib/integrations/resend-transport";

const email = {
  to: "member@example.test",
  subject: "Test",
  html: "<p>Test</p>",
};

async function fixture(
  handler: Parameters<typeof createServer>[1],
  work: (url: string) => Promise<void>,
) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await work(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("Resend transport sends REST fields, attachments and a stable idempotency key", async () => {
  let received: Record<string, unknown> | undefined;
  let headers: IncomingHttpHeaders | undefined;
  await fixture(
    async (req, res) => {
      assert.equal(req.method, "POST");
      assert.equal(req.url, "/emails");
      headers = req.headers;
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      received = JSON.parse(Buffer.concat(chunks).toString());
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ id: "local-message-id" }));
    },
    async (baseUrl) => {
      const result = await createResendSender({
        apiKey: "fake-only",
        from: "NAVI <sender@example.test>",
        baseUrl,
      })({
        ...email,
        text: "Test",
        replyTo: "reply@example.test",
        attachments: [{ filename: "event.ics", content: "VEVTVA==" }],
        idempotencyKey: "stable-key",
      });
      assert.deepEqual(result, {
        sent: true,
        providerMessageId: "local-message-id",
      });
    },
  );
  assert.equal(headers?.authorization, "Bearer fake-only");
  assert.equal(headers?.["idempotency-key"], "stable-key");
  assert.equal(received?.reply_to, "reply@example.test");
  assert.deepEqual(received?.attachments, [
    { filename: "event.ics", content: "VEVTVA==" },
  ]);
  assert.equal(received?.from, "NAVI <sender@example.test>");
});

test("HTTP success without a message ID cannot mark a PIN email as sent", async () => {
  await fixture(
    (_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end("{}");
    },
    async (baseUrl) => {
      assert.deepEqual(
        await createResendSender({ apiKey: "fake", from: "fake", baseUrl })(
          email,
        ),
        { sent: false, error: "resend_send_unconfirmed_no_message_id" },
      );
    },
  );
});

test("a stalled send is aborted without automatically repeating the POST", async () => {
  let requests = 0;
  await fixture(
    (request, response) => {
      requests++;
      request.resume();
      response.flushHeaders();
    },
    async (baseUrl) => {
      const result = await createResendSender({
        apiKey: "fake",
        from: "fake",
        baseUrl,
        timeoutMs: 80,
      })(email);
      assert.deepEqual(result, {
        sent: false,
        error: "resend_network_unconfirmed",
      });
    },
  );
  assert.equal(requests, 1);
});

test("429 is retried once with the same payload and key; 500 is not blindly repeated", async () => {
  const bodies: string[] = [];
  const keys: (string | string[] | undefined)[] = [];
  await fixture(
    async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      bodies.push(Buffer.concat(chunks).toString());
      keys.push(req.headers["idempotency-key"]);
      res.setHeader("content-type", "application/json");
      res.statusCode = bodies.length === 1 ? 429 : 200;
      res.end(JSON.stringify({ id: "accepted-after-refusal" }));
    },
    async (baseUrl) => {
      assert.equal(
        (
          await createResendSender({
            apiKey: "fake",
            from: "fake",
            baseUrl,
            rateLimitPauseMs: 1,
          })({ ...email, idempotencyKey: "retry-key" })
        ).sent,
        true,
      );
    },
  );
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.deepEqual(keys, ["retry-key", "retry-key"]);
  let failures = 0;
  await fixture(
    (_req, res) => {
      failures++;
      res.statusCode = 500;
      res.end("sensitive provider body");
    },
    async (baseUrl) => {
      assert.deepEqual(
        await createResendSender({ apiKey: "fake", from: "fake", baseUrl })(
          email,
        ),
        { sent: false, error: "resend_http_500" },
      );
    },
  );
  assert.equal(failures, 1);
});
