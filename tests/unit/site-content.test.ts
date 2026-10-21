import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_ADDRESS,
  publicAddress,
  publicPhone,
} from "../../src/lib/content/site";

test("public Czech contacts always include the country code and postcode", () => {
  assert.equal(publicPhone("731 737 355"), "+420 731 737 355");
  assert.equal(publicPhone("+420731737355"), "+420 731 737 355");
  assert.equal(publicPhone("00420 721 560 150"), "+420 721 560 150");
  assert.equal(
    publicAddress("Křížkova 424/23, Plzeň - Roudná"),
    PUBLIC_ADDRESS,
  );
  assert.match(PUBLIC_ADDRESS, /301 00/);
});

test("opening hours display follows the actual weekly schedule", async () => {
  const { openingHoursLabel } =
    await import("../../src/lib/helpers/opening-hours-label");
  const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    openMinute: 300,
    closeMinute: 1320,
    slotMinutes: 75,
    isClosed: 0,
  }));
  assert.match(openingHoursLabel(hours), /^5:00\s*–\s*22:00$/);
  for (const day of [0, 6]) hours[day]!.openMinute = 360;
  assert.match(
    openingHoursLabel(hours),
    /Po–Pá 5:00.*22:00 · So–Ne 6:00.*22:00/,
  );
});
