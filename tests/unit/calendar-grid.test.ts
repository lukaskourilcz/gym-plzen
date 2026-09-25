import assert from "node:assert/strict";
import test from "node:test";
import { calendarRowMinutes } from "../../src/lib/helpers/calendar-grid";

test("calendar rows follow the 75-minute reservation windows from 05:00", () => {
  const step = calendarRowMinutes([{ openMinute: 300, slotMinutes: 75 }], 300);
  assert.equal(step, 75);
  assert.equal(300 + 9 * step, 16 * 60 + 15);
  assert.equal(300 + 10 * step, 17 * 60 + 30);
  assert.equal(300 + 15 * step, 23 * 60 + 45);
});

test("different weekday schedules retain aligned reservation boundaries", () => {
  assert.equal(
    calendarRowMinutes(
      [
        { openMinute: 300, slotMinutes: 75 },
        { openMinute: 360, slotMinutes: 60 },
      ],
      300,
    ),
    15,
  );
  assert.equal(calendarRowMinutes([], 300), 75);
});

test("minute-offset opening times cannot create an unbounded row count", () => {
  assert.equal(
    calendarRowMinutes(
      [
        { openMinute: 300, slotMinutes: 75 },
        { openMinute: 301, slotMinutes: 75 },
      ],
      300,
    ),
    15,
  );
});
