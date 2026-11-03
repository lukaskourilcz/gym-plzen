import assert from "node:assert/strict";
import test from "node:test";
import { updateMemberContactSchema } from "../../src/lib/validations/members";

const input = {
  userId: "22222222-2222-4222-8222-222222222222",
  fullName: "Klára Nováková",
  email: "corrected@example.test",
  phone: "777111222",
  expected: {
    email: "typo@example.test",
    fullName: "Klára",
    firstName: null,
    lastName: null,
    phone: null,
  },
};
test("contact input rejects malformed identity, empty name, bad email and bad phone", () => {
  for (const patch of [
    { userId: "not-an-id" },
    { fullName: "  " },
    { fullName: "x".repeat(121) },
    { email: "bad" },
    { phone: "bad" },
  ])
    assert.equal(
      updateMemberContactSchema.safeParse({ ...input, ...patch }).success,
      false,
    );
  assert.equal(
    updateMemberContactSchema.safeParse({
      ...input,
      email: " Corrected@Example.test ",
    }).success,
    true,
  );
});
test("contact input cannot change roles, verification, consent or internal notes", () => {
  const parsed = updateMemberContactSchema.parse({
    ...input,
    role: "admin",
    phoneVerified: true,
    note: "Injected",
    marketingConsent: true,
    password: "injected",
  });
  assert.deepEqual(parsed, input);
  assert.equal(
    updateMemberContactSchema.safeParse({ ...input, expected: undefined })
      .success,
    false,
  );
});
