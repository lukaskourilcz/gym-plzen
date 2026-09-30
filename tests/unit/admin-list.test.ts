import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adminDateBounds,
  adminPageHref,
  readAdminFilters,
} from "../../src/lib/helpers/admin-list";

test("admin day bounds cover complete Prague DST days", () => {
  for (const [date, hours] of [
    ["2026-03-29", 23],
    ["2026-10-25", 25],
  ] as const) {
    const bounds = adminDateBounds(readAdminFilters({ from: date, to: date }));
    assert.equal(bounds.invalid, false);
    if (bounds.invalid) return;
    assert.equal(
      (bounds.end!.getTime() - bounds.start!.getTime()) / 3600000,
      hours,
    );
  }
});
test("admin navigation preserves independent list pages and filters, discards action flashes", () => {
  const href = adminPageHref(
    "/admin/messages",
    {
      q: "Žluťoučký & syn",
      from: "2026-09-30",
      emailPage: "3",
      messagePage: "2",
      imported: "2",
    },
    4,
    "messagePage",
  );
  const url = new URL(href, "https://example.test");
  assert.equal(url.searchParams.get("q"), "Žluťoučký & syn");
  assert.equal(url.searchParams.get("emailPage"), "3");
  assert.equal(url.searchParams.get("messagePage"), "4");
  assert.equal(url.searchParams.has("imported"), false);
});
test("invalid or repeated dates and unbounded search cannot crash list parsing", () => {
  assert.equal(readAdminFilters({ q: "x".repeat(1000) }).q.length, 200);
  assert.equal(readAdminFilters({ from: ["2026-10-01", "invalid"] }).from, "");
  assert.equal(
    adminDateBounds(readAdminFilters({ to: "9999-12-31" })).invalid,
    true,
  );
  assert.equal(
    adminDateBounds(readAdminFilters({ from: "2026-02-30" })).invalid,
    true,
  );
  assert.equal(
    adminDateBounds(readAdminFilters({ from: "2026-10-02", to: "2026-10-01" }))
      .invalid,
    true,
  );
});
