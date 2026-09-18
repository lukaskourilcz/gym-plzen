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

  assert.match(html, /NAVI Private Gym/);
  assert.match(html, /navi-logo-email\.png/);
  assert.match(html, /href="https:\/\/example\.com\/action"/);
  assert.match(html, />Pokračovat</);
  assert.match(html, /Ahoj &lt;Klára&gt; &amp; tým/);
  assert.doesNotMatch(html, /Ahoj <Klára>/);
});

test("reservation detail becomes a table of labels and values", () => {
  const html = emailTextToHtml(
    "Ahoj Klára,\n\nTermín: pondělí 3. srpna v 18:00\nDélka: 75 minut\nCena: 229 Kč\n\nPozor, adresa je https://navigym.cz/kontakt",
  );

  // Every line of that paragraph is a label and a value, so it is a table…
  assert.match(html, /<td[^>]*>Termín<\/td>/);
  assert.match(html, /<td[^>]*>pondělí 3\. srpna v 18:00<\/td>/);
  assert.match(html, /<td[^>]*>Cena<\/td>/);
  assert.match(html, /<td[^>]*>229 Kč<\/td>/);
  // …while prose, including prose carrying a link, stays a paragraph.
  assert.match(html, /<p[^>]*>Ahoj Klára,<\/p>/);
  assert.match(
    html,
    /<p[^>]*>Pozor, adresa je https:\/\/navigym\.cz\/kontakt<\/p>/,
  );
});

test("a detail table keeps the order and count of the lines it was given", () => {
  const html = emailTextToHtml("Původní: včera\nNový: dnes\nDélka: 75 minut");
  // One block for the whole paragraph, not one per line.
  assert.equal((html.match(/background:#efece4/g) ?? []).length, 1);
  const detail = html.slice(html.indexOf("background:#efece4"));
  const rows = detail.slice(0, detail.indexOf("</table>"));
  assert.equal((rows.match(/<tr>/g) ?? []).length, 3);
  assert.ok(rows.indexOf("Původní") < rows.indexOf("Nový"));
  assert.ok(rows.indexOf("Nový") < rows.indexOf("Délka"));
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

test("a term change has its own customer e-mail with the old and new time", () => {
  const rescheduled = getEmailTemplateDefinition("reservation_rescheduled");
  assert.equal(rescheduled.delivery, "application");
  assert.deepEqual(rescheduled.variables, [
    "{name}",
    "{previous_time}",
    "{time}",
    "{duration}",
  ]);
  const rendered = renderEmailTemplateText(rescheduled.fallback, {
    name: "Klára",
    previous_time: "2. 8. 2026 9:00",
    time: "3. 8. 2026 18:00",
    duration: "75 minut",
  });
  assert.match(rendered.body, /Původní termín: 2\. 8\. 2026 9:00/);
  assert.match(rendered.body, /Nový termín: 3\. 8\. 2026 18:00/);
  assert.doesNotMatch(rendered.body, /\{[a-z_]+\}/);
});
