import {
  databaseReady,
  resetDatabase,
  rows,
  stopEverything,
  resend,
} from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  applyBlockTemplates,
  cancelBlockApplication,
  listBlockTemplates,
  previewBlockApplication,
  saveBlockTemplate,
} from "../../src/lib/services/blocking";
import { checkAvailability } from "../../src/lib/services/availability";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";

const now = new Date("2026-10-16T12:00:00Z");
const slots = [
  { dayOfWeek: 0, startMinute: 300, endMinute: 375 },
  { dayOfWeek: 6, startMinute: 300, endMinute: 375 },
];
async function template() {
  return saveBlockTemplate({ name: "Synthetic weekend", slots }, null);
}
async function apply(id: string, dates = ["2026-10-24", "2026-10-25"]) {
  const input = {
    templateIds: [id],
    target: { mode: "dates" as const, dates },
  };
  const preview = await previewBlockApplication(input, now);
  const request = {
    ...input,
    operationId: randomUUID(),
    fingerprint: preview.fingerprint,
  };
  return {
    preview,
    request,
    result: await applyBlockTemplates(request, null, now),
  };
}
describe("safe template blocking", { skip: !databaseReady }, () => {
  after(stopEverything);
  beforeEach(async () => {
    await resetDatabase();
    await rows(
      "delete from block_template where id not in ('b10c0000-0000-4000-8000-000000000001','b10c0000-0000-4000-8000-000000000002','b10c0000-0000-4000-8000-000000000003')",
    );
    await rows(
      "update opening_hours set open_minute=300,close_minute=1425,slot_minutes=75",
    );
  });
  test("migration suggestions do not block anything and server-only tables use RLS", async () => {
    assert.equal((await listBlockTemplates()).length, 3);
    assert.equal((await rows("select * from blocked_slot")).length, 0);
    const security = await rows<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where relname in ('block_template','block_application')",
    );
    assert.ok(security.every((row) => row.relrowsecurity));
  });
  test("inclusive dates cross DST without moving the Prague slot, and duplicate submission is idempotent", async () => {
    const t = await template();
    const { preview, request, result } = await apply(t.id);
    assert.equal(preview.count, 2);
    assert.equal(
      preview.snapshot.windows[0]?.startISO,
      "2026-10-24T03:00:00.000Z",
    );
    assert.equal(
      preview.snapshot.windows[1]?.startISO,
      "2026-10-25T04:00:00.000Z",
    );
    assert.deepEqual(await applyBlockTemplates(request, null, now), result);
    assert.equal((await rows("select * from block_application")).length, 1);
    assert.equal((await rows("select * from blocked_slot")).length, 2);
    const range = await previewBlockApplication(
      {
        templateIds: [t.id],
        target: { mode: "range", from: "2026-10-24", to: "2026-10-25" },
      },
      now,
    );
    assert.equal(range.count, 2);
    assert.equal((await rows("select * from message_delivery")).length, 0);
    assert.equal(resend.sent.length, 0);
  });
  test("overlapping bookings, PINs, holds and original schedule remain byte-for-byte unchanged", async () => {
    const t = await template();
    const [booking] = await rows<{ id: string }>(
      "insert into reservation (starts_at,ends_at,status,contact_email,price_cents) values ($1,$2,'confirmed','local@example.test',19900) returning id",
      [
        localDateTimeToDate("2026-10-24", 300),
        localDateTimeToDate("2026-10-24", 375),
      ],
    );
    await rows(
      "insert into access_code (reservation_id,code_hash,valid_from,valid_until,status) values ($1,'synthetic-hash',$2,$3,'active')",
      [
        booking!.id,
        localDateTimeToDate("2026-10-24", 300),
        localDateTimeToDate("2026-10-24", 390),
      ],
    );
    const before = await rows(
      "select row_to_json(r) as data from reservation r union all select row_to_json(c) from access_code c union all select row_to_json(h) from opening_hours h",
    );
    const { preview, result } = await apply(t.id);
    assert.deepEqual(preview.conflicts[0]?.reservationIds, [booking!.id]);
    assert.deepEqual(
      await rows(
        "select row_to_json(r) as data from reservation r union all select row_to_json(c) from access_code c union all select row_to_json(h) from opening_hours h",
      ),
      before,
    );
    await cancelBlockApplication(result.id, now);
    assert.deepEqual(
      await rows(
        "select row_to_json(r) as data from reservation r union all select row_to_json(c) from access_code c union all select row_to_json(h) from opening_hours h",
      ),
      before,
    );
    assert.equal((await rows("select * from message_delivery")).length, 0);
  });
  test("independent overlapping batches and manual blocks survive undo, including after a booking cancellation", async () => {
    const t = await template();
    const a = await apply(t.id);
    const b = await apply(t.id);
    const start = localDateTimeToDate("2026-10-24", 300),
      end = localDateTimeToDate("2026-10-24", 375);
    await rows("insert into blocked_slot (starts_at,ends_at) values ($1,$2)", [
      start,
      end,
    ]);
    await cancelBlockApplication(a.result.id, now);
    assert.equal(
      (
        await rows("select * from blocked_slot where application_id=$1", [
          b.result.id,
        ])
      ).length,
      2,
    );
    assert.equal((await checkAvailability(start, end)).reason, "overlap_block");
    await cancelBlockApplication(b.result.id, now);
    assert.equal((await rows("select * from blocked_slot")).length, 1);
  });
  test("template edits are future-only and stale schedule/template/overlap previews are rejected atomically", async () => {
    const t = await template();
    const applied = await apply(t.id);
    const input = {
      templateIds: [t.id],
      target: { mode: "dates" as const, dates: ["2026-10-31"] },
    };
    const stale = await previewBlockApplication(input, now);
    await saveBlockTemplate(
      {
        id: t.id,
        expectedUpdatedAt: t.updatedAt.toISOString(),
        name: "Edited locally",
        slots: [{ dayOfWeek: 6, startMinute: 375, endMinute: 450 }],
      },
      null,
    );
    assert.equal(
      (
        await rows<{ snapshot: { templates: { name: string }[] } }>(
          "select snapshot from block_application where id=$1",
          [applied.result.id],
        )
      )[0]?.snapshot.templates[0]?.name,
      "Synthetic weekend",
    );
    await assert.rejects(
      applyBlockTemplates(
        { ...input, operationId: randomUUID(), fingerprint: stale.fingerprint },
        null,
        now,
      ),
      /náhled/,
    );
    const fresh = await previewBlockApplication(input, now);
    await rows("update opening_hours set open_minute=360 where day_of_week=6");
    await assert.rejects(
      applyBlockTemplates(
        { ...input, operationId: randomUUID(), fingerprint: fresh.fingerprint },
        null,
        now,
      ),
      /rozvrhu|náhled/,
    );
    assert.equal((await rows("select * from block_application")).length, 1);
  });
  test("undo never removes already started slots and replay cannot recreate a cancelled batch", async () => {
    const t = await template();
    const a = await apply(t.id);
    const removed = await cancelBlockApplication(
      a.result.id,
      localDateTimeToDate("2026-10-24", 310),
    );
    assert.equal(removed.count, 1);
    await applyBlockTemplates(a.request, null, now);
    assert.equal((await rows("select * from blocked_slot")).length, 1);
  });
});
