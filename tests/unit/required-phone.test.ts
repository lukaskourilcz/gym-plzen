import assert from "node:assert/strict";
import test from "node:test";
import { signUpSchema } from "../../src/lib/validations/auth";
import { bookingDetailsSchema } from "../../src/lib/validations/booking";
import { phoneCompletionHref } from "../../src/lib/helpers/phone-policy";
import {
  readAdminFilters,
  adminPageHref,
} from "../../src/lib/helpers/admin-list";

test("new registration needs a valid phone in Czech or international format", () => {
  const input = {
    name: "Nový Klient",
    email: "new@example.test",
    password: "safe-test-password",
  };
  for (const phone of [undefined, "", "   ", "abc", "123"])
    assert.equal(signUpSchema.safeParse({ ...input, phone }).success, false);
  for (const phone of ["777 123 456", "+421 901 123 456"])
    assert.equal(signUpSchema.safeParse({ ...input, phone }).success, true);
});

test("guest booking cannot omit a phone", () => {
  const input = {
    starts: ["2030-01-01T10:00:00Z"],
    firstName: "Host",
    lastName: "Test",
    email: "guest@example.test",
    extraPeople: "0",
    acceptConditions: true,
  };
  assert.equal(bookingDetailsSchema.safeParse(input).success, false);
  assert.equal(
    bookingDetailsSchema.safeParse({ ...input, phone: "" }).success,
    false,
  );
  assert.equal(
    bookingDetailsSchema.safeParse({ ...input, phone: "777123456" }).success,
    true,
  );
});

test("phone completion keeps a safe destination without redirect loops", () => {
  assert.equal(
    phoneCompletionHref("/rezervace?date=2030-01-01"),
    "/account/telefon?next=%2Frezervace%3Fdate%3D2030-01-01",
  );
  assert.equal(
    phoneCompletionHref("/account/telefon?next=/account"),
    "/account/telefon?next=%2Faccount",
  );
  assert.ok(
    !decodeURIComponent(phoneCompletionHref("https://evil.example/")).includes(
      "evil.example",
    ),
  );
});

test("member registration filter survives pagination", () => {
  assert.equal(
    readAdminFilters({ registration: "guest" }).registration,
    "guest",
  );
  assert.ok(
    adminPageHref(
      "/admin/members",
      { registration: "guest", q: "Host" },
      2,
    ).includes("registration=guest"),
  );
});
