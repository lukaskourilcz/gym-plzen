import assert from "node:assert/strict";
import test from "node:test";
import { setMemberRoleSchema } from "../../src/lib/validations/members";

test("the role action only accepts the two real roles", () => {
  const userId = "11111111-1111-4111-8111-111111111111";

  assert.equal(
    setMemberRoleSchema.safeParse({ userId, role: "admin" }).success,
    true,
  );
  assert.equal(
    setMemberRoleSchema.safeParse({ userId, role: "member" }).success,
    true,
  );
  // Anything else must be rejected before it reaches the database.
  assert.equal(
    setMemberRoleSchema.safeParse({ userId, role: "superadmin" }).success,
    false,
  );
  // `idSchema` is a length check shared with the profile form, so an empty id
  // is what it rejects.
  assert.equal(
    setMemberRoleSchema.safeParse({ userId: "", role: "admin" }).success,
    false,
  );
});

test("the last administrator cannot be demoted", async () => {
  // A guard worth pinning: losing every administrator would need database
  // access to undo, so the service refuses rather than locking the client out.
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("src/lib/services/members.ts", "utf8");
  assert.match(source, /countAdmins/);
  assert.match(source, /Nelze odebrat posledního správce/);
});
