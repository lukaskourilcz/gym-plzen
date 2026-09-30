import {
  databaseReady,
  resetDatabase,
  rows,
  seedProfile,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import {
  getActiveMembership,
  hasActiveMembership,
} from "../../src/lib/services/memberships";

const USER = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "membership@example.test",
  fullName: "Membership Fixture",
};
const NOW = new Date("2026-10-01T10:00:00Z");

async function insert(status: string, start: Date | null, end: Date | null) {
  const [row] = await rows<{ id: string }>(
    `insert into membership (user_id, status, current_period_start, current_period_end)
     values ($1, $2, $3, $4) returning id`,
    [USER.id, status, start, end],
  );
  return row!.id;
}

describe(
  "historical membership entitlement (#131)",
  { skip: !databaseReady },
  () => {
    after(stopEverything);
    beforeEach(async () => {
      await resetDatabase();
      await seedProfile(USER);
    });

    test("a later cancelled row cannot hide a valid active membership", async () => {
      const id = await insert(
        "active",
        new Date("2026-09-01Z"),
        new Date("2026-11-01Z"),
      );
      await insert(
        "canceled",
        new Date("2026-09-01Z"),
        new Date("2026-12-01Z"),
      );
      assert.equal((await getActiveMembership(USER.id, NOW))?.id, id);
      assert.equal(await hasActiveMembership(USER.id, NOW), true);
      assert.equal(
        await hasActiveMembership("33333333-3333-4333-8333-333333333333", NOW),
        false,
      );
    });

    test("expired, future, missing and inactive periods grant no entitlement", async () => {
      await insert("active", new Date("2026-09-01Z"), NOW);
      await insert("active", new Date("2026-10-02Z"), new Date("2026-11-01Z"));
      await insert("active", null, new Date("2026-11-01Z"));
      await insert("active", new Date("2026-09-01Z"), null);
      await insert(
        "past_due",
        new Date("2026-09-01Z"),
        new Date("2026-11-01Z"),
      );
      assert.equal(await getActiveMembership(USER.id, NOW), null);
      assert.equal(await hasActiveMembership(USER.id, NOW), false);
    });

    test("the period start is inclusive and the end exclusive, including trials", async () => {
      const end = new Date("2026-10-02T10:00:00Z");
      const id = await insert("trialing", NOW, end);
      assert.equal((await getActiveMembership(USER.id, NOW))?.id, id);
      assert.equal(
        await hasActiveMembership(USER.id, new Date(NOW.getTime() - 1)),
        false,
      );
      assert.equal(
        await hasActiveMembership(USER.id, new Date(end.getTime() - 1)),
        true,
      );
      assert.equal(await hasActiveMembership(USER.id, end), false);
    });
  },
);
