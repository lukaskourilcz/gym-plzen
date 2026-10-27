import {
  databaseReady,
  resetDatabase,
  rows,
  seedProfile,
  stopEverything,
} from "./setup";
import { beforeEach, after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../src/lib/db";
import { creditCustomers } from "../../src/lib/services/credit-admin";
import {
  creditAccountForUser,
  postCreditIn,
  reserveCreditIn,
  finishCreditIn,
  getCreditWallet,
  adminCreditAccount,
  claimGuestCredits,
  assertCreditFundingIn,
} from "../../src/lib/services/credits";
const userId = "44444444-4444-4444-8444-444444444444";
describe("credit ledger", { skip: !databaseReady }, () => {
  beforeEach(async () => {
    await resetDatabase();
    await seedProfile({
      id: userId,
      email: "kredit@example.test",
      fullName: "Kredit Test",
    });
  });
  after(stopEverything);
  async function grant(amount = 10000) {
    return db.transaction(async (tx) => {
      const a = await creditAccountForUser(userId, tx);
      await postCreditIn(tx, {
        accountId: a.id,
        amountCents: amount,
        reason: "Ruční přidání",
        key: "grant",
      });
      return a;
    });
  }
  test("retry posts once and history cannot be changed or deleted", async () => {
    await grant();
    await grant();
    assert.equal((await getCreditWallet(userId)).balanceCents, 10000);
    await assert.rejects(
      rows("update credit_entry set amount_cents=1"),
      /immutable/,
    );
    await assert.rejects(rows("delete from credit_entry"), /immutable/);
  });
  test("two concurrent checkouts cannot spend the same available money", async () => {
    await grant();
    const amounts = await Promise.all(
      ["one", "two"].map((key) =>
        db.transaction((tx) => reserveCreditIn(tx, userId, key, 8000, true)),
      ),
    );
    assert.deepEqual(
      amounts.sort((a, b) => a - b),
      [2000, 8000],
    );
    for (const key of ["one", "two"])
      await db.transaction((tx) => finishCreditIn(tx, key, true));
    await db.transaction((tx) => finishCreditIn(tx, "one", true));
    assert.equal((await getCreditWallet(userId)).balanceCents, 0);
    assert.equal((await getCreditWallet(userId)).entries.length, 3);
  });
  test("reserved money cannot be deleted; release restores availability without a debit", async () => {
    const a = await grant();
    await db.transaction((tx) =>
      reserveCreditIn(tx, userId, "hold", 8000, true),
    );
    await assert.rejects(
      db.transaction((tx) =>
        postCreditIn(tx, {
          accountId: a.id,
          amountCents: -3000,
          reason: "Oprava",
          key: "correction",
        }),
      ),
      /rezervovaný/,
    );
    await db.transaction((tx) => finishCreditIn(tx, "hold", false));
    assert.equal((await getCreditWallet(userId)).availableCents, 10000);
  });
  test("positive payment funding must match a live hold, amount and verified owner", async () => {
    await grant();
    await assert.rejects(
      db.transaction((tx) =>
        assertCreditFundingIn(tx, "missing", 10000, userId),
      ),
      /ověřit/,
    );
    await db.transaction((tx) =>
      reserveCreditIn(tx, userId, "funded", 8000, true),
    );
    await db.transaction((tx) =>
      assertCreditFundingIn(tx, "funded", 8000, userId),
    );
    await assert.rejects(
      db.transaction((tx) => assertCreditFundingIn(tx, "funded", 7900, userId)),
      /ověřit/,
    );
    await assert.rejects(
      db.transaction((tx) => assertCreditFundingIn(tx, "funded", 8000, null)),
      /ověřit/,
    );
    await db.transaction((tx) => finishCreditIn(tx, "funded", false));
    await assert.rejects(
      db.transaction((tx) => assertCreditFundingIn(tx, "funded", 8000, userId)),
      /ověřit/,
    );
    assert.equal((await getCreditWallet(userId)).availableCents, 10000);
  });
  test("unclaimed guest money remains visible after an unverified profile appears", async () => {
    await db.transaction(async (tx) => {
      const account = await adminCreditAccount(
        { email: "new-account@example.test" },
        tx,
      );
      await postCreditIn(tx, {
        accountId: account.id,
        amountCents: 5000,
        reason: "Guest fixture",
        key: "unclaimed",
      });
    });
    await seedProfile({
      id: "55555555-5555-4555-8555-555555555555",
      email: "new-account@example.test",
      fullName: "New account",
    });
    const guests = await creditCustomers({
      q: "new-account@example.test",
      registration: "guest",
      sort: "balance",
      page: 1,
    });
    assert.equal(guests.length, 1);
    assert.equal(guests[0]!.balance, 5000);
    assert.equal(guests[0]!.pendingClaim, true);
  });
  test("credit overview excludes empty and spent accounts but retains fully held credit", async () => {
    await grant();
    await db.transaction((tx) =>
      reserveCreditIn(tx, userId, "fully-held", 10000, true),
    );
    const emptyId = "55555555-5555-4555-8555-555555555555";
    const spentId = "66666666-6666-4666-8666-666666666666";
    for (const [id, email] of [
      [emptyId, "empty@example.test"],
      [spentId, "spent@example.test"],
    ] as const)
      await seedProfile({ id, email, fullName: email });
    await db.transaction(async (tx) => {
      await creditAccountForUser(emptyId, tx);
      const spent = await creditAccountForUser(spentId, tx);
      await postCreditIn(tx, {
        accountId: spent.id,
        amountCents: 3000,
        reason: "Spent fixture",
        key: "spent-grant",
      });
      await reserveCreditIn(tx, spentId, "spent-order", 3000, true);
      await finishCreditIn(tx, "spent-order", true);
      const guest = await adminCreditAccount(
        { email: "positive-guest@example.test" },
        tx,
      );
      await postCreditIn(tx, {
        accountId: guest.id,
        amountCents: 5000,
        reason: "Guest fixture",
        key: "guest-grant",
      });
      await adminCreditAccount({ email: "empty-guest@example.test" }, tx);
    });
    const filters = { q: "", registration: "all", page: 1, sort: "balance" };
    const all = await creditCustomers(filters);
    assert.deepEqual(
      all.map(({ email, balance, reserved, total }) => ({
        email,
        balance,
        reserved,
        total,
      })),
      [
        {
          email: "kredit@example.test",
          balance: 10000,
          reserved: 10000,
          total: 2,
        },
        {
          email: "positive-guest@example.test",
          balance: 5000,
          reserved: 0,
          total: 2,
        },
      ],
    );
    const registered = await creditCustomers({
      ...filters,
      registration: "registered",
    });
    assert.deepEqual(
      registered.map((row) => row.id),
      [userId],
    );
    const guests = await creditCustomers({ ...filters, registration: "guest" });
    assert.deepEqual(
      guests.map((row) => row.email),
      ["positive-guest@example.test"],
    );
    assert.equal((await creditCustomers({ ...filters, q: "empty" })).length, 0);
    assert.equal((await creditCustomers({ ...filters, q: "spent" })).length, 0);
    assert.equal((await getCreditWallet(userId)).reservedCents, 10000);
    assert.equal((await getCreditWallet(spentId)).balanceCents, 0);
  });
  test("guest grants stay unclaimed until verified identity transfer, with a paired audit trail", async () => {
    await db.transaction(async (tx) => {
      const a = await adminCreditAccount({ email: "host@example.test" }, tx);
      await postCreditIn(tx, {
        accountId: a.id,
        amountCents: 5000,
        reason: "Kompenzace hostovi",
        key: "guest",
      });
    });
    assert.equal((await getCreditWallet(userId)).availableCents, 0);
    // Service is only called with confirmed Supabase email in guards.ts.
    await claimGuestCredits(userId, "host@example.test");
    await claimGuestCredits(userId, "host@example.test");
    assert.equal((await getCreditWallet(userId)).availableCents, 5000);
    assert.equal((await rows("select * from credit_entry")).length, 3);
  });
});
