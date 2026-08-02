import assert from "node:assert/strict";
import test from "node:test";
import {
  emailTextToHtml,
  getEmailTemplateDefinition,
  renderEmailTemplateText,
} from "../../src/lib/config/email-templates";

test("e-mail templates substitute known variables and leave unknown markers visible", () => {
  const rendered = renderEmailTemplateText(
    {
      subject: "Rezervace pro {name}",
      body: "Kód: {code}\nČas: {time}\nNeznámé: {missing}",
    },
    { name: "Klára", code: "482 916", time: "18:00" },
  );

  assert.equal(rendered.subject, "Rezervace pro Klára");
  assert.equal(rendered.body, "Kód: 482 916\nČas: 18:00\nNeznámé: {missing}");
});

test("e-mail HTML escapes editor text before rendering the branded shell", () => {
  const html = emailTextToHtml("Ahoj <Klára> & tým", {
    actionUrl: "https://example.com/action",
    actionLabel: "Pokračovat",
  });

  assert.match(html, /NAMASTÉ PRIVATE GYM/);
  assert.match(html, /namaste-logo\.png/);
  assert.match(html, /href="https:\/\/example\.com\/action"/);
  assert.match(html, />Pokračovat</);
  assert.match(html, /Ahoj &lt;Klára&gt; &amp; tým/);
  assert.doesNotMatch(html, /Ahoj <Klára>/);
});

test("each application e-mail template declares its available variables", () => {
  assert.deepEqual(getEmailTemplateDefinition("access_code").variables, [
    "{name}",
    "{code}",
    "{time}",
  ]);
});

test("authentication e-mails have Czech branded fallbacks", () => {
  const confirmation = getEmailTemplateDefinition("signup_confirmation");
  const recovery = getEmailTemplateDefinition("password_reset");

  assert.equal(confirmation.delivery, "supabase_auth");
  assert.equal(confirmation.actionLabel, "Potvrdit e-mail");
  assert.match(confirmation.fallback.subject, /Potvrďte svůj e-mail/);
  assert.equal(recovery.delivery, "supabase_auth");
  assert.equal(recovery.actionLabel, "Nastavit nové heslo");
  assert.match(recovery.fallback.subject, /Obnova hesla/);
});
