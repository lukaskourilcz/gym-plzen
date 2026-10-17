import {
  databaseReady,
  resetDatabase,
  rows,
  seedProfile,
  resend,
  stopEverything,
} from "./setup";
import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import { env } from "../../src/lib/env";
import { reconcileRevocations } from "../../src/lib/services/access-codes";
import { checkAvailability } from "../../src/lib/services/availability";
const sql = databaseReady
  ? postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 })
  : null;
async function run(phase: "convert" | "finalize", ids: string[]) {
  const text = await readFile(`scripts/ops/${phase}-legacy-blocks.sql`, "utf8");
  await sql!.begin(async (tx) => {
    await tx`select set_config('gym.legacy_conversion_ids',${ids.join(",")},true)`;
    await tx.unsafe(text);
  });
}
const start = new Date("2030-10-26T03:00:00Z"),
  end = new Date("2030-10-26T04:15:00Z");
let admin: string;
async function empty(status = "confirmed", offset = 0) {
  const [r] = await rows<{ id: string }>(
    "insert into reservation(starts_at,ends_at,status,created_by_admin_id) values($1,$2,$3,$4) returning id",
    [new Date(+start + offset), new Date(+end + offset), status, admin],
  );
  return r!.id;
}
describe("explicit legacy block conversion", { skip: !databaseReady }, () => {
  beforeEach(async () => {
    await resetDatabase();
    admin = randomUUID();
    await seedProfile({
      id: admin,
      email: "admin@example.test",
      fullName: "Synthetic operator",
    });
    await rows("update profiles set role='admin' where id=$1", [admin]);
  });
  after(async () => {
    await sql?.end({ timeout: 2 });
    await stopEverything();
  });
  test("conversion and replay preserve availability and actual customer data without messages; cancelled slots stay free", async () => {
    const a = await empty(),
      b = await empty("cancelled", 86400000);
    const [customer] = await rows<{ id: string }>(
      "insert into reservation(starts_at,ends_at,status,contact_name,contact_email) values($1,$2,'confirmed','Real customer','customer@example.test') returning id",
      [new Date(+start + 172800000), new Date(+end + 172800000)],
    );
    const before = await rows("select * from reservation where id=$1", [
      customer!.id,
    ]);
    await run("convert", [a, b]);
    await run("convert", [a, b]);
    assert.equal((await rows("select * from block_application")).length, 2);
    assert.equal((await rows("select * from blocked_slot")).length, 1);
    await run("finalize", [a, b]);
    await run("finalize", [a, b]);
    assert.equal(
      (
        await rows("select * from reservation where id=any($1::uuid[])", [
          [a, b],
        ])
      ).length,
      0,
    );
    assert.deepEqual(
      await rows("select * from reservation where id=$1", [customer!.id]),
      before,
    );
    assert.equal((await checkAvailability(start, end)).reason, "overlap_block");
    assert.equal(
      (
        await checkAvailability(
          new Date(+start + 86400000),
          new Date(+end + 86400000),
        )
      ).reason,
      undefined,
    );
    assert.equal((await rows("select * from message_delivery")).length, 0);
    assert.equal(resend.sent.length, 0);
  });
  test("live codes retain their reservation link until the real revocation path confirms removal from an online lock", async () => {
    const id = await empty();
    await rows(
      "insert into access_code(reservation_id,code_hash,lock_id,nuki_auth_id,valid_from,valid_until,status) values($1,'synthetic','123','legacy-auth',$2,$3,'scheduled')",
      [id, start, end],
    );
    await run("convert", [id]);
    await run("finalize", [id]);
    assert.equal(
      (await rows("select * from reservation where id=$1", [id])).length,
      1,
    );
    const native = globalThis.fetch;
    let online = false;
    let auths = [{ id: "legacy-auth" }],
      deletes = 0;
    env.NUKI_API_TOKEN = "synthetic-only";
    env.NUKI_SMARTLOCK_ID = "123";
    globalThis.fetch = async (input, options) => {
      if (!String(input).startsWith("https://api.nuki.io/"))
        return native(input, options);
      if (options?.method === "DELETE") {
        deletes++;
        auths = [];
        return new Response(null, { status: 204 });
      }
      return Response.json(
        String(input).endsWith("/auth")
          ? auths
          : { serverState: online ? 0 : 4 },
      );
    };
    try {
      await reconcileRevocations();
      await run("finalize", [id]);
      assert.equal(
        (await rows("select * from reservation where id=$1", [id])).length,
        1,
      );
      assert.equal(deletes, 0);
      online = true;
      await rows(
        "update access_code set retry_at=null where reservation_id=$1",
        [id],
      );
      await reconcileRevocations();
    } finally {
      globalThis.fetch = native;
      delete env.NUKI_API_TOKEN;
      delete env.NUKI_SMARTLOCK_ID;
    }
    assert.equal(deletes, 1);
    await run("finalize", [id]);
    assert.equal(
      (await rows("select * from reservation where id=$1", [id])).length,
      0,
    );
    assert.equal(
      (await rows("select * from access_code where reservation_id=$1", [id]))
        .length,
      0,
    );
    assert.equal((await rows("select * from blocked_slot")).length, 1);
    assert.equal((await rows("select * from message_delivery")).length, 0);
    assert.equal(resend.sent.length, 0);
  });
  test("any customer contact, financial link or changed reservation aborts the whole transaction", async () => {
    const a = await empty(),
      b = await empty("confirmed", 86400000);
    await rows(
      "update reservation set contact_email='customer@example.test' where id=$1",
      [b],
    );
    await assert.rejects(run("convert", [a, b]), /empty administrative block/);
    assert.equal((await rows("select * from blocked_slot")).length, 0);
    assert.equal((await rows("select * from block_application")).length, 0);
    await rows("update reservation set contact_email=null where id=$1", [b]);
    await rows(
      "insert into payment(reservation_id,type,status,amount_cents) values($1,'one_off','succeeded',19900)",
      [b],
    );
    await assert.rejects(run("convert", [a, b]), /empty administrative block/);
    assert.equal((await rows("select * from blocked_slot")).length, 0);
    await rows("delete from payment where reservation_id=$1", [b]);
    await run("convert", [a, b]);
    await rows(
      "update reservation set contact_phone='+420777000111' where id=$1",
      [a],
    );
    await assert.rejects(run("finalize", [a, b]), /has changed/);
    assert.equal(
      (
        await rows("select * from reservation where id=any($1::uuid[])", [
          [a, b],
        ])
      ).length,
      2,
    );
  });
});
