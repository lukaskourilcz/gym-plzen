import test from "node:test";
import assert from "node:assert/strict";
import {
  contactFailure,
  emailFailure,
  preparationFailure,
  parseIncident,
  INCIDENT_PHASES,
} from "../../src/lib/config/incidents";
import { incidentPresentation } from "../../src/lib/helpers/incident-presentation";
import { buildReservationIncident } from "../../src/lib/services/reservation-incidents";
const id = "00000000-0000-4000-8000-000000000001",
  userId = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-10-24T12:00:00Z");
function sample() {
  return buildReservationIncident({
    booking: {
      id,
      userId,
      contactName: "Ukázkový klient",
      startsAt: new Date("2026-10-25T12:00:00Z"),
      endsAt: new Date("2026-10-25T13:15:00Z"),
    },
    step: "code_delivered",
    failure: { code: "contact_email_missing" },
    attempts: 3,
    nextRetryAt: new Date("2026-10-24T12:05:00Z"),
    now,
  });
}
test("contact diagnostics distinguish no customer details, no email and a present recipient without changing legacy address validation", () => {
  assert.equal(contactFailure({})?.code, "contact_missing_all");
  assert.equal(
    contactFailure({ contactName: "Jana" })?.code,
    "contact_email_missing",
  );
  assert.equal(
    contactFailure({ contactPhone: "+420777000111" })?.code,
    "contact_email_missing",
  );
  assert.equal(contactFailure({ userId })?.code, "contact_email_missing");
  assert.equal(contactFailure({ contactEmail: "broken@" }), null);
  assert.equal(
    contactFailure({ contactEmail: "synthetic@example.test" }),
    null,
  );
});
test("fixed provider reasons remain distinct without guessing that every provider rejection means a bad customer email", () => {
  for (const [reason, code] of [
    ["resend_not_configured", "email_configuration_missing"],
    ["resend_http_429", "email_rate_limited"],
    ["resend_http_503", "email_unavailable"],
    ["resend_http_401", "email_rejected"],
    ["resend_http_422", "email_rejected"],
    ["resend_network_unconfirmed", "email_unconfirmed"],
    ["resend_send_unconfirmed_no_message_id", "email_unconfirmed"],
    ["unknown", "email_delivery_failed"],
  ])
    assert.equal(emailFailure(reason).code, code);
  assert.equal(preparationFailure("device_offline").code, "lock_offline");
  assert.equal(preparationFailure("provider_rejected").code, "lock_rejected");
  assert.equal(
    preparationFailure("provisioning_unknown").code,
    "code_unconfirmed",
  );
  assert.equal(
    preparationFailure(
      null,
      "Missing required environment variable(s): NUKI_SMARTLOCK_ID",
    ).code,
    "code_configuration_missing",
  );
});
test("incident context carries reservation and retry metadata, and urgency escalates only as the booking approaches", () => {
  const warning = sample(),
    context = parseIncident(warning.context)!;
  assert.equal(warning.severity, "warning");
  assert.equal(context.attempts, 3);
  assert.equal(context.startsAt, "2026-10-25T12:00:00.000Z");
  assert.equal(context.nextRetryAt, "2026-10-24T12:05:00.000Z");
  assert.equal(warning.dedupeKey, `reservation:${id}:contact`);
  assert.equal(
    buildReservationIncident({
      booking: {
        id,
        userId: null,
        contactName: null,
        startsAt: new Date(now.getTime() + 3600000),
        endsAt: new Date(now.getTime() + 7200000),
      },
      step: "code_created",
      failure: { code: "lock_offline" },
      attempts: 5,
      nextRetryAt: null,
      now,
    }).severity,
    "critical",
  );
  assert.equal(INCIDENT_PHASES.payment, "Potvrzení rezervace");
});
test("historical generic delivery errors never invent a missing contact or a PIN-generation failure", () => {
  const view = incidentPresentation({
    title: `Rezervace ${id}: krok "code_delivered" selhal`,
    body: "Po 6 pokusech: Mandatory email delivery failed",
    context: { reservationId: id, step: "code_delivered" },
  });
  assert.equal(view.title, "Povinný e-mail se nepodařilo odeslat");
  assert.equal(view.legacy, true);
  assert.ok(!view.cause?.includes("nemá kontaktní"));
  assert.equal(view.incident, null);
  assert.equal(view.reservationHref, `/admin/reservations?id=${id}`);
  assert.equal(
    incidentPresentation({
      title: "Vraťte platbu",
      body: "Skutečný provozní problém",
      context: null,
    }).title,
    "Vraťte platbu",
  );
});
test("new incidents show a human explanation and construct only validated internal links", () => {
  const a = sample(),
    view = incidentPresentation({
      title: a.title,
      body: a.body ?? null,
      context: a.context,
    });
  assert.equal(view.memberHref, `/admin/members/${userId}`);
  assert.equal(view.messagesHref, `/admin/messages?q=${id}`);
  assert.equal(view.legacy, false);
  assert.ok(view.action?.includes("doplnění doručovacího e-mailu"));
  assert.ok(view.action?.includes("starší rezervace automaticky nepřepisuje"));
  assert.equal(
    parseIncident({
      incident: { version: 1, reservationId: "javascript:alert(1)" },
    }),
    null,
  );
  assert.equal(
    incidentPresentation({
      title: "Test",
      body: null,
      context: { reservationId: "https://evil.test/" },
    }).reservationHref,
    null,
  );
});
test("technical details redact PINs, email, phone, bearer credentials and labeled secrets", () => {
  const a = buildReservationIncident({
    booking: {
      id,
      userId: null,
      contactName: null,
      startsAt: new Date(now.getTime() + 3600000),
      endsAt: new Date(now.getTime() + 7200000),
    },
    step: "code_created",
    failure: {
      code: "code_preparation_failed",
      detail:
        "code=123456 email=customer@example.test +420777000111 Authorization: Bearer superSecret123 token=doNotExpose api_key=privateValue",
    },
    attempts: 5,
    nextRetryAt: null,
    now,
  });
  const encoded = JSON.stringify(a);
  for (const secret of [
    "123456",
    "customer@example.test",
    "+420777000111",
    "superSecret123",
    "doNotExpose",
    "privateValue",
  ])
    assert.ok(!encoded.includes(secret), secret);
});
