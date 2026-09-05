import assert from "node:assert/strict";
import test from "node:test";
import { isNavigationItemActive } from "../../src/lib/navigation";

test("admin navigation matches complete path segments", () => {
  assert.equal(isNavigationItemActive("/admin", "/admin"), true);
  assert.equal(isNavigationItemActive("/admin/calendar", "/admin"), false);

  assert.equal(
    isNavigationItemActive("/admin/memberships", "/admin/members"),
    false,
  );
  assert.equal(
    isNavigationItemActive("/admin/memberships", "/admin/memberships"),
    true,
  );
  assert.equal(
    isNavigationItemActive("/admin/members/123", "/admin/members"),
    true,
  );
});
