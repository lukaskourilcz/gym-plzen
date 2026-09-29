import { test } from "node:test";
import assert from "node:assert/strict";
import {
  zernioAccessPayload,
  zernioMessageId,
} from "../../src/lib/helpers/zernio-access";

test("Zernio uses approved Czech template and exact Nuki validity in the right order", () => {
  const result = zernioAccessPayload({
    accountId: "account",
    phone: "777111222",
    reservationTime: "term",
    pin: "234567",
    validFrom: "start",
    validUntil: "end+15",
  });
  assert.equal(result.participantId, "420777111222");
  assert.equal(result.templateName, "navi_rezervace_vstup_cs");
  assert.equal(result.templateLanguage, "cs");
  assert.deepEqual(result.templateParams, [
    "term",
    "234567",
    "start",
    "end+15",
  ]);
});
test("An HTTP success without an accepted message ID is not a sent message", () => {
  assert.equal(
    zernioMessageId({ success: true, data: { messageId: "wamid.test" } }),
    "wamid.test",
  );
  for (const r of [
    null,
    {},
    { success: true },
    { success: true, data: { messageId: "" } },
    { success: false, data: { messageId: "x" } },
  ])
    assert.equal(zernioMessageId(r), null);
});

test("a Zernio rejection is logged without any digits (PINs, phones)", async () => {
  const { redactedReason } = await import("../../src/lib/integrations/zernio");
  assert.equal(
    redactedReason({ error: "Account 123456 not found", code: 404 }),
    "# | Account # not found",
  );
  assert.equal(
    redactedReason({
      error: { message: "Template navi missing for 3546117942", code: 132001 },
    }),
    "# | Template navi missing for #",
  );
  assert.doesNotMatch(redactedReason("PIN 333444 rejected"), /\d/);
});
