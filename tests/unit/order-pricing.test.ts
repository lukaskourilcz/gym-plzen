import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateLoyaltyRewards,
  splitOrderDiscount,
} from "../../src/lib/helpers/order-pricing";

test("a new member's first order earns no reward", () => {
  assert.deepEqual(allocateLoyaltyRewards(0, 3, 10), [null, null, null]);
});

test("the slot that lands on the tenth entry is free, in start order", () => {
  assert.deepEqual(allocateLoyaltyRewards(8, 3, 10), [null, 1, null]);
  assert.deepEqual(allocateLoyaltyRewards(9, 1, 10), [1]);
});

test("one order can hold the 10th and the 20th entry at once", () => {
  const rewards = allocateLoyaltyRewards(9, 11, 10);
  assert.equal(rewards[0], 1);
  assert.equal(rewards[10], 2);
  assert.equal(rewards.filter((reward) => reward !== null).length, 2);
});

test("a discount is split in proportion and the prices add up exactly", () => {
  const prices = [22_900, 22_900, 22_900];
  const discounted = splitOrderDiscount(prices, 10_000);
  assert.equal(
    discounted.reduce((sum, price) => sum + price, 0),
    68_700 - 10_000,
  );
  // The rounding remainder lands on the last slot.
  assert.deepEqual(discounted, [19_567, 19_567, 19_566]);
});

test("free slots stay free and carry no share of the discount", () => {
  assert.deepEqual(
    splitOrderDiscount([22_900, 0, 22_900], 22_900),
    [11_450, 0, 11_450],
  );
});

test("a full discount makes every slot free; an excessive one is capped", () => {
  assert.deepEqual(splitOrderDiscount([22_900, 19_900], 42_800), [0, 0]);
  assert.deepEqual(splitOrderDiscount([22_900, 19_900], 99_999), [0, 0]);
});

test("no discount, or nothing to discount, leaves the prices untouched", () => {
  assert.deepEqual(splitOrderDiscount([22_900], 0), [22_900]);
  assert.deepEqual(splitOrderDiscount([0, 0], 500), [0, 0]);
});

test("a remainder never pushes a small last price below zero", () => {
  const discounted = splitOrderDiscount([10_000, 10_000, 1], 10_000);
  assert.ok(discounted.every((price) => price >= 0));
  assert.equal(
    discounted.reduce((sum, price) => sum + price, 0),
    20_001 - 10_000,
  );
});
