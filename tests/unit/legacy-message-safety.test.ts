import { test } from "node:test";
import assert from "node:assert/strict";
process.env.WHATSAPP_ACCESS_TOKEN = "local_only_token";
process.env.WHATSAPP_PHONE_NUMBER_ID = "local-number";
process.env.GOSMS_CLIENT_ID = "local-client";
process.env.GOSMS_CLIENT_SECRET = "local-secret";
process.env.GOSMS_CHANNEL = "1";
const { sendTextMessage, sendTemplateMessage } =
  await import("../../src/lib/integrations/whatsapp");
const { sendSms } = await import("../../src/lib/integrations/gosms");
test("ambiguous WhatsApp POSTs are never repeated inside the adapter", async () => {
  const original = globalThis.fetch;
  try {
    for (const send of [
      () => sendTextMessage({ to: "+420777000000", body: "Fixture" }),
      () =>
        sendTemplateMessage({ to: "+420777000000", templateName: "fixture" }),
    ]) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        throw new TypeError("fixture lost acceptance");
      };
      assert.equal((await send()).sent, false);
      assert.equal(calls, 1);
    }
  } finally {
    globalThis.fetch = original;
  }
});
test("a malformed WhatsApp success response is not recorded as accepted", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({});
    assert.equal(
      (await sendTextMessage({ to: "+420777000000", body: "Fixture" })).sent,
      false,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("ambiguous SMS acceptance never retries the chargeable send request", async () => {
  const original = globalThis.fetch;
  let sends = 0;
  try {
    globalThis.fetch = async (input) => {
      if (String(input).includes("/oauth/"))
        return Response.json({ access_token: "local-only", expires_in: 3600 });
      sends++;
      throw new TypeError("fixture lost acceptance");
    };
    assert.equal(
      (await sendSms({ to: "+420777000000", message: "Fixture" })).sent,
      false,
    );
    assert.equal(sends, 1);
  } finally {
    globalThis.fetch = original;
  }
});
