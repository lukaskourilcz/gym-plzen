import assert from "node:assert/strict";
import { test } from "node:test";
import { runPriorityWatchdogStages } from "../../src/lib/services/watchdog-priority";

test("a stalled payment lookup cannot postpone an already-due PIN", async () => {
  const events: string[] = [];
  let enterPayment!: () => void;
  const paymentStarted = new Promise<void>((resolve) => {
    enterPayment = resolve;
  });
  let completePayment!: () => void;
  const paymentFinished = new Promise<number>((resolve) => {
    completePayment = () => resolve(2);
  });
  const cycle = runPriorityWatchdogStages({
    dueForRetry: async () => {
      events.push("due");
      return [{ reservationId: "due-pin" }, { reservationId: "due-pin" }];
    },
    fulfillReservation: async (id) => {
      events.push(`pin:${id}`);
    },
    reconcilePendingPayments: async () => {
      events.push("payment-started");
      enterPayment();
      return paymentFinished;
    },
    releaseExpiredPendingReservations: async () => {
      events.push("hold-release");
      return 1;
    },
  });
  await paymentStarted;
  assert.deepEqual(events, ["due", "pin:due-pin", "payment-started"]);
  completePayment();
  assert.deepEqual(await cycle, {
    dueSteps: 2,
    processed: 1,
    reconciledPayments: 2,
    releasedPendingReservations: 1,
  });
  assert.deepEqual(events.at(-1), "hold-release");
});
