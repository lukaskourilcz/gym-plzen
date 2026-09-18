import assert from "node:assert/strict";
import test from "node:test";
import {
  pageFromParam,
  pageLimit,
  pageOffset,
  splitPage,
} from "../../src/lib/helpers/pagination";

test("a page number from the query string is one-based and bounded", () => {
  assert.equal(pageFromParam(undefined), 1);
  assert.equal(pageFromParam("1"), 1);
  assert.equal(pageFromParam("7"), 7);
  // Anything unusable, negative or repeated reads as the first page.
  for (const value of ["0", "-3", "2.5", "abc", "", ["2", "3"]])
    assert.equal(pageFromParam(value), 1);
  // A hand-written page cannot become an enormous offset.
  assert.equal(pageFromParam("999999999"), 10_000);
});

test("one row beyond the page is what proves a next page exists", () => {
  assert.equal(pageLimit(50), 51);
  assert.equal(pageOffset(1, 50), 0);
  assert.equal(pageOffset(3, 50), 100);

  const full = Array.from({ length: 51 }, (_, index) => index);
  assert.deepEqual(splitPage(full, 50), {
    rows: full.slice(0, 50),
    hasNext: true,
  });
  assert.deepEqual(splitPage([1, 2], 50), { rows: [1, 2], hasNext: false });
  assert.deepEqual(splitPage([], 50), { rows: [], hasNext: false });
});
