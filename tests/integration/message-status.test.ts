import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { databaseReady, resetDatabase, rows } from "./setup";
import { updateStatusByProviderId } from "../../src/lib/services/messages";

describe("provider status monotonicity", { skip: !databaseReady }, () => {
  beforeEach(resetDatabase);
  async function message(id: string) {
    await rows(
      `insert into message_delivery (channel, kind, status, recipient, provider_message_id)
       values ('email', 'access_code', 'sent', 'member@example.test', $1)`,
      [id],
    );
    const current = async () => {
      const [row] = await rows<{
        status: string;
        delivered_at: Date | null;
        read_at: Date | null;
      }>(
        "select status, delivered_at, read_at from message_delivery where provider_message_id = $1",
        [id],
      );
      return row!;
    };
    return current;
  }

  test("read cannot be downgraded by late sent, failed or delivered webhooks", async () => {
    const current = await message("late-webhooks");
    const readAt = new Date("2026-09-28T14:00Z");
    await updateStatusByProviderId({
      providerMessageId: "late-webhooks",
      status: "read",
      at: readAt,
    });
    for (const late of ["sent", "failed", "delivered"] as const)
      await updateStatusByProviderId({
        providerMessageId: "late-webhooks",
        status: late,
      });
    assert.equal((await current()).status, "read");
    const [stored] = await rows<{ at_ms: string }>(
      "select extract(epoch from read_at at time zone 'UTC') * 1000 as at_ms from message_delivery where provider_message_id = $1",
      ["late-webhooks"],
    );
    assert.equal(Number(stored?.at_ms), readAt.getTime());
    assert.ok((await current()).delivered_at);
  });

  test("delivery after an earlier failed callback may upgrade but cannot regress", async () => {
    const current = await message("late-delivery");
    await updateStatusByProviderId({
      providerMessageId: "late-delivery",
      status: "failed",
    });
    assert.equal((await current()).status, "failed");
    await updateStatusByProviderId({
      providerMessageId: "late-delivery",
      status: "delivered",
    });
    assert.equal((await current()).status, "delivered");
    await updateStatusByProviderId({
      providerMessageId: "late-delivery",
      status: "failed",
    });
    assert.equal((await current()).status, "delivered");
  });
});
