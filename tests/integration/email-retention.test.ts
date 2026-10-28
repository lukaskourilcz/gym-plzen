import {
  databaseReady,
  resetDatabase,
  rows,
  resend,
  stopEverything,
} from "./setup";
import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { purgeExpiredEmails } from "../../src/lib/services/email-archive";

describe("email body retention", { skip: !databaseReady }, () => {
  after(stopEverything);
  beforeEach(async () => {
    await resetDatabase();
    await rows("truncate email_archive");
  });
  test("expired frozen email bodies are erased without removing dedupe evidence or changing other channels", async () => {
    const now = new Date("2026-10-28T12:00:00Z");
    await rows(`insert into email_archive(provider_message_id,sender,recipient,subject,html,sent_at)
      values('old','sender@example.test','recipient@example.test','Old','private old body','2026-09-28T12:00:00Z'),
      ('new','sender@example.test','recipient@example.test','New','recent body','2026-09-28T12:00:01Z')`);
    await rows(`insert into message_delivery(channel,kind,status,recipient,dedupe_key,provider_message_id,provider_response,created_at,updated_at)
      values('email','reservation_cancellation','failed','recipient@example.test','old-email','accepted-old','{"email":{"html":"private old body"}}','2026-09-28T12:00:00Z','2026-09-29T12:00:00Z'),
      ('email','reservation_cancellation','failed','recipient@example.test','new-email',null,'{"email":{"html":"recent body"}}','2026-09-28T12:00:01Z','2026-09-29T12:00:00Z'),
      ('whatsapp','access_code','sent','+420777000000','old-whatsapp','wa-id','{"jobId":"keep-reconciliation-id"}','2026-09-01T12:00:00Z','2026-09-01T12:00:00Z')`);
    const original = await rows(
      "select * from message_delivery order by dedupe_key",
    );
    assert.equal(await purgeExpiredEmails(now), 1);
    const remaining = await rows<{ provider_message_id: string }>(
      "select provider_message_id from email_archive",
    );
    assert.deepEqual(
      remaining.map((r) => r.provider_message_id),
      ["new"],
    );
    const afterPurge = await rows(
      "select * from message_delivery order by dedupe_key",
    );
    assert.deepEqual(
      [...afterPurge],
      original.map((r) =>
        r.dedupe_key === "old-email" ? { ...r, provider_response: null } : r,
      ),
    );
    assert.equal(await purgeExpiredEmails(now), 0);
    assert.equal(resend.sent.length, 0);
    assert.equal((await rows("select * from reservation")).length, 0);
    assert.equal((await rows("select * from access_code")).length, 0);
  });
});
