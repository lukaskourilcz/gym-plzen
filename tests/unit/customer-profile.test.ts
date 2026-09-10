import assert from "node:assert/strict";
import test from "node:test";
import {
  profileSchema,
  changePasswordSchema,
} from "../../src/lib/validations/profile";
import {
  googleAvatarUrl,
  profileInitials,
  splitFullName,
} from "../../src/lib/helpers/profile";
import { deliverySummary } from "../../src/lib/helpers/delivery";

const profile = {
  firstName: "Klára",
  lastName: "Nováková",
  phone: "",
  notifyByWhatsapp: false,
  avatarSource: "initials",
};
test("phone is optional for email, required and validated for WhatsApp", () => {
  assert.equal(profileSchema.safeParse(profile).success, true);
  assert.equal(
    profileSchema.safeParse({ ...profile, notifyByWhatsapp: true }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({ ...profile, phone: "invalid" }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({
      ...profile,
      phone: "+420 777 123 456",
      notifyByWhatsapp: true,
    }).success,
    true,
  );
});
test("profile input strips privileged fields and cannot disable email", () => {
  const parsed = profileSchema.parse({
    ...profile,
    role: "admin",
    note: "override",
    userId: "other-user",
    notifyByEmail: false,
  });
  assert.deepEqual(parsed, profile);
});
test("profile names fit the booking fields and reject whitespace-only values", () => {
  assert.equal(
    profileSchema.safeParse({ ...profile, firstName: "  " }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({ ...profile, lastName: "x".repeat(61) }).success,
    false,
  );
});
test("Google avatars reject other hosts, insecure protocols and URL credentials", () => {
  assert.equal(
    googleAvatarUrl("https://lh3.googleusercontent.com/a/photo"),
    "https://lh3.googleusercontent.com/a/photo",
  );
  for (const url of [
    "http://lh3.googleusercontent.com/a",
    "https://googleusercontent.com.evil.test/a",
    "https://evilgoogleusercontent.com/a",
    "https://user:password@lh3.googleusercontent.com/a",
    "javascript:alert(1)",
    {},
    null,
  ])
    assert.equal(googleAvatarUrl(url), null);
});
test("initials and legacy names preserve Czech diacritics and compound surnames", () => {
  assert.equal(profileInitials("  Šárka  Černá "), "ŠČ");
  assert.equal(profileInitials(""), "?");
  assert.deepEqual(splitFullName("Jan Novák Svoboda"), {
    firstName: "Jan",
    lastName: "Novák Svoboda",
  });
});
test("password changes require current password, a different password and confirmation", () => {
  const valid = {
    currentPassword: "old-password",
    password: "new-password",
    passwordConfirmation: "new-password",
  };
  assert.equal(changePasswordSchema.safeParse(valid).success, true);
  assert.equal(
    changePasswordSchema.safeParse({ ...valid, currentPassword: "" }).success,
    false,
  );
  assert.equal(
    changePasswordSchema.safeParse({ ...valid, passwordConfirmation: "wrong" })
      .success,
    false,
  );
  assert.equal(
    changePasswordSchema.safeParse({
      ...valid,
      currentPassword: "new-password",
    }).success,
    false,
  );
});
test("WhatsApp success cannot complete mandatory email delivery", () => {
  assert.deepEqual(
    deliverySummary([
      { channel: "email", status: "failed" },
      { channel: "whatsapp", status: "sent" },
    ]),
    { anyDelivered: true, emailDelivered: false },
  );
  assert.equal(
    deliverySummary([
      { channel: "email", status: "sent" },
      { channel: "whatsapp", status: "failed" },
    ]).emailDelivered,
    true,
  );
  assert.equal(deliverySummary([]).emailDelivered, false);
});
