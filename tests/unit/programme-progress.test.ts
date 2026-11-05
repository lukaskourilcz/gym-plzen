import assert from "node:assert/strict";
import { test } from "node:test";
import { programmeProgress } from "../../src/lib/helpers/programme-progress";

const booking = {
  startsAt: "2026-11-05T10:00:00Z",
  endsAt: "2026-11-05T11:00:00Z",
  codeCreated: true,
  codeUsed: false,
};

test("programme stays neutral before a booking and fills red while its code is unused", () => {
  assert.equal(
    programmeProgress(booking, Date.parse("2026-11-05T09:00Z")).progress,
    0,
  );
  assert.equal(
    programmeProgress(booking, Date.parse("2026-11-05T09:00Z")).tone,
    "neutral",
  );
  const midway = programmeProgress(booking, Date.parse("2026-11-05T10:30Z"));
  assert.equal(midway.progress, 50);
  assert.equal(midway.tone, "danger");
  assert.equal(midway.label, "Čeká na příchod");
  const ended = programmeProgress(booking, Date.parse("2026-11-05T12:00Z"));
  assert.equal(ended.progress, 100);
  assert.equal(ended.label, "Vstup nezaznamenán");
});

test("a confirmed keypad entry turns the elapsed portion green and keeps it green after the end", () => {
  const arrived = { ...booking, codeUsed: true };
  const midway = programmeProgress(arrived, Date.parse("2026-11-05T10:30Z"));
  assert.equal(midway.tone, "success");
  assert.equal(midway.progress, 50);
  const ended = programmeProgress(arrived, Date.parse("2026-11-06T12:00Z"));
  assert.equal(ended.tone, "success");
  assert.equal(ended.progress, 100);
  assert.equal(ended.label, "Vstup potvrzen");
});

test("missing code data identifies an access problem rather than claiming a customer did not attend", () => {
  const state = programmeProgress(
    { ...booking, codeCreated: false },
    Date.parse("2026-11-05T12:00Z"),
  );
  assert.equal(state.tone, "warning");
  assert.equal(state.label, "Chybí připravený kód");
});
