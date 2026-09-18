import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_OPERATOR_NOTIFICATIONS,
  MAX_OPERATOR_RECIPIENTS,
  OPERATOR_EVENT_DEFINITIONS,
  OPERATOR_EVENT_IDS,
  operatorEventDefinition,
  operatorNotificationsSchema,
  parseRecipients,
} from "../../src/lib/config/operator-notifications";
import {
  emailTextToHtml,
  getEmailTemplateDefinition,
  renderEmailTemplateText,
} from "../../src/lib/config/email-templates";

test("addresses are split on commas, semicolons and new lines", () => {
  assert.deepEqual(
    parseRecipients("info@navigym.cz, druhy@navigym.cz\ntreti@navigym.cz"),
    ["info@navigym.cz", "druhy@navigym.cz", "treti@navigym.cz"],
  );
  assert.deepEqual(parseRecipients("  info@navigym.cz  "), ["info@navigym.cz"]);
  assert.deepEqual(parseRecipients(""), []);
  assert.deepEqual(parseRecipients(" , ; \n "), []);
});

test("the same address twice is one recipient, not two e-mails", () => {
  assert.deepEqual(parseRecipients("info@navigym.cz, INFO@navigym.cz"), [
    "info@navigym.cz",
  ]);
});

test("the settings accept addresses and reject what is not one", () => {
  const events = DEFAULT_OPERATOR_NOTIFICATIONS.events;
  assert.equal(
    operatorNotificationsSchema.safeParse({
      recipients: "info@navigym.cz, druhy@navigym.cz",
      events,
    }).success,
    true,
  );
  // Empty means "send nothing", which is a choice, not an error.
  assert.equal(
    operatorNotificationsSchema.safeParse({ recipients: "", events }).success,
    true,
  );
  assert.equal(
    operatorNotificationsSchema.safeParse({ recipients: "info@", events })
      .success,
    false,
  );
  assert.equal(
    operatorNotificationsSchema.safeParse({
      recipients: Array.from(
        { length: MAX_OPERATOR_RECIPIENTS + 1 },
        (_, i) => `a${i}@navigym.cz`,
      ).join(","),
      events,
    }).success,
    false,
  );
});

test("every event has a definition and a default", () => {
  assert.equal(OPERATOR_EVENT_DEFINITIONS.length, OPERATOR_EVENT_IDS.length);
  for (const id of OPERATOR_EVENT_IDS) {
    const definition = operatorEventDefinition(id);
    assert.equal(definition.id, id);
    assert.ok(definition.label.length > 0, `${id} has a Czech label`);
    assert.ok(definition.description.length > 0, `${id} explains itself`);
    assert.equal(
      typeof DEFAULT_OPERATOR_NOTIFICATIONS.events[id],
      "boolean",
      `${id} has a default`,
    );
  }
  // The booking the operator asked for is on from the start.
  assert.equal(
    DEFAULT_OPERATOR_NOTIFICATIONS.events.reservationConfirmed,
    true,
  );
});

test("the operator's e-mail renders its facts as a table, not as prose", () => {
  const definition = getEmailTemplateDefinition("operator_notice");
  assert.equal(definition.delivery, "application");
  assert.ok(definition.actionLabel, "it links back into the administration");

  const rendered = renderEmailTemplateText(definition.fallback, {
    event: "Nová rezervace",
    summary: "Klára Testová má potvrzenou rezervaci na 3. 8. 2026, 18:00.",
    detail:
      "Termín: 3. 8. 2026, 18:00\nDélka: 75 minut\nZákazník: Klára Testová\nE-mail: klara@example.test\nÚčet: registrovaný člen\nCena: 229 Kč",
  });
  assert.match(rendered.subject, /^Nová rezervace/);
  assert.match(rendered.body, /Klára Testová má potvrzenou rezervaci/);

  const html = emailTextToHtml(rendered.body, {
    actionUrl: "https://www.navigym.cz/admin/reservations",
    actionLabel: definition.actionLabel!,
  });
  // Each detail line is a row of the table; the summary stays a paragraph.
  for (const label of ["Termín", "Délka", "Zákazník", "Účet", "Cena"])
    assert.match(html, new RegExp(`>${label}</td>`), `${label} is a row`);
  assert.match(html, /<p[^>]*>Klára Testová má potvrzenou rezervaci/);
  assert.match(html, /href="https:\/\/www\.navigym\.cz\/admin\/reservations"/);
});
