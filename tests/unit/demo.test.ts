import assert from "node:assert/strict";
import test from "node:test";
import { fetchDemoUsers } from "../../src/lib/demo/dummy";

test("admin demo users are deterministic local Czech fixtures", async () => {
  const first = await fetchDemoUsers(15);
  const second = await fetchDemoUsers(15);

  assert.equal(first.length, 15);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.slice(0, 4).map((user) => `${user.firstName} ${user.lastName}`),
    ["Jan Novák", "Petra Svobodová", "Tomáš Dvořák", "Lucie Černá"],
  );
});
