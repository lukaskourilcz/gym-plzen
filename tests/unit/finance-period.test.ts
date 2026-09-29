import assert from "node:assert/strict";
import test from "node:test";
import {
  financePeriodStart,
  parseFinancePeriod,
} from "../../src/lib/helpers/finance-period";

test("finance filters use Prague calendar days including today", () => {
  const summer = new Date("2026-09-30T12:00:00Z");
  assert.equal(
    financePeriodStart("7d", summer)?.toISOString(),
    "2026-09-23T22:00:00.000Z",
  );
  assert.equal(
    financePeriodStart("30d", summer)?.toISOString(),
    "2026-08-31T22:00:00.000Z",
  );
  assert.equal(financePeriodStart("all", summer), null);

  // The thirty-day range crosses the autumn daylight-saving transition.
  const winter = new Date("2026-11-10T12:00:00Z");
  assert.equal(
    financePeriodStart("7d", winter)?.toISOString(),
    "2026-11-03T23:00:00.000Z",
  );
  assert.equal(
    financePeriodStart("30d", winter)?.toISOString(),
    "2026-10-11T22:00:00.000Z",
  );
});

test("unknown period cannot select an arbitrary query window", () => {
  assert.equal(parseFinancePeriod("7d"), "7d");
  assert.equal(parseFinancePeriod("30d"), "30d");
  assert.equal(parseFinancePeriod("anything"), "all");
});
