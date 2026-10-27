import {
  databaseReady,
  resetDatabase,
  rows,
  startProviders,
  stopEverything,
} from "./setup";
import { before, beforeEach, after, test, describe } from "node:test";
import assert from "node:assert/strict";
import { reconcilePendingPayments } from "../../src/lib/services/payments";
describe("payment reconciliation fairness", { skip: !databaseReady }, () => {
  before(startProviders);
  beforeEach(resetDatabase);
  after(stopEverything);
  test("never-checked intents are not starved by old unresolved payments", async () => {
    await rows(
      "insert into payment(type,provider,status,amount_cents,created_at,last_checked_at) values('one_off','comgate','processing',1000,now()-interval '1 day',now()-interval '2 hours')",
    );
    const [fresh] = await rows<{ id: string }>(
      "insert into payment(type,provider,status,amount_cents,created_at,last_checked_at) values('one_off','comgate','processing',1000,now()-interval '10 minutes',null) returning id",
    );
    await reconcilePendingPayments(1);
    const [updated] = await rows<{ last_checked_at: Date | null }>(
      "select last_checked_at from payment where id=$1",
      [fresh!.id],
    );
    assert.ok(
      updated!.last_checked_at,
      "an unexamined intent must receive its first check",
    );
  });
});
