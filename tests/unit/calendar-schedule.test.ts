import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarTimeBounds,
  isOutsideOpeningHours,
} from "../../src/lib/helpers/calendar-schedule";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";

const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  openMinute: [0, 6].includes(dayOfWeek) ? 360 : 300,
  closeMinute: 1320,
  isClosed: 0,
}));
const window = (day: string, start: number, end: number) => ({
  startsAt: localDateTimeToDate(day, start),
  endsAt: localDateTimeToDate(day, end),
});

test("calendar checks the actual Prague weekday and the whole reservation", () => {
  assert.equal(
    isOutsideOpeningHours(window("2026-10-16", 300, 375), hours),
    false,
  );
  assert.equal(
    isOutsideOpeningHours(window("2026-10-17", 300, 375), hours),
    true,
  );
  assert.equal(
    isOutsideOpeningHours(window("2026-10-17", 360, 435), hours),
    false,
  );
  assert.equal(
    isOutsideOpeningHours(window("2026-10-16", 1275, 1350), hours),
    true,
  );
  assert.equal(
    isOutsideOpeningHours(window("2026-10-16", 1245, 1320), hours),
    false,
  );
});
test("closed and missing days retain reservations as outside hours", () => {
  const booking = window("2026-10-16", 600, 675);
  assert.equal(isOutsideOpeningHours(booking, []), true);
  assert.equal(
    isOutsideOpeningHours(
      booking,
      hours.map((h) => ({ ...h, isClosed: 1 })),
    ),
    true,
  );
});
test("calendar axis includes old early and late reservations without changing their intervals", () => {
  const bookings = [
    window("2026-10-17", 240, 315),
    window("2026-10-16", 1275, 1425),
  ];
  const before = structuredClone(bookings);
  assert.deepEqual(calendarTimeBounds(hours, bookings), {
    openMinute: 240,
    closeMinute: 1425,
  });
  assert.deepEqual(bookings, before);
  assert.deepEqual(calendarTimeBounds(hours, []), {
    openMinute: 300,
    closeMinute: 1320,
  });
});
test("cross-midnight reservations remain visible in full and marked outside daytime opening", () => {
  const booking = {
    startsAt: localDateTimeToDate("2026-10-16", 1410),
    endsAt: localDateTimeToDate("2026-10-17", 45),
  };
  assert.equal(isOutsideOpeningHours(booking, hours), true);
  assert.deepEqual(calendarTimeBounds(hours, [booking]), {
    openMinute: 0,
    closeMinute: 1440,
  });
});
test("midnight exclusive end is supported and seconds cannot be clipped", () => {
  const booking = {
    startsAt: localDateTimeToDate("2026-10-16", 1365),
    endsAt: localDateTimeToDate("2026-10-17", 0),
  };
  assert.equal(
    isOutsideOpeningHours(
      booking,
      hours.map((h) => ({ ...h, closeMinute: 1440 })),
    ),
    false,
  );
  assert.deepEqual(calendarTimeBounds(hours, [booking]), {
    openMinute: 300,
    closeMinute: 1440,
  });
  const late = window("2026-10-16", 1245, 1320);
  late.endsAt = new Date(late.endsAt.getTime() + 1000);
  assert.equal(isOutsideOpeningHours(late, hours), true);
  assert.equal(calendarTimeBounds(hours, [late]).closeMinute, 1321);
});
test("Prague daylight-saving changes do not turn a valid Sunday slot into a weekday slot", () => {
  for (const day of ["2026-03-29", "2026-10-25"]) {
    assert.equal(isOutsideOpeningHours(window(day, 360, 435), hours), false);
    assert.equal(isOutsideOpeningHours(window(day, 300, 375), hours), true);
  }
});
