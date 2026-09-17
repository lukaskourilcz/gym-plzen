import assert from "node:assert/strict";
import test from "node:test";
import { pendingHoldCutoff } from "../../src/lib/services/reservations";

test("abandoned checkout hold expires after the configured window", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");
  assert.equal(
    pendingHoldCutoff(now).toISOString(),
    "2026-07-22T11:28:00.000Z",
  );
  assert.equal(
    pendingHoldCutoff(now, 45).toISOString(),
    "2026-07-22T11:15:00.000Z",
  );
});

test("closing a range cancels through the full path and flags paid bookings for refund", async () => {
  const { readFile } = await import("node:fs/promises");
  const [service, schedule, action] = await Promise.all([
    readFile("src/lib/services/reservations.ts", "utf8"),
    readFile("src/lib/services/schedule.ts", "utf8"),
    readFile("src/app/admin/schedule/actions.ts", "utf8"),
  ]);
  // The raw status update that skipped locks, codes, vouchers and alerts is gone.
  assert.doesNotMatch(schedule, /cancelOverlappingReservations/);
  assert.match(action, /reservations\.cancelReservationsForClosure\(/);
  const closure = service.slice(
    service.indexOf("export async function cancelReservationsForClosure"),
  );
  assert.match(closure, /await cancelReservation\(\{/);
  assert.match(closure, /await releaseForReservation\(row\.id\)/);
  assert.match(closure, /dedupeKey: `refund-needed:\$\{row\.id\}`/);
  assert.match(closure, /eq\(payment\.status, "succeeded"\)/);
});
