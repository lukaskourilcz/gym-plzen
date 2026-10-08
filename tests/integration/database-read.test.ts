import { databaseReady, resetDatabase, rows, stopEverything } from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { sql } from "drizzle-orm";
import { readDatabase } from "../../src/lib/db/read";
import { pgErrorCode } from "../../src/lib/helpers/pg-error";
import postgres from "postgres";

describe("bounded database reads", { skip: !databaseReady }, () => {
  beforeEach(resetDatabase);
  after(stopEverything);
  test("read-only and timeout settings are transaction-local; writes cannot be retried", async () => {
    const settings = await readDatabase(async (tx) =>
      tx.execute(
        sql`select current_setting('statement_timeout') as statement, current_setting('lock_timeout') as lock, current_setting('transaction_read_only') as readonly`,
      ),
    );
    assert.deepEqual(
      { ...settings[0] },
      { statement: "5s", lock: "2s", readonly: "on" },
    );
    await assert.rejects(
      readDatabase(async (tx) =>
        tx.execute(
          sql`insert into site_setting (key,value) values ('unsafe.retry','true')`,
        ),
      ),
      (error) => pgErrorCode(error) === "25006",
    );
    assert.equal(
      (await rows("select * from site_setting where key='unsafe.retry'"))
        .length,
      0,
    );
  });
  test("a timed-out read recovers in a new transaction after a short table lock", async () => {
    const blocker = postgres(process.env.TEST_DATABASE_URL!, {
      max: 1,
      prepare: false,
    });
    let locked!: () => void;
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const hold = blocker.begin(async (tx) => {
      await tx`lock table site_setting in access exclusive mode`;
      locked();
      await tx`select pg_sleep(2.3)`;
    });
    try {
      await ready;
      let attempts = 0;
      await readDatabase(async (tx) => {
        attempts++;
        return tx.execute(sql`select key from site_setting`);
      });
      assert.equal(attempts, 2);
      await hold;
    } finally {
      await blocker.end({ timeout: 2 });
    }
  });
});
