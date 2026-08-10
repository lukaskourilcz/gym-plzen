import assert from "node:assert/strict";
import test from "node:test";
import { bookingDetailsSchema } from "../../src/lib/validations/booking";

const validDetails = {
  startsAt: "2026-09-01T08:00:00.000Z",
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
