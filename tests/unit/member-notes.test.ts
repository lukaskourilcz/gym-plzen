import assert from "node:assert/strict";
import { test } from "node:test";
import {
  updateMemberNoteSchema,
  updateMemberSchema,
} from "../../src/lib/validations/members";

const userId = "22222222-2222-4222-8222-222222222222";
test("notes support Czech multiline text and an explicit clear", () => {
  assert.deepEqual(
    updateMemberNoteSchema.parse({
      userId,
      note: "První návštěva.\nDomluvit rozcvičení.",
    }),
    { userId, note: "První návštěva.\nDomluvit rozcvičení." },
  );
  assert.equal(updateMemberNoteSchema.parse({ userId, note: "" }).note, "");
});
test("notes require an existing-format identity and a bounded text payload", () => {
  assert.equal(
    updateMemberNoteSchema.safeParse({ userId: "same-name", note: "Text" })
      .success,
    false,
  );
  assert.equal(
    updateMemberNoteSchema.safeParse({ userId, note: "x".repeat(2001) })
      .success,
    false,
  );
  assert.equal(updateMemberNoteSchema.safeParse({ userId }).success, false);
});
test("note edits cannot carry role, contact or notification changes", () => {
  assert.deepEqual(
    updateMemberNoteSchema.parse({
      userId,
      note: "Text",
      role: "admin",
      phone: "+420777000111",
      notifyBySms: true,
    }),
    { userId, note: "Text" },
  );
});
test("contact editing cannot overwrite a newer independently edited note", () => {
  assert.equal(
    "note" in
      updateMemberSchema.parse({
        userId,
        phone: "",
        notifyByWhatsapp: false,
        notifyBySms: false,
        marketingConsent: false,
        note: "Old note",
      }),
    false,
  );
});
