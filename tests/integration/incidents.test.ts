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
import {
  dashboardAlerts,
  raiseAlert,
  resolveAlertById,
  resolveAllOpenAlerts,
} from "../../src/lib/services/alerts";
import {
  closePipeline,
  initPipeline,
  markStepFailed,
  markStepSucceeded,
} from "../../src/lib/services/pipeline";
import { incidentUpdates } from "../../src/lib/config/incident-updates";
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
  test("verified recovery closes only the matching incident and records one final update", async (t) => {
    const b = await booking();
    await initPipeline(b.id);
    const refund = await raiseAlert({
      dedupeKey: `refund-needed:${b.id}`,
      title: "Ověřit vrácení platby",
      context: { reservationId: b.id, amountCents: 19900 },
    });
    for (let attempt = 0; attempt < 5; attempt++)
      await markStepFailed(b.id, "code_created", { code: "lock_offline" });
    await markStepFailed(b.id, "code_created", { code: "code_unconfirmed" });
    const before = await Promise.all([
      rows("select * from reservation"),
      rows("select * from access_code"),
      rows("select * from payment"),
      rows("select * from message_delivery"),
    ]);
    const sent = resend.sent.length;
    t.mock.timers.setTime(now.getTime() + 60_000);
    await markStepSucceeded(b.id, "code_created");
    await markStepSucceeded(b.id, "code_created");

    const dashboard = await dashboardAlerts(now);
    assert.equal(dashboard.openCount, 1);
    assert.equal(dashboard.open[0]?.id, refund?.id);
    assert.equal(dashboard.recentClosed.length, 1);
    const recovered = dashboard.recentClosed[0]!;
    assert.deepEqual(
      incidentUpdates(recovered.context).map((update) => update.kind),
      ["opened", "repeated", "recovered"],
    );
    assert.match(
      incidentUpdates(recovered.context)[0]!.message,
      /ověřit dostupnost zámku/,
    );
    assert.match(
      incidentUpdates(recovered.context)[1]!.message,
      /časovou platnost/,
    );
    assert.match(
      incidentUpdates(recovered.context).at(-1)!.message,
      /ověřil vstupní kód/,
    );
    assert.equal(parseIncident(recovered.context)?.attempts, 6);

    await resolveAlertById(refund!.id, "Vrácení ověřeno v ukázkovém Comgate.");
    await resolveAlertById(refund!.id, "Opakované odeslání formuláře.");
    const [savedRefund] = await rows<{ context: unknown }>(
      "select context from system_alert where id = $1",
      [refund!.id],
    );
    assert.deepEqual(
      incidentUpdates(savedRefund!.context).map((update) => update.kind),
      ["opened", "manual"],
    );
    assert.equal(
      incidentUpdates(savedRefund!.context).at(-1)!.message,
      "Vrácení ověřeno v ukázkovém Comgate.",
    );
    assert.equal(resend.sent.length, sent);
    assert.deepEqual(
      await Promise.all([
        rows("select * from reservation"),
        rows("select * from access_code"),
        rows("select * from payment"),
        rows("select * from message_delivery"),
      ]),
      before,
    );
  });
  test("an ended reservation records why attempts stopped without claiming that delivery recovered", async () => {
    const b = await booking();
    await initPipeline(b.id);
    const alert = await raiseAlert(notice(b));
    const sent = resend.sent.length;
    await closePipeline(b.id, "Rezervace skončila");
    const [saved] = await rows<{ context: unknown; resolved_at: Date | null }>(
      "select context, resolved_at from system_alert where id = $1",
      [alert!.id],
    );
    assert.ok(saved?.resolved_at);
    const lastUpdate = incidentUpdates(saved.context).at(-1);
    assert.equal(lastUpdate?.kind, "closed");
    assert.match(lastUpdate!.message, /Rezervace skončila/);
    assert.equal(resend.sent.length, sent);
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
  test("manual resolution needs no note, bulk closes only its snapshot and preserves customer/provider data", async () => {
    await booking();
    const [first] = await rows<{ id: string }>(
      "insert into system_alert(title,created_at) values ('First',$1) returning id",
      [new Date(now.getTime() - 1000)],
    );
    const [later] = await rows<{ id: string }>(
      "insert into system_alert(title,created_at) values ('Later',$1) returning id",
      [new Date(now.getTime() + 1000)],
    );
    const snapshot = () =>
      Promise.all([
        rows("select * from reservation"),
        rows("select * from access_code"),
        rows("select * from payment"),
        rows("select * from message_delivery"),
        rows("select * from email_archive"),
      ]);
    const before = await snapshot();
    await resolveAllOpenAlerts(now);
    await resolveAllOpenAlerts(now);
    const [closed] = await rows<{ resolved_at: Date; context: unknown }>(
      "select * from system_alert where id=$1",
      [first!.id],
    );
    assert.ok(closed!.resolved_at);
    assert.deepEqual(
      incidentUpdates(closed!.context).map((u) => u.kind),
      ["manual"],
    );
    const [open] = await rows<{ resolved_at: Date | null }>(
      "select resolved_at from system_alert where id=$1",
      [later!.id],
    );
    assert.equal(open!.resolved_at, null);
    await resolveAlertById(later!.id, "   ");
    const [manual] = await rows<{ context: unknown }>(
      "select context from system_alert where id=$1",
      [later!.id],
    );
    assert.equal(
      incidentUpdates(manual!.context).at(-1)?.message,
      "Incident uzavřen správcem.",
    );
    assert.deepEqual(await snapshot(), before);
    assert.equal(resend.sent.length, 0);
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
