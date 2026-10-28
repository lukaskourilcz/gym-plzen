import { databaseReady, resetDatabase, rows, stopEverything } from "./setup";
import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { storedCodeUsage } from "../../src/lib/services/entry-log";

describe("stored keypad history scope", { skip: !databaseReady }, () => {
  after(stopEverything);
  beforeEach(resetDatabase);
  test("the code page keeps complete visible-code evidence and counts other failures without transferring their history", async () => {
    const [booking] = await rows<{ id: string }>(
      "insert into reservation(starts_at,ends_at,status) values(now()+interval '1 day',now()+interval '25 hours','confirmed') returning id",
    );
    const [visible, other] = await rows<{ id: string }>(
      "insert into access_code(reservation_id,code_hash,valid_from,valid_until,status) select $1,n::text,now(),now()+interval '1 hour','expired' from generate_series(1,2) n returning id",
      [booking!.id],
    );
    await rows(
      `insert into entry_log(access_code_id,action,occurred_at)
      select case when n<=2500 then null else $1::uuid end,'keypad_failure_1',now() from generate_series(1,5000) n`,
      [other!.id],
    );
    await rows(
      `insert into entry_log(access_code_id,action,occurred_at) values ($1,'keypad_open',now()),($1,'keypad_failure_1',now()),(null,'unlock',now())`,
      [visible!.id],
    );
    const result = await storedCodeUsage([visible!.id]);
    assert.equal(result.unassignedFailureCount, 2500);
    assert.equal(result.uses.length, 2);
    assert.ok(result.uses.every((use) => use.codeId === visible!.id));
    const empty = await storedCodeUsage([]);
    assert.equal(empty.uses.length, 0);
    assert.equal(empty.unassignedFailureCount, 2500);
    assert.equal((await rows("select * from entry_log")).length, 5003);
  });
});
