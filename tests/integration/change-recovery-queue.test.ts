import {
  databaseReady,
  resetDatabase,
  rows,
  seedProfile,
  resend,
  comgate,
  stopEverything,
} from "./setup";
import { after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { retryPaidChanges } from "../../src/lib/services/priced-rescheduling";

describe("abandoned change recovery queue", { skip: !databaseReady }, () => {
  const userId = "44444444-4444-4444-8444-444444444444";
  after(stopEverything);
  beforeEach(async () => {
    await resetDatabase();
    await seedProfile({
      id: userId,
      email: "recovery@example.test",
      fullName: "Synthetic Recovery",
    });
  });
  test("expired changes with an uncertain payment cannot starve an orphaned change after a process crash", async () => {
    for (let n = 0; n < 12; n++) {
      const [reservation] = await rows<{ id: string }>(
        `insert into reservation(user_id,starts_at,ends_at,status,price_cents)
        values($1,now()+interval '2 days'+$2*interval '2 hours',now()+interval '2 days 1 hour'+$2*interval '2 hours','confirmed',19900) returning id`,
        [userId, n],
      );
      const [block] = await rows<{ id: string }>(
        "insert into blocked_slot(starts_at,ends_at,reason) values(now()+interval '10 days',now()+interval '10 days 1 hour','other') returning id",
      );
      const [change] = await rows<{ id: string }>(
        `insert into reservation_change(id,reservation_id,user_id,starts_at,ends_at,previous_starts_at,previous_price_cents,new_price_cents,cash_cents,status,expires_at,quote,block_id)
        select gen_random_uuid(),id,user_id,starts_at+interval '10 days',ends_at+interval '10 days',starts_at,19900,29900,10000,'awaiting_payment',now()-interval '1 hour','{}',$2 from reservation where id=$1 returning id`,
        [reservation!.id, block!.id],
      );
      if (n < 11)
        await rows(
          "insert into payment(user_id,reservation_change_id,type,status,amount_cents,failure_reason) values($1,$2,'one_off','processing',10000,'creation_unknown')",
          [userId, change!.id],
        );
    }
    await rows(`insert into access_code(reservation_id,code_hash,valid_from,valid_until,provision_state)
      select id,'synthetic-hash-'||id,starts_at,ends_at,'prepared' from reservation`);
    await rows(
      `insert into credit_account(user_id,balance_cents,reserved_cents) values($1,1000,500)`,
      [userId],
    );
    await rows(
      `insert into credit_entry(account_id,amount_cents,reason,operation_key) select id,1000,'Synthetic grant','queue-grant' from credit_account`,
    );
    await rows(`insert into credit_hold(operation_key,account_id,amount_cents)
      select 'change:'||c.id,a.id,500 from reservation_change c cross join credit_account a
      where not exists(select 1 from payment p where p.reservation_change_id=c.id)`);
    await rows(`update reservation_change c set credit_cents=500,cash_cents=9500
      where not exists(select 1 from payment p where p.reservation_change_id=c.id)`);
    const reservations = await rows("select * from reservation order by id");
    const payments = await rows("select * from payment order by id");
    const codes = await rows("select * from access_code order by id");
    const ledger = await rows("select * from credit_entry order by id");
    await retryPaidChanges(10);
    const state = await rows<{ status: string; block_id: string | null }>(
      "select c.status,c.block_id from reservation_change c where not exists(select 1 from payment p where p.reservation_change_id=c.id)",
    );
    assert.equal(state[0]!.status, "cancelled");
    assert.equal(state[0]!.block_id, null);
    assert.equal((await rows("select * from blocked_slot")).length, 11);
    assert.deepEqual(
      await rows("select * from reservation order by id"),
      reservations,
    );
    assert.deepEqual(await rows("select * from payment order by id"), payments);
    assert.deepEqual(
      await rows("select * from access_code order by id"),
      codes,
    );
    assert.deepEqual(
      await rows("select * from credit_entry order by id"),
      ledger,
    );
    assert.equal(
      (
        await rows<{ reserved_cents: number }>(
          "select reserved_cents from credit_account",
        )
      )[0]!.reserved_cents,
      0,
    );
    assert.equal(
      (await rows<{ status: string }>("select status from credit_hold"))[0]!
        .status,
      "released",
    );
    await retryPaidChanges(10);
    assert.equal((await rows("select * from blocked_slot")).length, 11);
    assert.equal(resend.sent.length, 0);
    assert.equal(comgate.creates.length, 0);
    assert.equal(comgate.refunds.length, 0);
  });
});
