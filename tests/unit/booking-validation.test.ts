import assert from "node:assert/strict";
import test from "node:test";
import { bookingDetailsSchema } from "../../src/lib/validations/booking";

const validDetails = {
  starts: ["2026-09-01T08:00:00.000Z"],
  firstName: "Klára",
  lastName: "Nováková",
  email: "klara@example.cz",
  phone: "+420 777 123 456",
};

test("booking requires one combined rules and terms consent", () => {
  assert.equal(
    bookingDetailsSchema.safeParse({
      ...validDetails,
      acceptConditions: true,
    }).success,
    true,
  );
  assert.equal(
    bookingDetailsSchema.safeParse({
      ...validDetails,
      acceptConditions: false,
    }).success,
    false,
  );
});

test("keeping the phone number is optional and must be a real choice", () => {
  // A guest's form never sends the flag; a member's sends true or false.
  assert.equal(
    bookingDetailsSchema.safeParse({ ...validDetails, acceptConditions: true })
      .success,
    true,
  );
  assert.equal(
    bookingDetailsSchema.parse({
      ...validDetails,
      acceptConditions: true,
      savePhone: true,
    }).savePhone,
    true,
  );
  assert.equal(
    bookingDetailsSchema.safeParse({
      ...validDetails,
      acceptConditions: true,
      savePhone: "ano",
    }).success,
    false,
  );
});

test("an order holds one to ten slots", () => {
  const withStarts = (starts: string[]) =>
    bookingDetailsSchema.safeParse({
      ...validDetails,
      starts,
      acceptConditions: true,
    }).success;
  assert.equal(withStarts([]), false);
  assert.equal(
    withStarts(
      Array.from(
        { length: 10 },
        (_, day) => `2026-09-${String(day + 1).padStart(2, "0")}T08:00:00.000Z`,
      ),
    ),
    true,
  );
  assert.equal(
    withStarts(
      Array.from(
        { length: 11 },
        (_, day) => `2026-09-${String(day + 1).padStart(2, "0")}T08:00:00.000Z`,
      ),
    ),
    false,
  );
});
