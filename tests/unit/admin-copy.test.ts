import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatChannel,
  formatLockAction,
  formatLockTrigger,
  formatMessageKind,
  formatPaymentStatus,
  formatSeverity,
} from "../../src/lib/helpers/format";
import {
  ACTIVITY_ACTIONS,
  activityActionLabel,
} from "../../src/lib/services/activity";
import {
  alertseverity,
  messageChannel,
  messageKind,
  paymentStatus,
} from "../../src/lib/db/schema";

const MACHINE_VALUE = /^[a-z_]+$/;

test("every stored enum value the administration shows has a Czech label", () => {
  for (const value of messageChannel.enumValues)
    assert.doesNotMatch(formatChannel(value), MACHINE_VALUE, value);
  for (const value of messageKind.enumValues)
    assert.doesNotMatch(formatMessageKind(value), MACHINE_VALUE, value);
  for (const value of alertseverity.enumValues)
    assert.doesNotMatch(formatSeverity(value), MACHINE_VALUE, value);
  for (const value of paymentStatus.enumValues)
    assert.doesNotMatch(formatPaymentStatus(value), MACHINE_VALUE, value);
  for (const value of ["unlock", "lock", "unlatch", "lock_n_go"])
    assert.doesNotMatch(formatLockAction(value), MACHINE_VALUE, value);
  for (const value of ["system", "manual", "button", "automatic", "keypad"])
    assert.doesNotMatch(formatLockTrigger(value), MACHINE_VALUE, value);
  for (const action of Object.keys(ACTIVITY_ACTIONS))
    assert.doesNotMatch(activityActionLabel(action), /\./, action);
  // An unknown value is shown as itself rather than hidden.
  assert.equal(formatChannel("pigeon"), "pigeon");
});

test("form labels speak to the operator, not to the developer", async () => {
  const memberForm = await readFile(
    "src/app/admin/members/member-form.tsx",
    "utf8",
  );
  assert.doesNotMatch(memberForm, /E\.164/);
  assert.match(memberForm, /např\. \+420 777 123 456/);
  const messagesPage = await readFile(
    "src/app/admin/messages/page.tsx",
    "utf8",
  );
  assert.doesNotMatch(messagesPage, /webhooky providerů/);
  assert.match(messagesPage, /Odeslané zprávy/);
});
