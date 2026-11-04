import assert from "node:assert/strict";
import test from "node:test";
import {
  plannedScheduleInputSchema,
  plannedSchedulesOverlap,
  plannedWindowAt,
  plannedWindowTimes,
  type PlannedSchedule,
} from "../../src/lib/config/planned-schedules";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";

const schedule: PlannedSchedule = {
  id: "1872ade6-a416-4496-bfd2-2a4791336786",
  revision: "88c383b2-306e-4651-8c23-808ea25cdc6c",
  name: "Sezónní rozvrh",
  from: "2027-03-26",
  to: "2027-03-29",
  weekdays: [0, 6],
  windows: [
    { startMinute: 360, endMinute: 440, priceCents: 19900 },
    { startMinute: 440, endMinute: 520, priceCents: 23900 },
  ],
};

test("period collisions depend on real shared weekdays and include the last day", () => {
  assert.equal(
    plannedSchedulesOverlap(schedule, {
      ...schedule,
      from: "2027-03-28",
      weekdays: [0],
    }),
    true,
  );
  assert.equal(
    plannedSchedulesOverlap(schedule, { ...schedule, from: "2027-03-29" }),
    false,
  );
  assert.equal(
    plannedSchedulesOverlap(schedule, {
      ...schedule,
      weekdays: [1, 2, 3, 4, 5],
    }),
    false,
  );
  assert.equal(
    plannedSchedulesOverlap(schedule, {
      ...schedule,
      from: "2027-03-30",
      to: "2027-04-01",
    }),
    false,
  );
});

test("schedule validation permits touching windows but rejects overlaps, invalid dates and invalid prices", () => {
  assert.equal(plannedScheduleInputSchema.safeParse(schedule).success, true);
  assert.equal(
    plannedScheduleInputSchema.safeParse({ ...schedule, from: "2027-02-30" })
      .success,
    false,
  );
  assert.equal(
    plannedScheduleInputSchema.safeParse({
      ...schedule,
      windows: [{ ...schedule.windows[0]!, priceCents: 0 }],
    }).success,
    false,
  );
  assert.equal(
    plannedScheduleInputSchema.safeParse({
      ...schedule,
      windows: [
        schedule.windows[0]!,
        { ...schedule.windows[1]!, startMinute: 439 },
      ],
    }).success,
    false,
  );
});

test("Prague clock changes skip nonexistent windows without shifting their start", () => {
  assert.equal(
    plannedWindowTimes("2027-03-28", { startMinute: 120, endMinute: 200 }),
    null,
  );
  const start = localDateTimeToDate("2027-03-28", 360);
  assert.equal(start.toISOString(), "2027-03-28T04:00:00.000Z");
  assert.equal(
    plannedWindowAt(schedule, start)?.endsAt.toISOString(),
    "2027-03-28T05:20:00.000Z",
  );
  assert.equal(
    plannedWindowAt(schedule, new Date(start.getTime() + 1000)),
    null,
  );
});
