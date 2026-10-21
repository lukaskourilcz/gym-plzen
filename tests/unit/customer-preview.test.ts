import assert from "node:assert/strict";
import test from "node:test";
import {
  previewCalendar,
  previewSelection,
  type CustomerPreviewConfig,
} from "../../src/lib/helpers/customer-preview";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";
const config: CustomerPreviewConfig = {
  nowISO: "2026-10-24T12:00:00Z",
  hours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    openMinute: 300,
    closeMinute: 1425,
    slotMinutes: 75,
    isClosed: 0,
  })),
  standardPriceCents: 23900,
  periods: [
    {
      priceCents: 19900,
      startsAt: "2026-09-30T22:00:00Z",
      endsAt: "2026-10-31T23:00:00Z",
    },
  ],
  blockPrices: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      dayOfWeek: 0,
      startMinute: 300,
      endMinute: 375,
      priceCents: 32900,
    },
  ],
  participants: { enabled: false, amountCents: 10000, mode: "flat" },
  brand: "Test",
  subtitle: "Test",
  faq: [],
  equipment: [],
};
test("synthetic calendar preserves Prague times across DST and current price priority", () => {
  const view = previewCalendar(config, { date: "2026-10-25" });
  assert.equal(view.source, "preview");
  assert.equal(view.selectedSlots[0]?.startISO, "2026-10-25T04:00:00.000Z");
  assert.equal(view.selectedSlots[0]?.priceCents, 19900);
  assert.equal(view.selectedSlots[0]?.durationMinutes, 75);
  assert.equal(
    previewCalendar(config, { date: "2026-11-01" }).selectedSlots[0]
      ?.priceCents,
    32900,
  );
});
test("preview refuses occupied, malformed, duplicate, past and purchased URL selections", () => {
  const valid = localDateTimeToDate("2026-10-25", 300).toISOString();
  const occupied = localDateTimeToDate("2026-10-25", 450).toISOString();
  assert.equal(
    previewSelection(
      config,
      [valid, valid, occupied, "invalid", "2026-10-23T04:00:00Z"],
      new Set(),
    ).length,
    1,
  );
  assert.equal(previewSelection(config, [valid], new Set([valid])).length, 0);
  const closed = {
    ...config,
    hours: config.hours.map((h) => ({ ...h, isClosed: 1 })),
  };
  assert.equal(
    previewCalendar(closed, { date: "2026-10-25" }).selectedSlots.length,
    0,
  );
});
