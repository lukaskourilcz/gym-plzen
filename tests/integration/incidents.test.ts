import {
  databaseReady,
  resetDatabase,
  rows,
  setSetting,
  startProviders,
  stopEverything,
  resend,
} from "./setup";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { raiseAlert } from "../../src/lib/services/alerts";
import { buildReservationIncident } from "../../src/lib/services/reservation-incidents";
import { getReservation } from "../../src/lib/services/reservations";
import { dispatchAccessCode } from "../../src/lib/services/notifications";
import { env } from "../../src/lib/env";
import {
  parseIncident,
  type PipelineFailure,
} from "../../src/lib/config/incidents";
const now = new Date("2030-10-01T10:00:00Z"),
  operator = "operator@example.test";
async function booking() {
  const [row] = await rows<{ id: string }>(
    "insert into reservation(starts_at,ends_at,status,contact_name,contact_email) values($1,$2,'confirmed','Ukázkový klient','customer@example.test') returning id",
    [
      new Date(now.getTime() + 24 * 3600000),
      new Date(now.getTime() + 25 * 3600000),
    ],
  );
  return (await getReservation(row!.id))!;
}
function notice(
  b: Awaited<ReturnType<typeof booking>>,
  attempts = 0,
  failure: PipelineFailure = { code: "contact_email_missing" },
) {
  return buildReservationIncident({
    booking: b,
    step: "code_delivered",
    failure,
    attempts,
    nextRetryAt: null,
  });
}
describe("specific operational incidents", { skip: !databaseReady }, () => {
  before(startProviders);
  after(stopEverything);
  beforeEach(async (t) => {
    if (!("mock" in t)) throw new Error("Expected test context");
    t.mock.timers.enable({ apis: ["Date"], now });
    await resetDatabase();
    await setSetting("notifications.operator", {
      recipients: operator,
      events: {
        systemAlert: true,
        reservationConfirmed: false,
        reservationCancelled: false,
        reservationRescheduled: false,
        memberRegistered: false,
      },
    });
  });
  test("parallel captures update one open incident and notify the operator once without contacting customers", async () => {
    const b = await booking(),
      before = await rows("select * from reservation order by id");
    await Promise.all(
      Array.from({ length: 5 }, (_, i) => raiseAlert(notice(b, i + 1))),
    );
    const alerts = await rows<{ id: string; context: unknown }>(
      "select id,context from system_alert",
    );
    assert.equal(alerts.length, 1);
    const incident = parseIncident(alerts[0]!.context)!;
    assert.equal(incident.attempts, 5);
    assert.equal(incident.occurrences, 5);
    assert.equal(resend.sent.length, 1);
    assert.equal(resend.sent[0]!.to, operator);
    assert.match(resend.sent[0]!.text ?? "", /Chybí e-mail/);
    assert.ok(resend.sent[0]!.text?.includes(`/admin/reservations?id=${b.id}`));
    assert.deepEqual(
      await rows("select * from reservation order by id"),
      before,
    );
    assert.equal((await rows("select * from access_code")).length, 0);
  });
  test("approaching entry escalates the existing warning once, and updated causes remain specific", async (t) => {
    const b = await booking();
    const a = await raiseAlert(notice(b));
    assert.equal(a!.severity, "warning");
    t.mock.timers.setTime(now.getTime() + 23 * 3600000);
    const urgent = await raiseAlert(notice(b, 1));
    assert.equal(urgent!.id, a!.id);
    assert.equal(urgent!.severity, "critical");
    await raiseAlert(notice(b, 2, { code: "contact_missing_all" }));
    await raiseAlert(notice(b, 3, { code: "contact_missing_all" }));
    const [saved] = await rows<{ context: unknown; title: string }>(
      "select context,title from system_alert",
    );
    assert.equal(parseIncident(saved!.context)!.code, "contact_missing_all");
    assert.match(saved!.title, /nemá kontaktní údaje/);
    assert.equal(resend.sent.length, 2);
    assert.ok(
      resend.sent.every((mail) => JSON.stringify(mail.to).includes(operator)),
    );
  });
  test("dispatch diagnoses absent recipients without sending to a provider or creating a delivery attempt", async () => {
    const b = await booking();
    for (const [email, code] of [[undefined, "contact_missing_all"]] as const) {
      const result = await dispatchAccessCode({
        userId: null,
        reservationId: b.id,
        code: "111222",
        startsAt: b.startsAt,
        email,
      });
      assert.equal(result.emailDelivered, false);
      assert.equal(result.failure!.code, code);
    }
    assert.equal(resend.sent.length, 0);
    assert.equal((await rows("select * from message_delivery")).length, 0);
  });
  test("provider rate limits keep their exact diagnostic through dispatch instead of becoming a generic missing contact", async () => {
    const b = await booking();
    resend.rateLimitNext(2);
    const result = await dispatchAccessCode({
      userId: null,
      reservationId: b.id,
      code: "111222",
      startsAt: b.startsAt,
      email: b.contactEmail,
    });
    assert.equal(result.emailDelivered, false);
    assert.equal(result.failure!.code, "email_rate_limited");
    assert.equal(result.deliveries[0]!.failureReason, "resend_http_429");
  });
  test("missing mail configuration is specific and never attempts a real provider", async () => {
    const b = await booking(),
      key = env.RESEND_API_KEY;
    try {
      env.RESEND_API_KEY = undefined;
      const result = await dispatchAccessCode({
        userId: null,
        reservationId: b.id,
        code: "111222",
        startsAt: b.startsAt,
        email: b.contactEmail,
      });
      assert.equal(result.failure!.code, "email_configuration_missing");
      assert.equal(resend.sent.length, 0);
    } finally {
      env.RESEND_API_KEY = key;
    }
  });
});
