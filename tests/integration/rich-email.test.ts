import {
  databaseReady,
  resend,
  comgate,
  resetDatabase,
  rows,
  seedProfile,
  setSetting,
  startProviders,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { before, after, beforeEach, describe, test } from "node:test";
import { startOrder } from "../../src/lib/services/orders";
import { fulfillReservation } from "../../src/lib/services/fulfillment";
import { synchronizeComgatePayment } from "../../src/lib/services/payments";
import {
  getEmailTemplate,
  saveEmailTemplate,
  prepareTransactionalEmail,
} from "../../src/lib/services/email-templates";
import type { EmailDocument } from "../../src/lib/config/email-document";
const ADMIN = {
  id: "cab43210-3210-4321-8321-123412341234",
  email: "rich-editor@example.test",
  fullName: "Ukázkový editor",
};
const doc: EmailDocument = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Pravidla pro {name}" }],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Hudbu jen do sluchátek.",
                  marks: [
                    { type: "bold" },
                    { type: "italic" },
                    { type: "underline" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Termíny: {slots}" }],
    },
  ],
};
describe(
  "rich email template safety",
  { skip: !databaseReady && "requires local database" },
  () => {
    before(startProviders);
    after(stopEverything);
    beforeEach(async () => {
      await resetDatabase();
      await seedProfile(ADMIN);
    });
    test("saving rich content and preparing mandatory financial facts leave paid bookings, PINs and existing outboxes intact", async () => {
      const starts = [5, 6].map((days) => {
        const at = new Date(Date.now() + days * 86400000);
        at.setUTCMinutes(0, 0, 0);
        return at;
      });
      const result = await startOrder({
        userId: null,
        starts,
        details: {
          name: "Ukázkový host",
          email: "rich-guest@example.test",
          phone: "+420733444222",
          acceptedAt: new Date(),
        },
      });
      comgate.settle("TEST-0001", "PAID");
      await synchronizeComgatePayment("TEST-0001");
      const state = () =>
        rows(`select
      (select jsonb_agg(to_jsonb(r) order by id) from reservation r) as reservations,
      (select jsonb_agg(to_jsonb(o) order by id) from booking_order o) as orders,
      (select jsonb_agg(to_jsonb(p) order by id) from payment p) as payments,
      (select jsonb_agg(to_jsonb(c) order by id) from access_code c) as codes,
      (select jsonb_agg(to_jsonb(m) order by id) from message_delivery m) as messages,
      (select jsonb_agg(to_jsonb(e) order by id) from email_archive e) as emails`);
      const before = await state();
      const sent = resend.sent.length;
      await saveEmailTemplate({
        id: "order_confirmation",
        subject: "Upravená šablona",
        body: "Prostý obsah pro starší aplikaci",
        bodyDocument: doc,
        updatedByAdminId: ADMIN.id,
      });
      const prepared = await prepareTransactionalEmail({
        id: "order_confirmation",
        to: "fictional@example.test",
        variables: { name: "<Host> **X**", slots: "první\ndruhý" },
        requiredSummary: {
          variable: "payment_summary",
          text: "Použité kredity: 20 Kč",
        },
      });
      assert.match(
        prepared.html,
        /<h2[^>]*>Pravidla pro &lt;Host&gt; \*\*X\*\*<\/h2>/,
      );
      assert.match(prepared.html, /<ul[^>]*>/);
      assert.match(prepared.html, /text-decoration:underline/);
      assert.match(prepared.html, /Použité kredity: 20 Kč/);
      assert.match(prepared.text ?? "", /• Hudbu jen do sluchátek\./);
      assert.match(prepared.text ?? "", /Použité kredity: 20 Kč/);
      assert.deepEqual(await state(), before);
      assert.equal(resend.sent.length, sent);
      const bookings = await rows<{ id: string }>(
        "select id from reservation where order_id=$1",
        [result.orderId],
      );
      for (const booking of bookings) await fulfillReservation(booking.id);
      assert.equal(
        resend.sent.length,
        sent,
        "editing never resends an accepted confirmation",
      );
      assert.deepEqual(await state(), before);
    });
    test("invalid stored document falls back to the preserved plain body without sending or evaluating markup", async () => {
      await setSetting("messages.email.access_code", {
        subject: "Vstupní kód",
        body: "Bezpečný vstupní kód: {code}",
        bodyDocument: {
          type: "doc",
          content: [{ type: "html", html: "<script>alert(1)</script>" }],
        },
      });
      const template = await getEmailTemplate("access_code");
      assert.equal(template.bodyDocument, undefined);
      const prepared = await prepareTransactionalEmail({
        id: "access_code",
        to: "fictional@example.test",
        variables: { code: "123456" },
      });
      assert.match(prepared.html, /Bezpečný vstupní kód/);
      assert.doesNotMatch(prepared.html, /<script>/);
      assert.equal(resend.sent.length, 0);
    });
  },
);
