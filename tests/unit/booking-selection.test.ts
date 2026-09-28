import assert from "node:assert/strict";
import test from "node:test";
import {
  detailsHref,
  parseSelectedStarts,
  rewardPositions,
  withSelectedStarts,
} from "../../src/lib/helpers/booking-selection";

const A = "2026-10-01T08:00:00.000Z";
const B = "2026-10-02T08:00:00.000Z";

test("the selection is read back unique, valid and in start order", () => {
  assert.deepEqual(parseSelectedStarts(undefined), []);
  assert.deepEqual(
    parseSelectedStarts(A).map((at) => at.toISOString()),
    [A],
  );
  assert.deepEqual(
    parseSelectedStarts([B, "nonsense", A, B]).map((at) => at.toISOString()),
    [A, B],
  );
});

test("never more than one order's worth of slots", () => {
  const many = Array.from(
    { length: 12 },
    (_, day) => `2026-10-${String(day + 1).padStart(2, "0")}T08:00:00.000Z`,
  );
  assert.equal(parseSelectedStarts(many).length, 10);
});

test("links carry the selection as repeated start parameters", () => {
  assert.equal(
    detailsHref([B, A]),
    `/rezervace/udaje?start=${encodeURIComponent(A)}&start=${encodeURIComponent(B)}`,
  );
  const params = withSelectedStarts(
    new URLSearchParams("date=2026-10-01&start=old"),
    [A],
  );
  assert.equal(params.get("date"), "2026-10-01");
  assert.deepEqual(params.getAll("start"), [A]);
});

test("a member's free positions follow the loyalty cadence", () => {
  assert.deepEqual(rewardPositions(3, 2, 10), [false, true, false]);
  assert.deepEqual(rewardPositions(2, 10, 10), [false, false]);
  const long = rewardPositions(11, 1, 10);
  assert.equal(long[0], true);
  assert.equal(long[10], true);
  assert.equal(long.filter(Boolean).length, 2);
});
